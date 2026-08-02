import { describe, expect, it, vi } from 'vitest'
import type {
  DesktopAgentEvent,
  DesktopAgentStartSessionResponse,
  DesktopAgentStatus,
} from '@ecos-studio/shared'
import type { AgentProviderRuntime } from './agentProviderContract'
import type { ResolvedAgentProviderManifest } from './agentProviderPlugin'
import { AgentService, NO_AGENT_PROVIDER_MESSAGE } from './agentService'

function manifest(providerId: string): ResolvedAgentProviderManifest {
  return {
    command: 'provider',
    manifestPath: `/plugins/${providerId}/agent-provider.json`,
    pluginRoot: `/plugins/${providerId}`,
    protocolVersion: 1,
    providerId,
  }
}

function fakeRuntime(): AgentProviderRuntime & {
  emit(event: DesktopAgentEvent): void
} {
  const listeners = new Set<(event: DesktopAgentEvent) => void>()
  return {
    emit(event) {
      for (const listener of listeners) listener(event)
    },
    onEvent(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start: vi.fn(async () => {}),
    startSession: vi.fn(
      async (): Promise<DesktopAgentStartSessionResponse> => ({ sessionId: 's1' }),
    ),
    sendMessage: vi.fn(async () => ({ sessionId: 's1', text: 'ok' })),
    interrupt: vi.fn(async () => {}),
    getStatus: vi.fn(
      async (): Promise<DesktopAgentStatus> => ({ providerId: 'codex', state: 'ready' }),
    ),
    setMode: vi.fn(
      async (): Promise<DesktopAgentStatus> => ({
        providerId: 'codex',
        state: 'ready',
      }),
    ),
    listSessions: vi.fn(async () => ({ sessions: [] })),
    resumeSession: vi.fn(async () => ({ sessionId: 's1' })),
    stop: vi.fn(async () => {}),
  }
}

describe('AgentService', () => {
  it('reports a stopped status instead of throwing when no provider is installed', async () => {
    const service = new AgentService({
      pluginRoots: ['/plugins'],
      discoverManifests: async () => [],
    })

    await expect(service.getStatus()).resolves.toEqual({
      providerId: 'none',
      state: 'stopped',
      message: NO_AGENT_PROVIDER_MESSAGE,
    })
  })

  it('rejects a message with an actionable error when no provider is installed', async () => {
    const service = new AgentService({
      pluginRoots: ['/plugins'],
      discoverManifests: async () => [],
    })

    await expect(service.sendMessage({ message: 'hi', sessionId: 's1' })).rejects.toThrow(
      NO_AGENT_PROVIDER_MESSAGE,
    )
  })

  it('treats stopping a never-discovered agent as a no-op', async () => {
    const service = new AgentService({
      pluginRoots: ['/plugins'],
      discoverManifests: async () => [],
    })

    await expect(service.stop()).resolves.toBeUndefined()
  })

  it('routes calls to the discovered provider', async () => {
    const runtime = fakeRuntime()
    const service = new AgentService({
      pluginRoots: ['/plugins'],
      discoverManifests: async () => [manifest('codex')],
      createRuntime: () => runtime,
    })

    await expect(service.startSession({ directory: '/w' })).resolves.toEqual({
      sessionId: 's1',
    })
    expect(runtime.startSession).toHaveBeenCalledWith({ directory: '/w' })
  })

  it('forwards provider events to its own subscribers', async () => {
    const runtime = fakeRuntime()
    const service = new AgentService({
      pluginRoots: ['/plugins'],
      discoverManifests: async () => [manifest('codex')],
      createRuntime: () => runtime,
    })
    const received: DesktopAgentEvent[] = []
    service.onEvent((event) => received.push(event))

    await service.getStatus()
    runtime.emit({ type: 'message', text: 'hello' })

    expect(received).toEqual([{ type: 'message', text: 'hello', providerId: 'codex' }])
  })

  it('discovers only once across calls', async () => {
    const discoverManifests = vi.fn(async () => [manifest('codex')])
    const service = new AgentService({
      pluginRoots: ['/plugins'],
      discoverManifests,
      createRuntime: () => fakeRuntime(),
    })

    await service.getStatus()
    await service.getStatus()

    expect(discoverManifests).toHaveBeenCalledTimes(1)
  })

  it('retries discovery after a failure, so a fixed plugin needs no restart', async () => {
    const discoverManifests = vi
      .fn<() => Promise<ResolvedAgentProviderManifest[]>>()
      .mockRejectedValueOnce(new Error('bad manifest'))
      .mockResolvedValueOnce([manifest('codex')])
    const service = new AgentService({
      pluginRoots: ['/plugins'],
      discoverManifests,
      createRuntime: () => fakeRuntime(),
    })

    await expect(service.getStatus()).rejects.toThrow('bad manifest')
    await expect(service.getStatus()).resolves.toMatchObject({ state: 'ready' })
  })
})
