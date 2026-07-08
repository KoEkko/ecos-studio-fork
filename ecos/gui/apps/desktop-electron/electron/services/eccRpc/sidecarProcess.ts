import { spawn as spawnChild } from 'node:child_process'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { EventEmitter } from 'node:events'
import type { Readable, Writable } from 'node:stream'
import type { EccRuntimeEvent } from '@ecos-studio/shared'

import { EccJsonRpcClient } from './jsonRpcClient'

export interface SpawnedEccRpcSidecar extends EventEmitter {
  kill(signal?: NodeJS.Signals): boolean
  stderr?: Readable | null
  stdin?: Writable | null
  stdout?: Readable | null
}

export type EccRpcSidecarSpawn = (
  command: string,
  args: string[],
  options: {
    env: NodeJS.ProcessEnv
    stdio: ['pipe', 'pipe', 'pipe']
  },
) => SpawnedEccRpcSidecar

export interface EccRpcSidecarProcessOptions {
  command?: string
  env?: NodeJS.ProcessEnv
  envProvider?: () => NodeJS.ProcessEnv | Promise<NodeJS.ProcessEnv>
  logDirectoryProvider?: () => string | null
  onEvent?: (event: EccRuntimeEvent) => void
  shutdownTimeoutMs?: number
  spawn?: EccRpcSidecarSpawn
  tempDir?: string
}

function timestampForFile(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    '-' +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

function dataToString(data: unknown): string {
  return Buffer.isBuffer(data) ? data.toString('utf8') : String(data)
}

export class EccRpcSidecarProcess {
  private child: SpawnedEccRpcSidecar | null = null
  private client: EccJsonRpcClient | null = null
  private readonly command: string
  private readonly env: NodeJS.ProcessEnv
  private readonly forceKillTimeoutMs: number
  private readonly shutdownTimeoutMs: number
  private readonly spawnImpl: EccRpcSidecarSpawn
  private readonly tempDir: string
  private forceKillTimer: ReturnType<typeof setTimeout> | null = null
  private shuttingDown = false
  logFile: string | null = null

  constructor(private readonly options: EccRpcSidecarProcessOptions = {}) {
    this.command = options.command ?? 'ecc'
    this.env = { ...(options.env ?? process.env) }
    this.forceKillTimeoutMs = 1000
    this.shutdownTimeoutMs = options.shutdownTimeoutMs ?? 3000
    this.spawnImpl = options.spawn ?? (spawnChild as unknown as EccRpcSidecarSpawn)
    this.tempDir = options.tempDir ?? tmpdir()
  }

  async start(): Promise<EccJsonRpcClient> {
    if (this.client) {
      return this.client
    }

    const env = await this.resolveEnv()
    this.logFile = this.createLogFile()
    this.shuttingDown = false

    const child = this.spawnImpl(this.command, ['rpc', 'serve', '--stdio'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child = child

    const client = new EccJsonRpcClient({
      writeFrame: (frame) => {
        if (!child.stdin?.writable) {
          throw new Error('ECC RPC sidecar stdin is not writable.')
        }
        child.stdin.write(frame)
      },
    })
    this.client = client

    child.stdout?.on('data', (chunk) => {
      try {
        client.feedStdout(chunk as Buffer)
      } catch (error) {
        client.rejectPending(error instanceof Error ? error : new Error(String(error)))
      }
    })

    child.stderr?.on('data', (chunk) => {
      const text = dataToString(chunk)
      this.appendLog(text)
      this.options.onEvent?.({
        logFile: this.logFile ?? undefined,
        text,
        type: 'runtime.stderr',
      })
    })

    child.once('error', (error) => {
      const sidecarError =
        error instanceof Error ? error : new Error(`ECC RPC sidecar error: ${error}`)
      this.client?.rejectPending(sidecarError)
    })

    child.once('close', (code: number | null, signal: NodeJS.Signals | null) => {
      this.clearForceKillTimer()
      const reason = this.shuttingDown ? 'shutdown' : 'unexpected'
      const message =
        reason === 'unexpected'
          ? `ECC RPC sidecar exited with ${signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`}.`
          : undefined
      const exitError = new Error(message ?? 'ECC RPC sidecar exited.')
      this.client?.rejectPending(exitError)
      this.client = null
      this.child = null
      this.options.onEvent?.({
        code,
        logFile: this.logFile ?? undefined,
        message,
        reason,
        signal,
        type: 'runtime.exited',
      })
    })

    return client
  }

  async shutdown(): Promise<void> {
    const child = this.child
    const client = this.client
    if (!child || !client) {
      return
    }

    this.shuttingDown = true
    try {
      await client.call('rpc.shutdown', undefined, {
        timeoutMs: this.shutdownTimeoutMs,
      })
    } catch {
      child.kill('SIGTERM')
      this.forceKillTimer = setTimeout(() => {
        if (this.child === child) {
          child.kill('SIGKILL')
        }
      }, this.forceKillTimeoutMs)
    }
  }

  private clearForceKillTimer(): void {
    if (!this.forceKillTimer) {
      return
    }
    clearTimeout(this.forceKillTimer)
    this.forceKillTimer = null
  }

  private async resolveEnv(): Promise<NodeJS.ProcessEnv> {
    if (!this.options.envProvider) {
      return this.env
    }

    try {
      return await this.options.envProvider()
    } catch {
      return this.env
    }
  }

  private createLogFile(): string {
    const preferredDir = this.options.logDirectoryProvider?.()
    const logDir = preferredDir ?? join(this.tempDir, 'ecos-ecc-rpc-logs')
    mkdirSync(logDir, { recursive: true })
    const path = join(logDir, `ecc-rpc-runtime-${timestampForFile()}.log`)
    writeFileSync(path, '', { encoding: 'utf8', flag: 'w' })
    return path
  }

  private appendLog(text: string): void {
    if (!this.logFile) {
      return
    }
    appendFileSync(this.logFile, text, 'utf8')
  }
}
