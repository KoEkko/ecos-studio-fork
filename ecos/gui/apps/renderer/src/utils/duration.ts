/**
 * flow.json 的 runtime 字段格式是 `HH:MM:SS`。解析失败返回 null 而不抛，因为一个
 * 步骤的时间字段损坏不应该让整张运行报告渲染不出来。
 */
export function parseFlowRuntimeSeconds(
  runtime: string | undefined | null,
): number | null {
  if (typeof runtime !== 'string') return null
  const parts = runtime.split(':')
  if (parts.length !== 3) return null
  const numericParts = parts.map((part) =>
    part.trim() === '' ? Number.NaN : Number(part),
  )
  if (!numericParts.every(Number.isFinite)) return null
  return numericParts[0] * 3600 + numericParts[1] * 60 + numericParts[2]
}

export interface FlowRuntimeSum {
  seconds: number
  /** 至少有一个步骤给出了可解析的 runtime，否则调用方应把总时长视为未知。 */
  hasValue: boolean
}

export function sumFlowRuntimeSeconds(
  runtimes: readonly (string | undefined | null)[],
): FlowRuntimeSum {
  let seconds = 0
  let hasValue = false
  for (const runtime of runtimes) {
    const parsed = parseFlowRuntimeSeconds(runtime)
    if (parsed === null) continue
    seconds += parsed
    hasValue = true
  }
  return { seconds, hasValue }
}

export function formatDurationSeconds(seconds: number): string {
  const total = Math.max(0, seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${rest}s`
  return `${rest}s`
}

export function formatElapsedMs(ms: number): string {
  return formatDurationSeconds(Math.floor(Math.max(0, ms) / 1000))
}

/** 峰值内存未知或为零时返回空串，让调用方直接省略这一列而不是显示 "0 MB"。 */
export function formatPeakMemory(mb: number | undefined | null): string {
  if (typeof mb !== 'number' || !Number.isFinite(mb) || mb <= 0) return ''
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${Math.round(mb)} MB`
}
