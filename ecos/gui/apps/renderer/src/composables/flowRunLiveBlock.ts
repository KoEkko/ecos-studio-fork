import {
  deckFocusStep,
  flowRunElapsedMs,
  flowRunStepElapsedMs,
} from '@/composables/flowRunReport'
import type { FlowRunRecord, FlowRunStep } from '@/composables/flowRunStore'
import { formatElapsedMs } from '@/utils/duration'
import { extractFailureLines, extractTailLines } from '@/utils/flowLogFailure'

export type LiveBlockMode = 'starting' | 'running' | 'failed'

export interface FlowRunLiveView {
  mode: LiveBlockMode
  focusStep: FlowRunStep | null
  headline: string
  timeLabel: string
  previewLine: string
  logLines: string[]
  canExpand: boolean
  canOpenLog: boolean
  tag: 'rerun' | 'elsewhere' | null
}

const ERROR_LINE =
  /^\s*(?:ERROR|FATAL|\[ERROR\]|\[FATAL\])\b|\berror\b\s*:/i

export function liveBlockLineIsError(line: string): boolean {
  return ERROR_LINE.test(line)
}

/**
 * LiveBlock 摘要行：主视角是「跑什么 / 哪一步 / 什么状态」，不是 log。
 * full 范围带 Flow 前缀；单步运行直接写步骤名。
 */
export function liveBlockHeadline(
  run: Pick<FlowRunRecord, 'scope'>,
  mode: LiveBlockMode,
  step: FlowRunStep | null,
): string {
  const stepLabel = step?.label
  const tool = step?.tool
  const isStepScope = run.scope === 'step'

  if (mode === 'starting') {
    if (isStepScope && stepLabel) return `Initializing ${stepLabel}`
    return 'Initializing Flow'
  }

  if (!stepLabel) return isStepScope ? 'Initializing' : 'Initializing Flow'

  const failedSuffix = mode === 'failed' ? ' failed' : ''
  const toolSuffix = tool ? ` · ${tool}` : ''

  if (isStepScope) return `${stepLabel}${failedSuffix}${toolSuffix}`
  return `Flow · ${stepLabel}${failedSuffix}${toolSuffix}`
}

/** `Step 42s · Run 3m 26s`；Starting 或本步无 startedAt 时省略 Step。 */
export function liveBlockTimeLabel(
  stepElapsed: string,
  totalElapsed: string,
  mode: LiveBlockMode,
): string {
  if (mode === 'starting' || !stepElapsed) return `Run ${totalElapsed}`
  return `Step ${stepElapsed} · Run ${totalElapsed}`
}

export function liveBlockPreviewHint(
  mode: LiveBlockMode,
  step: FlowRunStep | null,
): string {
  if (mode === 'starting' || !step) return 'Waiting for first step output…'
  if (step.tool) return `Waiting for ${step.label} output from ${step.tool}…`
  return `Waiting for ${step.label} output…`
}

export function toFlowRunLiveView(
  run: FlowRunRecord,
  logText: string,
  now: number,
): FlowRunLiveView {
  const focus = deckFocusStep(run.steps)
  const mode = focus.mode
  const focusStep = focus.step
  const totalElapsed = formatElapsedMs(flowRunElapsedMs(run, now))
  const stepMs = focusStep ? flowRunStepElapsedMs(focusStep, now) : null
  const stepElapsed = stepMs === null ? '' : formatElapsedMs(stepMs)

  const logLines =
    mode === 'failed'
      ? extractFailureLines(logText, 5)
      : extractTailLines(logText, 4)

  const previewLine =
    logLines.length > 0
      ? logLines[logLines.length - 1]
      : liveBlockPreviewHint(mode, focusStep)

  let tag: FlowRunLiveView['tag'] = null
  if (run.rerun) tag = 'rerun'
  else if (run.trigger === 'external') tag = 'elsewhere'

  return {
    mode,
    focusStep,
    headline: liveBlockHeadline(run, mode, focusStep),
    timeLabel: liveBlockTimeLabel(stepElapsed, totalElapsed, mode),
    previewLine,
    logLines,
    canExpand: mode === 'running' && logLines.length > 0,
    canOpenLog: Boolean(focusStep?.tool),
    tag,
  }
}
