import type { DesktopAgentEvent } from '@ecos-studio/shared'

export type AgentTurnStatus = 'streaming' | 'done' | 'error'

export interface AgentUserEntry {
  kind: 'user'
  id: string
  text: string
  createdAt: number
}

export interface AgentAssistantEntry {
  kind: 'assistant'
  id: string
  text: string
  status: AgentTurnStatus
  createdAt: number
}

export interface AgentToolEntry {
  kind: 'tool'
  id: string
  text: string
  createdAt: number
}

/**
 * 只有对话。flow 的运行记录住在 `flowRunStore`，由 Home 的 feed 按时间戳与对话
 * 合并渲染；step 页的聊天面板只渲染这里的条目。
 */
export type AgentTimelineEntry =
  | AgentUserEntry
  | AgentAssistantEntry
  | AgentToolEntry

export type AgentClock = () => number

const systemClock: AgentClock = () => Date.now()

export function isAgentTurnPending(entries: readonly AgentTimelineEntry[]): boolean {
  return entries.some(
    (entry) => entry.kind === 'assistant' && entry.status === 'streaming',
  )
}

function lastStreamingAssistantIndex(entries: readonly AgentTimelineEntry[]): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]
    if (entry.kind === 'assistant' && entry.status === 'streaming') return index
  }
  return -1
}

function replaceAt(
  entries: readonly AgentTimelineEntry[],
  index: number,
  entry: AgentTimelineEntry,
): AgentTimelineEntry[] {
  const next = entries.slice()
  next[index] = entry
  return next
}

/**
 * 折入一条 provider 事件。文本是分块到达的，所以 `message` 事件延长仍然开着的那轮
 * 对话，而不是另起一个气泡。
 */
export function applyAgentEvent(
  entries: readonly AgentTimelineEntry[],
  event: DesktopAgentEvent,
  nextId: () => string,
  now: AgentClock = systemClock,
): AgentTimelineEntry[] {
  const openIndex = lastStreamingAssistantIndex(entries)

  if (event.type === 'message') {
    const text = event.text ?? ''
    if (!text) return entries.slice()
    if (openIndex === -1) {
      return [
        ...entries,
        { kind: 'assistant', id: nextId(), text, status: 'streaming', createdAt: now() },
      ]
    }
    const open = entries[openIndex] as AgentAssistantEntry
    return replaceAt(entries, openIndex, { ...open, text: open.text + text })
  }

  if (event.type === 'tool') {
    const text = event.text ?? ''
    if (!text) return entries.slice()
    return [...entries, { kind: 'tool', id: nextId(), text, createdAt: now() }]
  }

  if (event.type === 'error') {
    const text = event.text ?? 'The agent reported an error.'
    if (openIndex === -1) {
      return [
        ...entries,
        { kind: 'assistant', id: nextId(), text, status: 'error', createdAt: now() },
      ]
    }
    const open = entries[openIndex] as AgentAssistantEntry
    return replaceAt(entries, openIndex, {
      ...open,
      text: open.text ? `${open.text}\n${text}` : text,
      status: 'error',
    })
  }

  return entries.slice()
}

/** Closes the open turn once the provider stops producing output for it. */
export function completeAgentTurn(
  entries: readonly AgentTimelineEntry[],
  fallbackText?: string,
): AgentTimelineEntry[] {
  const openIndex = lastStreamingAssistantIndex(entries)
  if (openIndex === -1) return entries.slice()
  const open = entries[openIndex] as AgentAssistantEntry
  return replaceAt(entries, openIndex, {
    ...open,
    text: open.text || (fallbackText ?? ''),
    status: 'done',
  })
}

export function failAgentTurn(
  entries: readonly AgentTimelineEntry[],
  message: string,
  nextId: () => string,
  now: AgentClock = systemClock,
): AgentTimelineEntry[] {
  const openIndex = lastStreamingAssistantIndex(entries)
  if (openIndex === -1) {
    return [
      ...entries,
      { kind: 'assistant', id: nextId(), text: message, status: 'error', createdAt: now() },
    ]
  }
  const open = entries[openIndex] as AgentAssistantEntry
  return replaceAt(entries, openIndex, {
    ...open,
    text: open.text ? `${open.text}\n${message}` : message,
    status: 'error',
  })
}
