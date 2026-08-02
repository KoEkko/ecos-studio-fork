import { computed, effectScope, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useWorkspace } from '@/composables/useWorkspace'
import { isFlowExecutionActiveForWorkspace } from '@/composables/useFlowRunner'
import { readWorkspaceAnalysisInput } from '@/utils/workspaceAnalysisData'
import {
  buildWorkspaceQorSummary,
  type ProjectWorkspaceFinalMetrics,
  type ProjectWorkspaceQorSummary,
} from '@/utils/projectManagement'
import type { ProjectQorGateTally, QorGateStatus } from '@/utils/projectQorTrend'
import {
  observationEventIncludes,
  subscribeObservationBus,
  type ObservationInvalidation,
} from './bus'

const EMPTY_GATE_TALLY: ProjectQorGateTally = { total: 0, blocked: 0, warning: 0 }

const qorSummary = ref<ProjectWorkspaceQorSummary | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

let bound = false
let loadGeneration = 0
let pollTimer: ReturnType<typeof setInterval> | null = null
let unsubscribeBus: (() => void) | null = null
let qorObservationScope = effectScope(true)

const QOR_LIVE_POLL_MS = 4000

async function loadQorMetrics(): Promise<void> {
  const { currentProject } = useWorkspace()
  const path = currentProject.value?.path ?? ''
  if (!path) {
    qorSummary.value = null
    return
  }

  const generation = ++loadGeneration
  isLoading.value = true
  error.value = null
  try {
    const analysis = await readWorkspaceAnalysisInput(path)
    if (generation !== loadGeneration) return
    qorSummary.value = buildWorkspaceQorSummary(path, analysis)
  } catch (cause) {
    if (generation !== loadGeneration) return
    qorSummary.value = null
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    if (generation === loadGeneration) isLoading.value = false
  }
}

function stopLivePoll(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function startLivePoll(): void {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    void loadQorMetrics()
  }, QOR_LIVE_POLL_MS)
}

function onBusEvent(event: ObservationInvalidation): void {
  if (!observationEventIncludes(event, 'qor')) return
  void loadQorMetrics()
}

/**
 * QoR 观测：订 observation bus + run 期间轻量 poll。
 * 不再依赖 HomeView 下降沿，也不再「同 workspace 只读一次」。
 */
export function ensureQorObservationBound(): void {
  if (bound) return
  bound = true

  qorObservationScope.run(() => {
    const { currentProject, resourceVersions } = useWorkspace()

    watch(
      () => currentProject.value?.path,
      (path) => {
        if (!path) {
          qorSummary.value = null
          stopLivePoll()
          return
        }
        void loadQorMetrics()
      },
      { immediate: true },
    )

    watch(
      () => isFlowExecutionActiveForWorkspace(currentProject.value?.path),
      (active, wasActive) => {
        if (active) {
          startLivePoll()
          void loadQorMetrics()
          return
        }
        stopLivePoll()
        if (wasActive) void loadQorMetrics()
      },
      { immediate: true },
    )

    watch(
      () => [resourceVersions.value.home, resourceVersions.value.all],
      () => {
        if (!currentProject.value?.path) return
        void loadQorMetrics()
      },
    )

    unsubscribeBus = subscribeObservationBus(onBusEvent)
  })
}

export function resetQorObservationForTests(): void {
  stopLivePoll()
  unsubscribeBus?.()
  unsubscribeBus = null
  qorSummary.value = null
  isLoading.value = false
  error.value = null
  loadGeneration += 1
  bound = false
  qorObservationScope.stop()
  qorObservationScope = effectScope(true)
}

export function refreshQorObservation(): Promise<void> {
  ensureQorObservationBound()
  return loadQorMetrics()
}

export interface QorObservationApi {
  qorSummary: Ref<ProjectWorkspaceQorSummary | null>
  finalMetrics: ComputedRef<ProjectWorkspaceFinalMetrics | null>
  overallScore: ComputedRef<number | null>
  gateStatus: ComputedRef<QorGateStatus>
  blockingIssues: ComputedRef<string[]>
  gateTally: ComputedRef<ProjectQorGateTally>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  refreshQorMetrics: () => Promise<void>
  loadQorMetrics: () => Promise<void>
}

export function getQorObservation(): QorObservationApi {
  ensureQorObservationBound()
  return {
    qorSummary,
    finalMetrics: computed(() => qorSummary.value?.finalMetrics ?? null),
    overallScore: computed(() => qorSummary.value?.overallScore ?? null),
    gateStatus: computed(() => qorSummary.value?.gateStatus ?? 'unavailable'),
    blockingIssues: computed(() => qorSummary.value?.blockingIssues ?? []),
    gateTally: computed(() => qorSummary.value?.gateTally ?? EMPTY_GATE_TALLY),
    isLoading,
    error,
    refreshQorMetrics: loadQorMetrics,
    loadQorMetrics,
  }
}
