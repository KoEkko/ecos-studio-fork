export type AgentSlashCommand =
  | { kind: 'run'; rerun: boolean; step?: string }
  | { kind: 'log'; step: string }
  | { kind: 'qor' }
  | { kind: 'clear' }
  | { kind: 'unknown'; input: string }

function normalizeStepToken(token: string): string {
  return token.trim().toLowerCase()
}

function matchKnownStep(
  token: string,
  knownSteps: readonly string[],
): string | undefined {
  const wanted = normalizeStepToken(token)
  if (!wanted) return undefined
  return knownSteps.find((step) => normalizeStepToken(step) === wanted)
}

/**
 * 返回 null 表示这不是命令，应按普通消息发送。
 * 未知命令返回 `{ kind: 'unknown' }`，让调用方决定是报错还是原样发送。
 */
export function parseSlashCommand(
  input: string,
  knownSteps: readonly string[] = [],
): AgentSlashCommand | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null

  const body = trimmed.slice(1).trim()
  if (!body) return { kind: 'unknown', input: trimmed }

  const [rawHead, ...rest] = body.split(/\s+/)
  const head = rawHead.toLowerCase()
  const arg = rest.join(' ').trim()

  if (head === 'clear') return { kind: 'clear' }
  if (head === 'qor') return { kind: 'qor' }

  if (head === 'run' || head === 'rerun') {
    if (!arg) return { kind: 'run', rerun: head === 'rerun' }
    const step = matchKnownStep(arg, knownSteps) ?? arg
    return { kind: 'run', rerun: head === 'rerun', step }
  }

  if (head === 'log') {
    if (!arg) return { kind: 'unknown', input: trimmed }
    const step = matchKnownStep(arg, knownSteps) ?? arg
    return { kind: 'log', step }
  }

  return { kind: 'unknown', input: trimmed }
}

export interface SlashSuggestion {
  command: string
  description: string
}

export const SLASH_COMMAND_SUGGESTIONS: readonly SlashSuggestion[] = [
  { command: '/run', description: 'Run the full RTL2GDS flow' },
  { command: '/rerun', description: 'Discard previous results and run again' },
  { command: '/run <step>', description: 'Run a single flow step' },
  { command: '/log <step>', description: 'Open a step log in the bottom panel' },
  { command: '/qor', description: 'Open the QoR details panel' },
  { command: '/clear', description: 'Clear the conversation' },
]

/** 输入框以 `/` 开头时，按前缀过滤命令建议。 */
export function filterSlashSuggestions(prefix: string): SlashSuggestion[] {
  const needle = prefix.trim().toLowerCase()
  if (!needle.startsWith('/')) return []
  return SLASH_COMMAND_SUGGESTIONS.filter((item) =>
    item.command.toLowerCase().startsWith(needle.split(/\s/)[0] ?? needle),
  )
}
