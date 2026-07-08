import { randomUUID } from 'node:crypto'
import type {
  EccFlowRunRequest,
  EccFlowRunResult,
  EccFlowRunStepRequest,
  EccFlowRunStepResult,
  EccRpcHelloResult,
  EccRpcPingResult,
  EccRpcShutdownResult,
  EccRuntimeEvent,
  EccWorkspaceCloseResult,
  EccWorkspaceCreateRequest,
  EccWorkspaceCreateResult,
  EccWorkspaceHandleRequest,
  EccWorkspaceHomeResult,
  EccWorkspaceInfoRequest,
  EccWorkspaceInfoResult,
  EccWorkspaceOpenRequest,
  EccWorkspaceOpenResult,
  EccWorkspaceRefreshConfigResult,
  EccWorkspaceResetFlowResult,
  EccWorkspaceSyncConfigRequest,
  EccWorkspaceSyncConfigResult,
} from '@ecos-studio/shared'

import { normalizeRuntimeError } from './errors'
import { WorkspaceSessionRegistry } from './workspaceSessions'

export interface EccRpcRuntimeClient {
  call<T>(
    method: string,
    params?: Record<string, unknown>,
    options?: { timeoutMs?: number },
  ): Promise<T>
}

export interface EccRpcRuntimeSidecar {
  logFile: string | null
  shutdown(): Promise<void>
  start(): Promise<EccRpcRuntimeClient>
}

export interface EccRpcRuntimeServiceOptions {
  createSidecar(onEvent: (event: EccRuntimeEvent) => void): EccRpcRuntimeSidecar
  onEvent?: (event: EccRuntimeEvent) => void
  sessions?: WorkspaceSessionRegistry
}

interface EccWorkspaceSessionResult {
  directory: string
  workspaceId: string
}

type RuntimeOperation<T> = () => Promise<T>

export class EccRpcRuntimeService {
  private readonly sessions: WorkspaceSessionRegistry
  private readonly sidecar: EccRpcRuntimeSidecar
  private client: EccRpcRuntimeClient | null = null
  private readonly activeRuntimeDirectories = new Set<string>()
  private readonly eventListeners = new Set<(event: EccRuntimeEvent) => void>()
  private helloResult: EccRpcHelloResult | null = null
  private queue = Promise.resolve()
  private ready = false

  constructor(private readonly options: EccRpcRuntimeServiceOptions) {
    this.sessions = options.sessions ?? new WorkspaceSessionRegistry()
    this.sidecar = options.createSidecar((event) => this.handleSidecarEvent(event))
  }

  get activeWorkspaceDirectory(): string | null {
    return this.sessions.active?.directory ?? null
  }

  onEvent(listener: (event: EccRuntimeEvent) => void): () => void {
    this.eventListeners.add(listener)
    return () => {
      this.eventListeners.delete(listener)
    }
  }

  isWorkspaceRuntimeActive(directory: string): boolean {
    return this.activeRuntimeDirectories.has(directory)
  }

  rpcHello(): Promise<EccRpcHelloResult> {
    return this.enqueue('rpc.hello', undefined, async () => {
      await this.ensureStarted()
      if (!this.helloResult) {
        throw new Error('ECC RPC hello completed without a result.')
      }
      return this.helloResult
    })
  }

  rpcPing(): Promise<EccRpcPingResult> {
    return this.enqueue('rpc.ping', undefined, async () => {
      const client = await this.ensureStarted()
      return await client.call<EccRpcPingResult>('rpc.ping')
    })
  }

  rpcShutdown(): Promise<EccRpcShutdownResult> {
    return this.enqueue('rpc.shutdown', undefined, async () => {
      await this.sidecar.shutdown()
      this.ready = false
      this.helloResult = null
      this.sessions.clearEccWorkspaceIds()
      return { ok: true }
    })
  }

  createWorkspace(request: EccWorkspaceCreateRequest): Promise<EccWorkspaceCreateResult> {
    return this.enqueue('workspace.create', undefined, async () => {
      const client = await this.ensureStarted()
      const response = await client.call<EccWorkspaceSessionResult>('workspace.create', {
        directory: request.directory,
        filelist: request.filelist ?? '',
        originDef: request.originDef ?? '',
        originVerilog: request.originVerilog ?? '',
        parameters: request.parameters ?? {},
        pdk: request.pdk ?? '',
        pdkJson: request.pdkJson ?? null,
        pdkRoot: request.pdkRoot ?? '',
        rtlList: request.rtlList ?? [],
      })
      const session = this.sessions.activate(response.directory, response.workspaceId)
      return {
        directory: session.directory,
        workspaceHandle: session.workspaceHandle,
      }
    })
  }

  openWorkspace(request: EccWorkspaceOpenRequest): Promise<EccWorkspaceOpenResult> {
    return this.enqueue('workspace.open', undefined, async () => {
      const client = await this.ensureStarted()
      const response = await client.call<EccWorkspaceSessionResult>('workspace.open', {
        directory: request.directory,
      })
      const session = this.sessions.activate(response.directory, response.workspaceId)
      return {
        directory: session.directory,
        workspaceHandle: session.workspaceHandle,
      }
    })
  }

  closeWorkspace(request: EccWorkspaceHandleRequest): Promise<EccWorkspaceCloseResult> {
    return this.enqueue('workspace.close', request.workspaceHandle, async () => {
      const session = this.sessions.require(request.workspaceHandle)
      if (session.eccWorkspaceId) {
        const client = await this.ensureStarted()
        await client.call('workspace.close', {
          workspaceId: session.eccWorkspaceId,
        })
      }
      this.sessions.close(request.workspaceHandle)
      return { ok: true }
    })
  }

  workspaceHome(request: EccWorkspaceHandleRequest): Promise<EccWorkspaceHomeResult> {
    return this.enqueue('workspace.home', request.workspaceHandle, async () => {
      const client = await this.ensureStarted()
      const workspaceId = await this.resolveEccWorkspaceId(request.workspaceHandle)
      return await client.call<EccWorkspaceHomeResult>('workspace.home', {
        workspaceId,
      })
    })
  }

  workspaceInfo(request: EccWorkspaceInfoRequest): Promise<EccWorkspaceInfoResult> {
    return this.enqueue('workspace.info', request.workspaceHandle, async () => {
      const client = await this.ensureStarted()
      const workspaceId = await this.resolveEccWorkspaceId(request.workspaceHandle)
      return await client.call<EccWorkspaceInfoResult>('workspace.info', {
        id: request.id,
        step: request.step,
        workspaceId,
      })
    })
  }

  refreshConfig(
    request: EccWorkspaceHandleRequest,
  ): Promise<EccWorkspaceRefreshConfigResult> {
    return this.enqueue('workspace.refresh_config', request.workspaceHandle, async () => {
      const client = await this.ensureStarted()
      const workspaceId = await this.resolveEccWorkspaceId(request.workspaceHandle)
      return await client.call<EccWorkspaceRefreshConfigResult>(
        'workspace.refresh_config',
        {
          workspaceId,
        },
      )
    })
  }

  syncConfig(
    request: EccWorkspaceSyncConfigRequest,
  ): Promise<EccWorkspaceSyncConfigResult> {
    return this.enqueue('workspace.sync_config', request.workspaceHandle, async () => {
      const client = await this.ensureStarted()
      const workspaceId = await this.resolveEccWorkspaceId(request.workspaceHandle)
      return await client.call<EccWorkspaceSyncConfigResult>('workspace.sync_config', {
        configPath: request.configPath,
        workspaceId,
      })
    })
  }

  resetFlow(request: EccWorkspaceHandleRequest): Promise<EccWorkspaceResetFlowResult> {
    return this.enqueue('workspace.reset_flow', request.workspaceHandle, async () => {
      const client = await this.ensureStarted()
      const workspaceId = await this.resolveEccWorkspaceId(request.workspaceHandle)
      return await client.call<EccWorkspaceResetFlowResult>('workspace.reset_flow', {
        workspaceId,
      })
    })
  }

  runFlow(request: EccFlowRunRequest): Promise<EccFlowRunResult> {
    return this.enqueue('flow.run', request.workspaceHandle, async () => {
      const client = await this.ensureStarted()
      const workspaceId = await this.resolveEccWorkspaceId(request.workspaceHandle)
      return await client.call<EccFlowRunResult>('flow.run', {
        rerun: Boolean(request.rerun),
        workspaceId,
      })
    })
  }

  runStep(request: EccFlowRunStepRequest): Promise<EccFlowRunStepResult> {
    return this.enqueue('flow.run_step', request.workspaceHandle, async () => {
      const client = await this.ensureStarted()
      const workspaceId = await this.resolveEccWorkspaceId(request.workspaceHandle)
      return await client.call<EccFlowRunStepResult>('flow.run_step', {
        rerun: Boolean(request.rerun),
        step: request.step,
        workspaceId,
      })
    })
  }

  private async ensureStarted(): Promise<EccRpcRuntimeClient> {
    if (this.ready && this.helloResult && this.client) {
      return this.client
    }

    const client = await this.sidecar.start()
    this.client = client
    if (this.ready && this.helloResult) {
      return client
    }

    this.helloResult = await client.call<EccRpcHelloResult>('rpc.hello', {
      version: 1,
    })
    this.ready = true
    this.emit({ type: 'runtime.ready' })
    return client
  }

  private async resolveEccWorkspaceId(workspaceHandle: string): Promise<string> {
    const session = this.sessions.require(workspaceHandle)
    if (session.eccWorkspaceId) {
      return session.eccWorkspaceId
    }

    const client = await this.ensureStarted()
    const response = await client.call<EccWorkspaceSessionResult>('workspace.open', {
      directory: session.directory,
    })
    this.sessions.rebindActive(response.workspaceId)
    return response.workspaceId
  }

  private enqueue<T>(
    method: string,
    workspaceHandle: string | undefined,
    operation: RuntimeOperation<T>,
  ): Promise<T> {
    const run = async (): Promise<T> => {
      const operationId = `operation-${randomUUID()}`
      const runtimeDirectory = this.runtimeDirectoryForHandle(workspaceHandle)
      if (runtimeDirectory) {
        this.activeRuntimeDirectories.add(runtimeDirectory)
      }
      this.emit({
        logFile: this.sidecar.logFile ?? undefined,
        method,
        operationId,
        type: 'operation.started',
        workspaceHandle,
      })
      try {
        const result = await operation()
        this.emit({
          logFile: this.sidecar.logFile ?? undefined,
          method,
          operationId,
          type: 'operation.completed',
          workspaceHandle,
        })
        return result
      } catch (error) {
        const normalized = normalizeRuntimeError(error, {
          logFile: this.sidecar.logFile,
          method,
          operationId,
          workspaceHandle,
        })
        this.emit({
          logFile: normalized.logFile,
          message: normalized.message,
          method,
          operationId,
          type: 'operation.failed',
          workspaceHandle,
        })
        throw normalized
      } finally {
        if (runtimeDirectory) {
          this.activeRuntimeDirectories.delete(runtimeDirectory)
        }
      }
    }

    const next = this.queue.then(run, run)
    this.queue = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  private handleSidecarEvent(event: EccRuntimeEvent): void {
    if (event.type === 'runtime.exited') {
      this.client = null
      this.ready = false
      this.helloResult = null
      this.sessions.clearEccWorkspaceIds()
    }
    this.emit(event)
  }

  private runtimeDirectoryForHandle(workspaceHandle: string | undefined): string | null {
    if (!workspaceHandle) {
      return null
    }
    try {
      return this.sessions.require(workspaceHandle).directory
    } catch {
      return null
    }
  }

  private emit(event: EccRuntimeEvent): void {
    this.options.onEvent?.(event)
    for (const listener of this.eventListeners) {
      listener(event)
    }
  }
}
