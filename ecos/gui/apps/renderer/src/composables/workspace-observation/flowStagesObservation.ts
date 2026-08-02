import { computed, effectScope, ref, watch, type ComputedRef, type Ref } from 'vue'
import { STEP_METADATA, getStepMetadata } from '@/api/type'
import {
  readWorkspaceFlowResourceApi,
  readWorkspaceHomeResourceApi,
} from '@/api/workspaceResources'
import { convertRemoteToLocalPath } from '@/composables/useHomeData'
import { useDesktopRuntime } from '@/composables/useDesktopRuntime'
import {
  consumePendingHomeRunArtifactReset,
  isHomeRunArtifactResetPending,
  onHomeRunArtifactReset,
} from '@/composables/homeRunArtifacts'
import { useWorkspace } from '@/composables/useWorkspace'
import { useWorkspaceLifecycle } from '@/composables/useWorkspaceLifecycle'
import { readProjectTextFile, watchProjectFile } from '@/utils/projectFiles'
import { resolveProjectPathAccess } from '@/utils/projectFs'

/** flow.json 中的步骤数据结构 */
export interface FlowStep {
  name: string
  tool: string
  state: string
  runtime: string
  'peak memory (mb)': number
  info: Record<string, any>
}

/** flow.json 数据结构 */
export interface FlowData {
  steps: FlowStep[]
}

/** 流程阶段配置 */
export interface FlowStage {
  label: string
  path: string
  icon: string
  group: 'setup' | 'run'
  state: string
  runtime: string
  'peak memory (mb)': number
  /** flow.json 的原始 step 名；setup 步骤没有对应条目时与 label 相同 */
  name: string
  /** flow.json 的原始 tool 名；与 name 一起构成 flow log 的 step key */
  tool: string
}

const FIXED_SETUP_STAGES: FlowStage[] = Object.entries(STEP_METADATA)
  .filter(([_, meta]) => meta.group === 'setup' && meta.showInSidebar)
  .map(([_, meta]) => ({
    label: meta.label,
    path: meta.path,
    icon: meta.icon,
    group: 'setup' as const,
    state: 'pending',
    runtime: '',
    'peak memory (mb)': 0,
    name: meta.label,
    tool: '',
  }))

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

function flowDataHasStartedRun(flowData: FlowData): boolean {
  return flowData.steps.some((step) => {
    const state = (step.state ?? '').trim().toLowerCase()
    return (
      state === 'ongoing' ||
      state === 'running' ||
      state === 'unstart' ||
      state === 'pending'
    )
  })
}

function normalizeProjectPath(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/')
  return normalized.length > 1 && normalized.endsWith('/')
    ? normalized.slice(0, -1)
    : normalized
}

const dynamicFlowStages = ref<FlowStage[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const flowStages = computed<FlowStage[]>(() => [
  ...FIXED_SETUP_STAGES,
  ...dynamicFlowStages.value,
])
const hasOngoingRunStage = computed(() =>
  dynamicFlowStages.value.some(
    (stage) => stage.state === 'Ongoing' || stage.state === 'running',
  ),
)

let bound = false
let unwatchFlowJsonFile: (() => void) | null = null
let unregisterFlowJsonLifecycleCleanup: (() => void) | null = null
let unregisterHomeRunArtifactReset: (() => void) | null = null
let pendingRerunFlowStartProjectPath = ''
let watchSession = 0
/** Detached：不被任意组件 effectScope.stop() 拆掉。 */
let flowStagesObservationScope = effectScope(true)

function cleanupFlowJsonWatch(): void {
  unregisterFlowJsonLifecycleCleanup?.()
  unregisterFlowJsonLifecycleCleanup = null
  unwatchFlowJsonFile?.()
  unwatchFlowJsonFile = null
}

function resetRunStagesForRerun(): void {
  if (dynamicFlowStages.value.length === 0) return
  dynamicFlowStages.value = dynamicFlowStages.value.map((stage) => ({
    ...stage,
    state: 'Unstart',
    runtime: '',
    'peak memory (mb)': 0,
  }))
}

function shouldApplyFlowData(flowData: FlowData): boolean {
  const { currentProject } = useWorkspace()
  const projectPath = currentProject.value?.path
  if (!projectPath) return true
  const normalizedProjectPath = normalizeProjectPath(projectPath)
  const resetPending =
    pendingRerunFlowStartProjectPath === normalizedProjectPath ||
    isHomeRunArtifactResetPending(projectPath)
  if (!resetPending) return true
  if (!flowDataHasStartedRun(flowData)) return false
  pendingRerunFlowStartProjectPath = ''
  consumePendingHomeRunArtifactReset(projectPath)
  return true
}

async function loadFlowStagesFromPath(flowJsonPath: string): Promise<void> {
  const { isDesktopRuntimeAvailable } = useDesktopRuntime()
  const workspaceLifecycle = useWorkspaceLifecycle()
  const { currentProject } = useWorkspace()

  if (!isDesktopRuntimeAvailable || !flowJsonPath) {
    console.warn('Cannot load flow.json: desktop bridge unavailable or path is empty')
    return
  }

  const sessionId = workspaceLifecycle.currentSessionId.value
  const isCurrent = () => workspaceLifecycle.isCurrentSession(sessionId)
  isLoading.value = true
  error.value = null

  try {
    const projectPath = currentProject.value?.path
    const localPath = projectPath
      ? convertRemoteToLocalPath(flowJsonPath, projectPath)
      : flowJsonPath
    const resolvedPath = await workspaceLifecycle.runForSession(sessionId, () =>
      resolveProjectPathAccess(localPath),
    )
    if (!isCurrent()) return
    if (!resolvedPath) return

    const fileContent = await workspaceLifecycle.runForSession(sessionId, () =>
      readProjectTextFile(resolvedPath),
    )
    if (!isCurrent() || fileContent === undefined) return
    const flowData: FlowData = JSON.parse(fileContent)
    if (!shouldApplyFlowData(flowData)) return

    dynamicFlowStages.value = transformFlowData(flowData)
  } catch (err) {
    if (!isCurrent()) return
    console.error('Failed to load flow.json from path:', flowJsonPath, err)
    error.value = err instanceof Error ? err.message : String(err)
    dynamicFlowStages.value = []
  } finally {
    if (isCurrent()) isLoading.value = false
  }
}

async function loadFlowStages(): Promise<void> {
  const { isDesktopRuntimeAvailable } = useDesktopRuntime()
  const workspaceLifecycle = useWorkspaceLifecycle()
  const { currentProject } = useWorkspace()

  if (!isDesktopRuntimeAvailable || !currentProject.value?.path) {
    console.warn(
      'Cannot load flow.json: desktop bridge unavailable or no project is open',
    )
    dynamicFlowStages.value = []
    return
  }

  const sessionId = workspaceLifecycle.currentSessionId.value
  const isCurrent = () => workspaceLifecycle.isCurrentSession(sessionId)
  isLoading.value = true
  error.value = null

  try {
    const flowData = await workspaceLifecycle.runForSession(
      sessionId,
      () => readWorkspaceFlowResourceApi() as Promise<FlowData | null>,
    )
    if (!isCurrent()) return
    if (!flowData) {
      console.warn('Failed to read flow data')
      dynamicFlowStages.value = []
      return
    }
    if (!shouldApplyFlowData(flowData)) return

    dynamicFlowStages.value = transformFlowData(flowData)
  } catch (err) {
    if (!isCurrent()) return
    console.error('Failed to load flow stages:', err)
    error.value = err instanceof Error ? err.message : String(err)
    dynamicFlowStages.value = []
  } finally {
    if (isCurrent()) isLoading.value = false
  }
}

async function startFlowJsonWatchForCurrentProject(): Promise<void> {
  cleanupFlowJsonWatch()
  const { isDesktopRuntimeAvailable } = useDesktopRuntime()
  const workspaceLifecycle = useWorkspaceLifecycle()
  const { currentProject } = useWorkspace()
  const projectPath = currentProject.value?.path
  if (!isDesktopRuntimeAvailable || !projectPath) return

  const sid = ++watchSession
  try {
    const homeData = (await readWorkspaceHomeResourceApi()) as { flow?: string } | null
    if (sid !== watchSession || currentProject.value?.path !== projectPath) return
    const flowJsonPath = homeData?.flow
    if (!flowJsonPath) return

    const localFlowPath = convertRemoteToLocalPath(flowJsonPath, projectPath)
    const resolvedFlowPath = await resolveProjectPathAccess(localFlowPath)
    if (sid !== watchSession || currentProject.value?.path !== projectPath) return
    if (!resolvedFlowPath) return

    const unwatch = await watchProjectFile(resolvedFlowPath, () => {
      if (sid !== watchSession || currentProject.value?.path !== projectPath) return
      void loadFlowStagesFromPath(resolvedFlowPath)
    })
    if (sid !== watchSession || currentProject.value?.path !== projectPath) {
      unwatch?.()
      return
    }
    if (!unwatch) return
    unwatchFlowJsonFile = unwatch
    unregisterFlowJsonLifecycleCleanup = workspaceLifecycle.registerCleanup(
      () => {
        if (unwatchFlowJsonFile === unwatch) {
          unwatchFlowJsonFile = null
        }
        unwatch()
      },
      {
        sessionId: workspaceLifecycle.currentSessionId.value,
        label: 'flow.json watcher',
      },
    )
  } catch (err) {
    console.warn('Failed to watch flow.json for stage updates:', err)
  }
}

function clearFlowStages(): void {
  dynamicFlowStages.value = []
  error.value = null
}

function setFirstRunStepOngoing(): void {
  const idx = dynamicFlowStages.value.findIndex((s) => s.state !== 'Success')
  if (idx !== -1) {
    dynamicFlowStages.value[idx] = {
      ...dynamicFlowStages.value[idx],
      state: 'Ongoing',
    }
  }
}

function setRunStepOngoingByPath(stepPath: string): void {
  if (!stepPath) return
  const key = stepPath.toLowerCase()
  const idx = dynamicFlowStages.value.findIndex((s) => s.path.toLowerCase() === key)
  if (idx !== -1) {
    dynamicFlowStages.value[idx] = {
      ...dynamicFlowStages.value[idx],
      state: 'Ongoing',
    }
  }
}

/**
 * 绑定 flow stages 观测：全应用只装一套 flow.json watch。
 * 幂等；组件卸载不得调用 teardown。
 */
export function ensureFlowStagesObservationBound(): void {
  if (bound) return
  bound = true

  flowStagesObservationScope.run(() => {
    const { currentProject, resourceVersions } = useWorkspace()

    watch(
      () => currentProject.value?.path,
      async (newPath) => {
        if (newPath) {
          await loadFlowStages()
          await startFlowJsonWatchForCurrentProject()
        } else {
          watchSession++
          cleanupFlowJsonWatch()
          clearFlowStages()
        }
      },
      { immediate: true },
    )

    watch(
      () => [resourceVersions.value.flow, resourceVersions.value.all],
      async () => {
        if (!currentProject.value?.path) return
        await loadFlowStages()
      },
    )

    unregisterHomeRunArtifactReset = onHomeRunArtifactReset((projectPath) => {
      const currentProjectPath = currentProject.value?.path
      if (
        !currentProjectPath ||
        normalizeProjectPath(projectPath) !== normalizeProjectPath(currentProjectPath)
      ) {
        return
      }

      pendingRerunFlowStartProjectPath = normalizeProjectPath(currentProjectPath)
      resetRunStagesForRerun()
    })
  })
}

/** 测试 / session 硬重置用。生产路径靠 lifecycle cleanup 拆 watch。 */
export function resetFlowStagesObservationForTests(): void {
  watchSession++
  cleanupFlowJsonWatch()
  unregisterHomeRunArtifactReset?.()
  unregisterHomeRunArtifactReset = null
  clearFlowStages()
  pendingRerunFlowStartProjectPath = ''
  bound = false
  flowStagesObservationScope.stop()
  flowStagesObservationScope = effectScope(true)
}

export interface FlowStagesObservation {
  flowStages: ComputedRef<FlowStage[]>
  dynamicFlowStages: Ref<FlowStage[]>
  hasOngoingRunStage: ComputedRef<boolean>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  loadFlowStages: () => Promise<void>
  loadFlowStagesFromPath: (flowJsonPath: string) => Promise<void>
  refreshFlowStages: () => Promise<void>
  clearFlowStages: () => void
  setFirstRunStepOngoing: () => void
  setRunStepOngoingByPath: (stepPath: string) => void
}

export function getFlowStagesObservation(): FlowStagesObservation {
  ensureFlowStagesObservationBound()
  return {
    flowStages,
    dynamicFlowStages,
    hasOngoingRunStage,
    isLoading,
    error,
    loadFlowStages,
    loadFlowStagesFromPath,
    refreshFlowStages: loadFlowStages,
    clearFlowStages,
    setFirstRunStepOngoing,
    setRunStepOngoingByPath,
  }
}
