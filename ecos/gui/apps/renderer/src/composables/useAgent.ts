import { computed, ref, watch } from 'vue'
import type { DesktopAgentEvent, DesktopAgentStatus } from '@ecos-studio/shared'
import { getOptionalDesktopApi } from '@/platform/desktop'
import { useWorkspace } from '@/composables/useWorkspace'
import {
  applyAgentEvent,
  completeAgentTurn,
  failAgentTurn,
  isAgentTurnPending,
  type AgentTimelineEntry,
} from './agentTimeline'

export const AGENT_UNAVAILABLE_MESSAGE =
  'The assistant is only available in the ECOS Studio desktop runtime.'

const entries = ref<AgentTimelineEntry[]>([])
const status = ref<DesktopAgentStatus | null>(null)
const isSending = ref(false)
let sessionId: string | null = null
let sessionDirectory = ''
let unsubscribe: (() => void) | null = null
let entryCounter = 0

function nextEntryId(): string {
  entryCounter += 1
  return `agent-${entryCounter}`
}

function resetTranscript(): void {
  entries.value = []
  sessionId = null
  sessionDirectory = ''
  status.value = null
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

export function useAgent() {
  const { currentProject } = useWorkspace()
  const workspacePath = computed(() => currentProject.value?.path ?? '')

  const isAvailable = computed(() => getOptionalDesktopApi()?.agent != null)
  const isBusy = computed(() => isSending.value || isAgentTurnPending(entries.value))
  const statusMessage = computed(() => status.value?.message ?? '')
  const isReady = computed(
    () => status.value?.state === 'ready' || status.value?.state === 'running',
  )

  function handleEvent(event: DesktopAgentEvent): void {
    // Another window's session shares the broadcast channel, so ignore foreign turns.
    if (event.sessionId && sessionId && event.sessionId !== sessionId) return
    entries.value = applyAgentEvent(entries.value, event, nextEntryId)
  }

  function ensureSubscribed(): void {
    if (unsubscribe) return
    const agent = getOptionalDesktopApi()?.agent
    if (!agent) return
    unsubscribe = agent.onEvent(handleEvent)
  }

  async function refreshStatus(): Promise<void> {
    const agent = getOptionalDesktopApi()?.agent
    if (!agent) {
      status.value = null
      return
    }
    ensureSubscribed()
    try {
      status.value = await agent.getStatus()
    } catch (cause) {
      status.value = {
        providerId: 'unknown',
        state: 'error',
        message: errorMessage(cause),
      }
    }
  }

  async function ensureSession(): Promise<string> {
    const agent = getOptionalDesktopApi()?.agent
    if (!agent) throw new Error(AGENT_UNAVAILABLE_MESSAGE)
    const directory = workspacePath.value
    if (sessionId && sessionDirectory === directory) return sessionId

    const response = await agent.startSession(directory ? { directory } : {})
    sessionId = response.sessionId
    sessionDirectory = directory
    return sessionId
  }

  async function send(text: string): Promise<void> {
    const message = text.trim()
    if (!message || isBusy.value) return

    const createdAt = Date.now()
    entries.value = [
      ...entries.value,
      { kind: 'user', id: nextEntryId(), text: message, createdAt },
      { kind: 'assistant', id: nextEntryId(), text: '', status: 'streaming', createdAt },
    ]
    isSending.value = true

    try {
      ensureSubscribed()
      const session = await ensureSession()
      const response = await getOptionalDesktopApi()!.agent.sendMessage({
        message,
        sessionId: session,
      })
      // Providers that answer in one shot never emit message events; use the reply.
      entries.value = completeAgentTurn(entries.value, response.text)
    } catch (cause) {
      entries.value = failAgentTurn(entries.value, errorMessage(cause), nextEntryId)
    } finally {
      isSending.value = false
      void refreshStatus()
    }
  }

  async function interrupt(): Promise<void> {
    const agent = getOptionalDesktopApi()?.agent
    if (!agent) return
    try {
      await agent.interrupt()
    } finally {
      entries.value = completeAgentTurn(entries.value)
      isSending.value = false
    }
  }

  function clear(): void {
    entries.value = []
  }

  // A different workspace is a different conversation; nothing should carry over.
  watch(workspacePath, (path, previousPath) => {
    if (path === previousPath) return
    resetTranscript()
    void refreshStatus()
  })

  return {
    entries,
    status,
    statusMessage,
    isAvailable,
    isBusy,
    isReady,
    send,
    interrupt,
    clear,
    refreshStatus,
  }
}
