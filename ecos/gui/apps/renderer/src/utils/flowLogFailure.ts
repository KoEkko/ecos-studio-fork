const ERROR_LINE =
  /^\s*(?:ERROR|FATAL|\[ERROR\]|\[FATAL\])\b|\berror\b\s*:/i

/**
 * 从日志尾部向前找最后一处 ERROR/FATAL，再向上吞掉紧挨着的连续错误行，
 * 然后从那一块的起点往下取 maxLines 行。报错后面常跟收尾 INFO，单纯取「最后 3 行」
 * 会把真正的 ERROR 顶出视野。
 *
 * 找不到错误时回落为最后 maxLines 行非空内容——运行中的 deck 也走这条路径。
 */
export function extractFailureLines(logText: string, maxLines = 3): string[] {
  const lines = (logText ?? '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
  if (lines.length === 0) return []

  let lastError = -1
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (ERROR_LINE.test(lines[index])) {
      lastError = index
      break
    }
  }

  if (lastError === -1) return lines.slice(-maxLines)

  let start = lastError
  while (start > 0 && ERROR_LINE.test(lines[start - 1])) start -= 1
  return lines.slice(start, start + maxLines)
}

/** 运行中的 deck 只要最新几行；失败时改走 extractFailureLines。 */
export function extractTailLines(logText: string, maxLines = 3): string[] {
  const lines = (logText ?? '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
  if (lines.length === 0) return []
  return lines.slice(-maxLines)
}
