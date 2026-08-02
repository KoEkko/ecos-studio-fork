import type { AgentTimelineEntry } from './agentTimeline'
import type { FlowRunRecord } from './flowRunStore'
import type { FlowRunSnapshot } from './flowRunReport'

export type AgentFeedItem =
  | { kind: 'message'; id: string; at: number; entry: AgentTimelineEntry }
  | { kind: 'run'; id: string; at: number; run: FlowRunRecord }
  | { kind: 'snapshot'; id: string; at: number; snapshot: FlowRunSnapshot }

export const AGENT_FEED_SNAPSHOT_ID = 'flow-snapshot'

/**
 * 把对话与运行报告按时间穿插成一条 feed。
 *
 * 两条约束值得说明：
 * - 正在跑的那条记录不进 feed。它归置顶的 run deck，同时出现在两处只会让人以为
 *   有两次运行。运行中的步骤进度也在 deck 的进度轨里，不再叠 snapshot 卡片。
 * - 磁盘快照只在一条运行报告都没有时出现。有真实记录之后再摆一张「工程当前状态」
 *   就成了重复叙述，而且它没有时间，摆在真实记录之间会撒谎。
 *   live run 期间快照仍可保留：它跟着 flow.json 刷新，状态必须是 running 而不是 failed。
 */
export function mergeAgentFeed(
  entries: readonly AgentTimelineEntry[],
  runs: readonly FlowRunRecord[],
  snapshot: FlowRunSnapshot | null,
): AgentFeedItem[] {
  const settledRuns = runs.filter((run) => run.state !== 'running')
  const hasActiveRun = runs.some((run) => run.state === 'running')
  const items: AgentFeedItem[] = []

  // 运行中的进度由顶部的 LiveBlock（监控焦点 + 进度轨）承担，feed 里不再叠 snapshot。
  if (snapshot && settledRuns.length === 0 && !hasActiveRun) {
    items.push({ kind: 'snapshot', id: AGENT_FEED_SNAPSHOT_ID, at: 0, snapshot })
  }
  for (const entry of entries) {
    items.push({ kind: 'message', id: entry.id, at: entry.createdAt, entry })
  }
  for (const run of settledRuns) {
    items.push({ kind: 'run', id: run.id, at: run.startedAt, run })
  }

  // sort 是稳定的，所以同一毫秒里消息排在它引发的运行之前。
  return items.sort((a, b) => a.at - b.at)
}
