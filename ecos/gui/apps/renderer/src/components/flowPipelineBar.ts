import type { FlowStage } from '@/composables/useFlowStages'

export type FlowPipelineStepTone = 'success' | 'running' | 'failed' | 'pending'

export interface FlowPipelineStep {
  /** Route segment, also the identity used for `v-for` and navigation. */
  path: string
  label: string
  /** flow.json step name, needed together with `tool` to open the step's log. */
  name: string
  tool: string
  state: string
  runtime: string
  tone: FlowPipelineStepTone
  /** True once the step produced a log worth opening. */
  hasLog: boolean
}

export interface FlowPipelineProgress {
  total: number
  done: number
  /** 0-100. Zero when there are no run steps, so the bar renders empty rather than NaN. */
  percent: number
}

export function flowPipelineStepTone(state: string): FlowPipelineStepTone {
  switch ((state ?? '').trim().toLowerCase()) {
    case 'success':
    case 'passed':
      return 'success'
    case 'ongoing':
    case 'running':
      return 'running'
    case 'invalid':
    case 'incomplete':
    case 'imcomplete':
    case 'failed':
      return 'failed'
    default:
      return 'pending'
  }
}

export function toFlowPipelineSteps(stages: readonly FlowStage[]): FlowPipelineStep[] {
  return stages
    .filter((stage) => stage.group === 'run')
    .map((stage) => {
      const tone = flowPipelineStepTone(stage.state)
      return {
        path: stage.path,
        label: stage.label,
        name: stage.name,
        tool: stage.tool,
        state: stage.state,
        runtime: stage.runtime,
        tone,
        // An unstarted step has no log file yet, so linking there would dead-end.
        hasLog: Boolean(stage.tool) && tone !== 'pending',
      }
    })
}

export function flowPipelineProgress(
  steps: readonly FlowPipelineStep[],
): FlowPipelineProgress {
  const done = steps.filter((step) => step.tone === 'success').length
  return {
    total: steps.length,
    done,
    percent: steps.length === 0 ? 0 : Math.round((done / steps.length) * 100),
  }
}
