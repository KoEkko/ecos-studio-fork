import { flowPipelineStepTone } from '@/components/flowPipelineBar'
import type { FlowStage } from '@/composables/useFlowStages'
import type { FlowRunStep } from './flowRunStore'

/**
 * flow.json 的 setup 步骤（home / tech / configure）不属于一次运行，run deck 与运行
 * 报告都只关心 run 组。pending 步骤保留下来，报告卡的「完成 7 / 12」需要总数。
 *
 * 状态归一复用 `flowPipelineStepTone`：flow.json 里 Invalid / Incomplete / Imcomplete
 * 三种拼写都表示失败，这套映射只该有一份。
 */
export function toFlowRunSteps(stages: readonly FlowStage[]): FlowRunStep[] {
  return stages
    .filter((stage) => stage.group === 'run')
    .map((stage) => ({
      name: stage.name,
      path: stage.path,
      label: stage.label,
      tool: stage.tool,
      state: flowPipelineStepTone(stage.state),
      runtime: stage.runtime,
      peakMemoryMb: stage['peak memory (mb)'] || 0,
    }))
}
