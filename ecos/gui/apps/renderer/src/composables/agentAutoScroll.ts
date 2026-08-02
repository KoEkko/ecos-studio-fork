/**
 * 离底多少像素以内仍算「贴着底」。给得比一行高，否则一次流式增量就能把用户
 * 甩出粘附状态，跟随随即失效。
 */
export const STICK_THRESHOLD_PX = 48

export function shouldStickToBottom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  threshold: number = STICK_THRESHOLD_PX,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold
}
