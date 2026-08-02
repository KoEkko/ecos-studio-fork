import { isDesktopRuntime } from './useDesktopRuntime'
import { STEP_METADATA, getStepMetadata } from '@/api/type'
import { readWorkspaceFlowResourceApi } from '@/api/workspaceResources'
import {
  getFlowStagesObservation,
  type FlowData,
  type FlowStage,
  type FlowStep,
} from './workspace-observation/flowStagesObservation'

export type { FlowData, FlowStage, FlowStep }

/**
 * 将 flow.json 数据转换为 FlowStage 格式（与侧边栏加载逻辑一致）
 */
function transformFlowData(flowData: FlowData): FlowStage[] {
  const stages: FlowStage[] = []
  for (const step of flowData.steps) {
    const metadata = getStepMetadata(step.name)
    stages.push({
      label: metadata?.label ?? step.name,
      path: metadata?.path ?? step.name,
      icon: metadata?.icon ?? 'ri-checkbox-blank-circle-line',
      group: 'run',
      state: step.state,
      runtime: step.runtime || '',
      'peak memory (mb)': step['peak memory (mb)'] || 0,
      name: step.name,
      tool: step.tool ?? '',
    })
  }
  return stages
}

function fallbackRunStepKeys(): string[] {
  return Object.values(STEP_METADATA)
    .filter((m) => m.group === 'run')
    .map((m) => m.path)
}

/**
 * 从工程读取 flow.json，返回全部 run 步骤的 path（用作路由 stepKey）。
 * 读取失败时回退为 STEP_METADATA 中 `group === 'run'` 的全集。
 */
export async function loadFlowRunStepKeysFromProject(
  projectPath: string,
): Promise<string[]> {
  if (!isDesktopRuntime() || !projectPath) {
    return fallbackRunStepKeys()
  }
  try {
    const flowData = (await readWorkspaceFlowResourceApi()) as FlowData | null
    if (!flowData) return fallbackRunStepKeys()
    const stages = transformFlowData(flowData)
    return stages.map((s) => s.path)
  } catch (e) {
    console.warn('[loadFlowRunStepKeysFromProject]', e)
    return fallbackRunStepKeys()
  }
}

/**
 * 流程阶段 facade：状态与 flow.json watch 由 workspace-observation 单例持有。
 * 多次调用共享同一份 stages；组件卸载不会拆掉观测。
 */
export function useFlowStages() {
  return getFlowStagesObservation()
}
