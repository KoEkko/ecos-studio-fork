import { computed } from 'vue'
import {
  getQorObservation,
} from '@/composables/workspace-observation/qorObservation'
import type {
  ProjectMetricId,
  ProjectSummaryMetric,
  ProjectWorkspaceFinalMetrics,
} from '@/utils/projectManagement'
import type { QorGateStatus } from '@/utils/projectQorTrend'

export interface HomeQorMetricDescriptor {
  id: ProjectMetricId
  label: string
  field: keyof ProjectWorkspaceFinalMetrics
}

/**
 * Mirrors the project dashboard's workspace comparison columns, minus runtime and
 * memory (those are flow timings rather than chip quality). Kept aligned with
 * DASHBOARD_METRIC_ORDER by assertion in useHomeQorMetrics.test.ts.
 */
export const HOME_QOR_METRIC_DESCRIPTORS: readonly HomeQorMetricDescriptor[] = [
  { id: 'die_area', label: 'Die Area', field: 'dieArea' },
  { id: 'core_util', label: 'Core Util', field: 'coreUtil' },
  { id: 'frequency', label: 'Frequency [MHz]', field: 'frequency' },
  { id: 'wns', label: 'Setup WNS', field: 'setupWns' },
  { id: 'tns', label: 'Setup TNS', field: 'setupTns' },
  { id: 'hold_wns', label: 'Hold WNS', field: 'holdWns' },
  { id: 'hold_tns', label: 'Hold TNS', field: 'holdTns' },
  { id: 'drc', label: 'DRC', field: 'drcCount' },
]

export interface HomeQorMetricTile {
  id: ProjectMetricId
  label: string
  display: string
  value: number | null
  state: ProjectSummaryMetric['state']
  hint?: string
}

export function toHomeQorMetricTiles(
  finalMetrics: ProjectWorkspaceFinalMetrics | null,
): HomeQorMetricTile[] {
  return HOME_QOR_METRIC_DESCRIPTORS.map((descriptor) => {
    const metric = finalMetrics?.[descriptor.field]
    return {
      id: descriptor.id,
      label: descriptor.label,
      display: metric?.display ?? 'N/A',
      value: metric?.value ?? null,
      state: metric?.state ?? 'pending',
      hint: metric?.hint,
    }
  })
}

export const QOR_GATE_LABELS: Record<QorGateStatus, string> = {
  pass: 'Gate pass',
  blocked: 'Gate blocked',
  incomplete: 'Gate incomplete',
  unavailable: 'Gate not rated',
}

/**
 * QoR facade：状态与刷新由 workspace-observation/qorObservation 持有。
 */
export function useHomeQorMetrics() {
  const obs = getQorObservation()
  const metricTiles = computed(() => toHomeQorMetricTiles(obs.finalMetrics.value))
  const hasMetrics = computed(() =>
    metricTiles.value.some((tile) => tile.state !== 'pending'),
  )

  return {
    finalMetrics: obs.finalMetrics,
    metricTiles,
    hasMetrics,
    overallScore: obs.overallScore,
    gateStatus: obs.gateStatus,
    blockingIssues: obs.blockingIssues,
    gateTally: obs.gateTally,
    isLoading: obs.isLoading,
    error: obs.error,
    loadQorMetrics: obs.loadQorMetrics,
    refreshQorMetrics: obs.refreshQorMetrics,
  }
}
