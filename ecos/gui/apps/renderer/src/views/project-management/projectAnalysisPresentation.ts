import type {
  ProjectFlowMetricSummary,
  ProjectMetricId,
  ProjectMetricPoint,
  ProjectMetricRow,
  ProjectRunStateSlice,
  ProjectWorkspace,
} from '@/utils/projectManagement'

export const DASHBOARD_METRIC_ORDER = [
  'die_area',
  'core_util',
  'frequency',
  'wns',
  'tns',
  'hold_wns',
  'hold_tns',
  'drc',
] as const satisfies readonly ProjectMetricId[]

export const BEST_WORKSPACE_PPA_METRIC_ORDER = [
  'frequency',
  'wns',
  'tns',
  'hold_wns',
  'hold_tns',
  'drc',
  'die_area',
  'core_util',
] as const satisfies readonly ProjectMetricId[]

export interface ProjectDashboardMetricCell {
  metric: ProjectMetricRow
  point: ProjectMetricPoint
}

export interface ProjectDashboardWorkspaceMetricRow {
  workspaceId: string
  cells: ProjectDashboardMetricCell[]
}

export interface BestWorkspacePpaMetric {
  id: ProjectMetricId
  label: string
  display: string
  state: ProjectMetricPoint['state']
}

export function buildDashboardMetricRows(
  metricsRows: readonly ProjectMetricRow[],
  flowMetricSummary: Pick<ProjectFlowMetricSummary, 'runtimePoints' | 'memoryPoints'>,
): ProjectMetricRow[] {
  const chipMetricRows = DASHBOARD_METRIC_ORDER.flatMap((metricId) => {
    const metric = metricsRows.find((row) => row.id === metricId)
    return metric ? [metric] : []
  })

  return [
    ...chipMetricRows,
    {
      id: 'runtime',
      label: 'Runtime',
      hint: 'workspace flow total runtime',
      kind: 'bar',
      points: [...flowMetricSummary.runtimePoints],
    },
    {
      id: 'memory',
      label: 'Memory',
      hint: 'workspace flow peak memory',
      kind: 'bar',
      points: [...flowMetricSummary.memoryPoints],
    },
  ]
}

export function buildDashboardWorkspaceMetricRows(
  workspaces: readonly Pick<ProjectWorkspace, 'id'>[],
  metrics: readonly ProjectMetricRow[],
): ProjectDashboardWorkspaceMetricRow[] {
  return workspaces.map((workspace) => ({
    workspaceId: workspace.id,
    cells: metrics.map((metric) => ({
      metric,
      point: metricPointForWorkspace(metric, workspace.id),
    })),
  }))
}

export function findBestFrequencyWorkspace(
  metrics: readonly ProjectMetricRow[],
): ProjectMetricPoint | null {
  const frequency = metrics.find((metric) => metric.id === 'frequency')
  return (
    frequency?.points
      .filter(
        (point): point is ProjectMetricPoint & { value: number } => point.value !== null,
      )
      .sort((left, right) => right.value - left.value)[0] ?? null
  )
}

export function buildBestWorkspacePpaMetrics(
  metrics: readonly ProjectMetricRow[],
  workspaceId: string | null | undefined,
): BestWorkspacePpaMetric[] {
  if (!workspaceId) return []

  return BEST_WORKSPACE_PPA_METRIC_ORDER.flatMap((metricId) => {
    const metric = metrics.find((row) => row.id === metricId)
    const point = metric?.points.find((item) => item.workspaceId === workspaceId)
    if (!metric || !point) return []

    return [
      {
        id: metric.id,
        label: metric.label,
        display: point.label,
        state: point.state,
      },
    ]
  })
}

export function pendingMetricPoint(workspaceId: string): ProjectMetricPoint {
  return {
    workspaceId,
    workspaceName: workspaceId,
    label: 'N/A',
    value: null,
    state: 'pending',
  }
}

export function metricPointForWorkspace(
  metric: Pick<ProjectMetricRow, 'points'>,
  workspaceId: string,
): ProjectMetricPoint {
  return (
    metric.points.find((point) => point.workspaceId === workspaceId) ??
    pendingMetricPoint(workspaceId)
  )
}

export function metricValueClass(state: ProjectMetricPoint['state']): string {
  const classes: Record<ProjectMetricPoint['state'], string> = {
    good: 'metric-good',
    warn: 'metric-warn',
    bad: 'metric-bad',
    pending: 'metric-pending',
  }
  return classes[state]
}

export type MetricTableSortDirection = 'asc' | 'desc'
export type MetricTableSortKey = 'workspace' | ProjectMetricId

const ASCENDING_FIRST_SORT_KEYS = new Set<MetricTableSortKey>([
  'workspace',
  'drc',
  'runtime',
  'memory',
])

export interface MetricTableSortState {
  key: MetricTableSortKey
  direction: MetricTableSortDirection
}

export interface SortableWorkspaceMetricRow {
  workspaceId: string
  cells: ReadonlyArray<{
    metric: { id: MetricTableSortKey }
    point: Pick<ProjectMetricPoint, 'value'>
  }>
}

/** First-click direction: lower-is-better metrics ascend, others descend. */
export function initialMetricSortDirection(
  key: MetricTableSortKey,
): MetricTableSortDirection {
  return ASCENDING_FIRST_SORT_KEYS.has(key) ? 'asc' : 'desc'
}

export function nextMetricSortState(
  current: MetricTableSortState | null,
  key: MetricTableSortKey,
): MetricTableSortState {
  if (!current || current.key !== key) {
    return { key, direction: initialMetricSortDirection(key) }
  }
  return {
    key,
    direction: current.direction === 'asc' ? 'desc' : 'asc',
  }
}

export function metricSortAriaValue(
  sort: MetricTableSortState | null,
  key: MetricTableSortKey,
): 'ascending' | 'descending' | 'none' {
  if (!sort || sort.key !== key) return 'none'
  return sort.direction === 'asc' ? 'ascending' : 'descending'
}

export function sortWorkspaceMetricRows<T extends SortableWorkspaceMetricRow>(
  rows: readonly T[],
  sort: MetricTableSortState | null,
): T[] {
  if (!sort) return [...rows]

  return [...rows].sort((left, right) => {
    if (sort.key === 'workspace') {
      const cmp = left.workspaceId.localeCompare(right.workspaceId)
      return sort.direction === 'asc' ? cmp : -cmp
    }

    const leftValue =
      left.cells.find((cell) => cell.metric.id === sort.key)?.point.value ?? null
    const rightValue =
      right.cells.find((cell) => cell.metric.id === sort.key)?.point.value ?? null
    return compareNullableNumbers(leftValue, rightValue, sort.direction)
  })
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: MetricTableSortDirection,
): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  const cmp = left - right
  return direction === 'asc' ? cmp : -cmp
}

export function dashboardPillClass(count: number, tone: 'success' | 'info'): string {
  return count > 0 ? `dashboard-pill ${tone}` : 'dashboard-pill is-zero'
}

export function metricHasComparableData(
  metric: Pick<ProjectMetricRow, 'points'>,
): boolean {
  return metric.points.some((point) => point.value !== null)
}

export function dashboardMetricColumnsTemplate(
  metrics: readonly Pick<ProjectMetricRow, 'points'>[],
): string {
  // Keep every metric column; only tighten the floor for all-empty columns.
  // Use fixed floors (not sub-1fr) so the table can overflow and scroll again.
  const columns = metrics.map((metric) =>
    metricHasComparableData(metric) ? 'minmax(100px, 1fr)' : 'minmax(88px, 1fr)',
  )
  return `minmax(148px, 0.9fr) ${columns.join(' ')}`
}

export function runStateSliceClass(state: ProjectRunStateSlice['state']): string {
  return `run-state-${state}`
}

export function buildRunStatePieBackground(
  slices: readonly ProjectRunStateSlice[],
): string {
  if (slices.length === 0) {
    return 'conic-gradient(color-mix(in srgb, var(--text-secondary) 14%, transparent) 0deg 360deg)'
  }

  let cursor = 0
  const segments = slices.map((slice) => {
    const end = cursor + (slice.percent / 100) * 360
    const segment = `${runStateSliceColor(slice.state)} ${cursor}deg ${end}deg`
    cursor = end
    return segment
  })

  return `conic-gradient(${segments.join(', ')})`
}

function runStateSliceColor(state: ProjectRunStateSlice['state']): string {
  const colors: Record<ProjectRunStateSlice['state'], string> = {
    success: 'var(--success-color)',
    failed: 'var(--danger-color)',
    running: 'var(--warn-color)',
    unstart: 'color-mix(in srgb, var(--text-secondary) 62%, transparent)',
    skipped: 'color-mix(in srgb, var(--text-secondary) 36%, transparent)',
  }
  return colors[state]
}
