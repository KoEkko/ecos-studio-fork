import type {
  DesktopAgentEvent,
  DesktopAgentProviderRequest,
  DesktopAgentSendMessageRequest,
  DesktopAgentSendMessageResponse,
  DesktopAgentStartSessionRequest,
  DesktopAgentStartSessionResponse,
  DesktopAgentStatus,
} from '@ecos-studio/shared'
import type { AgentProviderRuntime } from './agentProviderContract'
import { AgentProviderProcessRuntime } from './agentProviderProcessRuntime'
import {
  discoverAgentProviderManifests,
  type ResolvedAgentProviderManifest,
} from './agentProviderPlugin'
import { AgentRuntimeManager } from './agentRuntimeManager'
import { RuntimeEventFanout } from '../runtime/runtimeEvents'

export const NO_AGENT_PROVIDER_MESSAGE =
  'No agent provider is installed. Drop an agent-provider.json plugin into the agent providers directory to enable the assistant.'

export interface AgentServiceOptions {
  /** Directories scanned for `agent-provider.json` manifests, in priority order. */
  pluginRoots: string[]
  createRuntime?(manifest: ResolvedAgentProviderManifest): AgentProviderRuntime
  discoverManifests?(roots: string[]): Promise<ResolvedAgentProviderManifest[]>
}

/**
 * Owns the lifetime of the agent provider plugins. Discovery is lazy and its result is
 * cached, so a machine with no provider installed pays nothing and still gets a clear
 * status instead of an exception on every keystroke.
 */
export class AgentService {
  private readonly createRuntime: (
    manifest: ResolvedAgentProviderManifest,
  ) => AgentProviderRuntime
  private readonly discoverManifests: (
    roots: string[],
  ) => Promise<ResolvedAgentProviderManifest[]>
  private readonly eventFanout = new RuntimeEventFanout<DesktopAgentEvent>()
  private readonly pluginRoots: string[]
  private manager: AgentRuntimeManager | null = null
  private resolution: Promise<AgentRuntimeManager | null> | null = null

  constructor(options: AgentServiceOptions) {
    this.pluginRoots = options.pluginRoots
    this.createRuntime =
      options.createRuntime ??
      ((manifest) => new AgentProviderProcessRuntime({ manifest }))
    this.discoverManifests = options.discoverManifests ?? discoverAgentProviderManifests
  }

  async getStatus(request?: DesktopAgentProviderRequest): Promise<DesktopAgentStatus> {
    const manager = await this.resolveManager()
    if (!manager) {
      return {
        providerId: request?.providerId ?? 'none',
        state: 'stopped',
        message: NO_AGENT_PROVIDER_MESSAGE,
      }
    }
    return await manager.getStatus(request)
  }

  async startSession(
    request: DesktopAgentStartSessionRequest,
  ): Promise<DesktopAgentStartSessionResponse> {
    return await (await this.requireManager()).startSession(request)
  }

  async sendMessage(
    request: DesktopAgentSendMessageRequest,
  ): Promise<DesktopAgentSendMessageResponse> {
    return await (await this.requireManager()).sendMessage(request)
  }

  async interrupt(request?: DesktopAgentProviderRequest): Promise<void> {
    await (await this.requireManager()).interrupt(request)
  }

  async stop(request?: DesktopAgentProviderRequest): Promise<void> {
    // Stopping something that was never discovered is a no-op, not an error.
    const manager = await this.resolveManager()
    await manager?.stop(request)
  }

  onEvent(listener: (event: DesktopAgentEvent) => void): () => void {
    return this.eventFanout.onEvent(listener)
  }

  private async requireManager(): Promise<AgentRuntimeManager> {
    const manager = await this.resolveManager()
    if (!manager) {
      throw new Error(NO_AGENT_PROVIDER_MESSAGE)
    }
    return manager
  }

  private resolveManager(): Promise<AgentRuntimeManager | null> {
    if (this.manager) return Promise.resolve(this.manager)
    // A failed discovery must not be cached, or a fixed plugin would need an app restart.
    this.resolution ??= this.discoverProviders().catch((error) => {
      this.resolution = null
      throw error
    })
    return this.resolution
  }

  private async discoverProviders(): Promise<AgentRuntimeManager | null> {
    const manifests = await this.discoverManifests(this.pluginRoots)
    if (manifests.length === 0) return null

    const manager = new AgentRuntimeManager({
      providers: manifests.map((manifest) => ({
        providerId: manifest.providerId,
        runtime: this.createRuntime(manifest),
      })),
    })
    manager.onEvent((event) => {
      this.eventFanout.emit(event)
    })
    this.manager = manager
    return manager
  }
}
