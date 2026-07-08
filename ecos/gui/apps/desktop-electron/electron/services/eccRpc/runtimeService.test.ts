import type { EccRuntimeEvent } from '@ecos-studio/shared'
import { describe, expect, it } from 'vitest'

import {
  EccRpcRuntimeService,
  type EccRpcRuntimeClient,
  type EccRpcRuntimeSidecar,
} from './runtimeService'

interface RpcCall {
  method: string
  params?: Record<string, unknown>
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

function waitForQueuedOperation(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve)
  })
}

class FakeRpcClient implements EccRpcRuntimeClient {
  readonly calls: RpcCall[] = []
  responses: Array<unknown | Promise<unknown>> = []

  async call<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    this.calls.push({ method, params })
    const response = this.responses.shift()
    if (response instanceof Error) {
      throw response
    }
    return (await response) as T
  }
}

class FakeSidecar implements EccRpcRuntimeSidecar {
  logFile: string | null = '/tmp/ecc-rpc-runtime.log'
  startCount = 0

  constructor(private readonly client: FakeRpcClient) {}

  async shutdown(): Promise<void> {
    return
  }

  async start(): Promise<EccRpcRuntimeClient> {
    this.startCount += 1
    return this.client
  }
}

function createService() {
  const client = new FakeRpcClient()
  const events: EccRuntimeEvent[] = []
  let sidecarEvent: ((event: EccRuntimeEvent) => void) | null = null
  const sidecar = new FakeSidecar(client)
  const service = new EccRpcRuntimeService({
    createSidecar: (onEvent) => {
      sidecarEvent = onEvent
      return sidecar
    },
    onEvent: (event) => events.push(event),
  })
  return {
    client,
    events,
    service,
    sidecar,
    sidecarEvent: (event: EccRuntimeEvent) => sidecarEvent?.(event),
  }
}

describe('EccRpcRuntimeService', () => {
  it('lazy-starts the sidecar, performs rpc.hello, and opens workspaces', async () => {
    const { client, events, service, sidecar } = createService()
    client.responses.push(
      { capabilities: ['workspace.open'], eccVersion: '0.1.0', version: 1 },
      { directory: '/work/demo', workspaceId: 'workspace-1' },
    )

    const result = await service.openWorkspace({ directory: '/work/demo' })

    expect(sidecar.startCount).toBe(1)
    expect(client.calls).toEqual([
      { method: 'rpc.hello', params: { version: 1 } },
      { method: 'workspace.open', params: { directory: '/work/demo' } },
    ])
    expect(result).toEqual({
      directory: '/work/demo',
      workspaceHandle: expect.stringMatching(/^workspace-/),
    })
    expect(events).toContainEqual({ type: 'runtime.ready' })
  })

  it('maps flow.run_step requests through the stored ECC workspace id', async () => {
    const { client, service } = createService()
    client.responses.push(
      { capabilities: [], eccVersion: '0.1.0', version: 1 },
      { directory: '/work/demo', workspaceId: 'workspace-1' },
      { state: 'Success', step: 'placement' },
    )

    const workspace = await service.openWorkspace({ directory: '/work/demo' })
    await expect(
      service.runStep({
        rerun: true,
        step: 'placement',
        workspaceHandle: workspace.workspaceHandle,
      }),
    ).resolves.toEqual({ state: 'Success', step: 'placement' })

    expect(client.calls.at(-1)).toEqual({
      method: 'flow.run_step',
      params: {
        rerun: true,
        step: 'placement',
        workspaceId: 'workspace-1',
      },
    })
  })

  it('emits rerun metadata when a full flow rerun starts', async () => {
    const { client, events, service } = createService()
    client.responses.push(
      { capabilities: [], eccVersion: '0.1.0', version: 1 },
      { directory: '/work/demo', workspaceId: 'workspace-1' },
      { rerun: true },
    )

    const workspace = await service.openWorkspace({ directory: '/work/demo' })
    await service.runFlow({
      rerun: true,
      workspaceHandle: workspace.workspaceHandle,
    })

    expect(events).toContainEqual(
      expect.objectContaining({
        method: 'flow.run',
        rerun: true,
        type: 'operation.started',
        workspaceHandle: workspace.workspaceHandle,
      }),
    )
  })

  it('serializes all RPC operations through a global queue', async () => {
    const { client, service } = createService()
    client.responses.push({ capabilities: [], eccVersion: '0.1.0', version: 1 })
    await service.rpcHello()
    await Promise.resolve()
    client.calls.length = 0

    const firstPing = deferred<{ ok: boolean }>()
    client.responses.push(firstPing.promise, { ok: true })

    const first = service.rpcPing()
    const second = service.rpcPing()
    await waitForQueuedOperation()

    expect(client.calls).toEqual([{ method: 'rpc.ping', params: undefined }])
    firstPing.resolve({ ok: true })
    await expect(first).resolves.toEqual({ ok: true })
    await expect(second).resolves.toEqual({ ok: true })
    expect(client.calls).toEqual([
      { method: 'rpc.ping', params: undefined },
      { method: 'rpc.ping', params: undefined },
    ])
  })

  it('restarts and reopens the active workspace on the next call after exit', async () => {
    const { client, service, sidecar, sidecarEvent } = createService()
    client.responses.push(
      { capabilities: [], eccVersion: '0.1.0', version: 1 },
      { directory: '/work/demo', workspaceId: 'workspace-1' },
      { capabilities: [], eccVersion: '0.1.0', version: 1 },
      { directory: '/work/demo', workspaceId: 'workspace-2' },
      { rerun: false },
    )

    const workspace = await service.openWorkspace({ directory: '/work/demo' })
    sidecarEvent({
      code: 1,
      reason: 'unexpected',
      signal: null,
      type: 'runtime.exited',
    })

    await expect(
      service.runFlow({
        rerun: false,
        workspaceHandle: workspace.workspaceHandle,
      }),
    ).resolves.toEqual({ rerun: false })

    expect(sidecar.startCount).toBe(2)
    expect(client.calls.slice(2)).toEqual([
      { method: 'rpc.hello', params: { version: 1 } },
      { method: 'workspace.open', params: { directory: '/work/demo' } },
      {
        method: 'flow.run',
        params: {
          rerun: false,
          workspaceId: 'workspace-2',
        },
      },
    ])
  })
})
