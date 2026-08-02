import { parseFlowRuntimeSeconds, sumFlowRuntimeSeconds } from '@/utils/duration'
import type { FlowStage } from '@/composables/useFlowStages'
import { toFlowRunSteps } from './flowRunSteps'
import {
  resolveFlowRunState,
  type FlowRunRecord,
  type FlowRunState,
  type FlowRunStep,
} from './flowRunStore'

export interface FlowRunCounts {
  done: number
  total: number
}

export function flowRunCounts(steps: readonly FlowRunStep[]): FlowRunCounts {
  return {
    done: steps.filter((step) => step.state === 'success').length,
    total: steps.length,
  }
}

export function runningFlowRunStep(steps: readonly FlowRunStep[]): FlowRunStep | null {
  return steps.find((step) => step.state === 'running') ?? null
}

export function failedFlowRunStep(steps: readonly FlowRunStep[]): FlowRunStep | null {
  return steps.find((step) => step.state === 'failed') ?? null
}

/**
 * deck 上当前该盯的那一步：有 running 就盯 running，绝不让残留的 failed 抢戏。
 * 只有没有 running 时，失败步骤才接管（流程卡在错误上）。
 */
export function deckFocusStep(steps: readonly FlowRunStep[]): {
  step: FlowRunStep | null
  mode: 'running' | 'failed' | 'starting'
} {
  const running = runningFlowRunStep(steps)
  if (running) return { step: running, mode: 'running' }
  const failed = failedFlowRunStep(steps)
  if (failed) return { step: failed, mode: 'failed' }
  return { step: null, mode: 'starting' }
}

/** 耗时最长的步骤。没有任何可解析的 runtime 时返回 null，报告卡则省略这一行。 */
export function slowestFlowRunStep(steps: readonly FlowRunStep[]): FlowRunStep | null {
  let slowest: FlowRunStep | null = null
  let slowestSeconds = -1
  for (const step of steps) {
    const seconds = parseFlowRuntimeSeconds(step.runtime)
    if (seconds === null || seconds <= slowestSeconds) continue
    slowest = step
    slowestSeconds = seconds
  }
  return slowest
}

/**
 * 墙钟耗时。运行中的记录按当前时刻算，所以 deck 上的数字每秒都在走。
 * 注意不要用各步 runtime 之和代替：那是 CPU 时间，不含步骤之间的等待。
 */
export function flowRunElapsedMs(run: FlowRunRecord, now: number): number {
  return Math.max(0, (run.finishedAt ?? now) - run.startedAt)
}

export function flowRunStepElapsedMs(step: FlowRunStep, now: number): number | null {
  if (step.startedAt === undefined) return null
  return Math.max(0, now - step.startedAt)
}

/**
 * 从磁盘上的 flow.json 状态重建的报告。它描述的是既有状态，不声称发生在何时，
 * 所以只有各步 runtime 之和，没有墙钟耗时，也没有 trigger。
 */
export interface FlowRunSnapshot {
  steps: FlowRunStep[]
  state: FlowRunState
  stepRuntimeSeconds: number | null
}

/** 一步都没跑过的工程没有什么可报告的，返回 null 让界面回到空状态。 */
export function toFlowRunSnapshot(stages: readonly FlowStage[]): FlowRunSnapshot | null {
  const steps = toFlowRunSteps(stages)
  if (!steps.some((step) => step.state !== 'pending')) return null
  const sum = sumFlowRuntimeSeconds(steps.map((step) => step.runtime))
  return {
    steps,
    state: resolveFlowRunState(steps),
    stepRuntimeSeconds: sum.hasValue ? sum.seconds : null,
  }
}

/** 报告卡渲染所需的全部事实。真实运行与磁盘快照归一到同一个形状。 */
export interface FlowRunReportView {
  title: string
  state: FlowRunState
  durationSeconds: number | null
  /**
   * true 表示 durationSeconds 是各步 runtime 之和而不是墙钟耗时。快照没有真实起止
   * 时刻，把 CPU 时间之和标成「用了多久」会骗人，所以卡上的措辞要跟着变。
   */
  durationIsStepSum: boolean
  done: number
  total: number
  failedStep: FlowRunStep | null
  slowestStep: FlowRunStep | null
  steps: FlowRunStep[]
  rerun: boolean
  /** 别处触发的运行，本次会话不知道它的参数。 */
  external: boolean
  fromDisk: boolean
  /** 失败步骤日志里抽到的错误行；没有时为空。 */
  failureLines: string[]
}

export function flowRunReportView(run: FlowRunRecord): FlowRunReportView {
  const counts = flowRunCounts(run.steps)
  const wallClockMs =
    run.finishedAt === undefined ? null : Math.max(0, run.finishedAt - run.startedAt)
  return {
    title: run.scope === 'step' ? (run.steps[0]?.label ?? 'Step') : 'Flow',
    state: run.state,
    durationSeconds: wallClockMs === null ? null : Math.floor(wallClockMs / 1000),
    durationIsStepSum: false,
    done: counts.done,
    total: counts.total,
    failedStep: failedFlowRunStep(run.steps),
    slowestStep: slowestFlowRunStep(run.steps),
    steps: run.steps,
    rerun: run.rerun,
    external: run.trigger === 'external',
    fromDisk: false,
    failureLines: run.failure?.lines ?? [],
  }
}

export function flowRunSnapshotReportView(snapshot: FlowRunSnapshot): FlowRunReportView {
  const counts = flowRunCounts(snapshot.steps)
  return {
    title: 'Flow',
    state: snapshot.state,
    durationSeconds: snapshot.stepRuntimeSeconds,
    durationIsStepSum: true,
    done: counts.done,
    total: counts.total,
    failedStep: failedFlowRunStep(snapshot.steps),
    slowestStep: slowestFlowRunStep(snapshot.steps),
    steps: snapshot.steps,
    rerun: false,
    external: false,
    fromDisk: true,
    failureLines: [],
  }
}
