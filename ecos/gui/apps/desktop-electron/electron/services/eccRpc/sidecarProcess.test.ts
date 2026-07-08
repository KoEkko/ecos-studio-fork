import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough, Writable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'

import { EccRpcSidecarProcess, type SpawnedEccRpcSidecar } from './sidecarProcess'
import { encodeContentLengthFrame } from './transport'

class FakeWritable extends Writable {
  readonly chunks: Buffer[] = []

  _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(Buffer.from(chunk))
    callback()
  }
}

class FakeChild extends EventEmitter implements SpawnedEccRpcSidecar {
  readonly stderr = new PassThrough()
  readonly stdin = new FakeWritable()
  readonly stdout = new PassThrough()
  killed = false

  kill(signal?: NodeJS.Signals): boolean {
    void signal
    this.killed = true
    return true
  }
}

describe('EccRpcSidecarProcess', () => {
  it('spawns ecc rpc serve --stdio', async () => {
    const child = new FakeChild()
    const spawn = vi.fn(() => child)
    const sidecar = new EccRpcSidecarProcess({
      env: { PATH: '/bin' },
      spawn,
    })

    await sidecar.start()

    expect(spawn).toHaveBeenCalledWith('ecc', ['rpc', 'serve', '--stdio'], {
      env: { PATH: '/bin' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  })

  it('connects stdout responses to the JSON-RPC client', async () => {
    const child = new FakeChild()
    const sidecar = new EccRpcSidecarProcess({ spawn: () => child })
    const client = await sidecar.start()

    const promise = client.call<{ ok: boolean }>('rpc.ping')
    child.stdout.write(
      encodeContentLengthFrame('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}'),
    )

    await expect(promise).resolves.toEqual({ ok: true })
  })

  it('writes stderr to a runtime log file and emits stderr events', async () => {
    const child = new FakeChild()
    const tempDir = mkdtempSync(join(tmpdir(), 'ecc-rpc-sidecar-'))
    const events: unknown[] = []
    const sidecar = new EccRpcSidecarProcess({
      onEvent: (event) => events.push(event),
      spawn: () => child,
      tempDir,
    })

    await sidecar.start()
    child.stderr.write('hello stderr\n')

    const logFile = sidecar.logFile
    expect(logFile).toBeTruthy()
    expect(readFileSync(logFile!, 'utf8')).toContain('hello stderr')
    expect(events).toContainEqual({
      logFile,
      text: 'hello stderr\n',
      type: 'runtime.stderr',
    })
  })

  it('rejects pending requests and emits an unexpected exit event', async () => {
    const child = new FakeChild()
    const events: unknown[] = []
    const sidecar = new EccRpcSidecarProcess({
      onEvent: (event) => events.push(event),
      spawn: () => child,
    })
    const client = await sidecar.start()
    const promise = client.call('rpc.ping')

    child.emit('close', 1, null)

    await expect(promise).rejects.toThrow('ECC RPC sidecar exited')
    expect(events).toContainEqual(
      expect.objectContaining({
        code: 1,
        reason: 'unexpected',
        signal: null,
        type: 'runtime.exited',
      }),
    )
  })
})
