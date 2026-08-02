import { computed } from 'vue'
import { useRoute } from 'vue-router'

export interface WorkspaceStageFlags {
  /**
   * Whether the sidebar's subflow column is shown. Home drives the whole flow from its
   * own pipeline bar, and the setup pages have no flow, so only a flow step needs it.
   */
  showProgressPanel: boolean
  isHome: boolean
  isConfigure: boolean
  isTech: boolean
  isFlowStep: boolean
}

export function getWorkspaceStageFlags(stage: string): WorkspaceStageFlags {
  const isHome = stage === 'home'
  const isConfigure = stage === 'configure'
  const isTech = stage === 'tech'
  const isWorkspaceTool = isConfigure || isTech
  const isFlowStep = !isHome && !isWorkspaceTool

  return {
    showProgressPanel: isFlowStep,
    isHome,
    isConfigure,
    isTech,
    isFlowStep,
  }
}

// ============ Composable ============

/**
 * 当前阶段管理 Hook
 * 负责解析和管理当前路由对应的流程阶段
 */
export function useCurrentStage() {
  const route = useRoute()

  /** 当前阶段路径 */
  const currentStage = computed(() => {
    const pathParts = route.path.split('/')
    return pathParts[pathParts.length - 1] || 'home'
  })

  /** 是否显示子流程面板 (仅流程步骤页面显示) */
  const showProgressPanel = computed(() => {
    return getWorkspaceStageFlags(currentStage.value).showProgressPanel
  })

  /** 是否在首页 */
  const isHome = computed(() => getWorkspaceStageFlags(currentStage.value).isHome)

  /** 是否在配置页 */
  const isConfigure = computed(
    () => getWorkspaceStageFlags(currentStage.value).isConfigure,
  )

  /** 是否在 Tech Library 页 */
  const isTech = computed(() => getWorkspaceStageFlags(currentStage.value).isTech)

  /** 是否在流程步骤页面 */
  const isFlowStep = computed(() => {
    return getWorkspaceStageFlags(currentStage.value).isFlowStep
  })

  /**
   * 获取阶段的完整路由路径
   */
  function getStagePath(stagePath: string): string {
    return `/workspace/${stagePath}`
  }

  /**
   * 检查指定阶段是否为当前阶段
   */
  function isCurrentStage(stagePath: string): boolean {
    return currentStage.value === stagePath
  }

  return {
    // 状态
    currentStage,
    showProgressPanel,
    isHome,
    isConfigure,
    isTech,
    isFlowStep,

    // 方法
    getStagePath,
    isCurrentStage,
  }
}
