import {
  stepAnalysisAvailability,
  type ProjectAnalysisArtifactStatus,
  type ProjectAnalysisAvailability,
  type ProjectAnalysisStepSnapshot,
} from '@/utils/projectAnalysisSnapshot'
import type {
  FlowStep,
  ProjectMetricPoint,
  ProjectStepCompareSummary,
  ProjectWorkspaceSummary,
} from '@/utils/projectManagement'
import type {
  ProjectQorDetailDescriptor,
  ProjectQorFindingEvidence,
  ProjectQorMetricRecord,
  ProjectQorTimingIssue,
  ProjectQorTrendSummary,
  QorGateStatus,
} from '@/utils/projectQorTrend'

export type StepIssueSeverity = 'critical' | 'warning' | 'info'
export type StepTone = 'good' | 'warn' | 'bad' | 'neutral'
export type StepVerdictStatus = QorGateStatus | 'no_data'

/** Which artifact list a finding was read from. A fact, unlike a severity ranking. */
export type StepIssueChannel =
  | 'blocking'
  | 'hard-gate'
  | 'signoff'
  | 'timing-path'
  | 'timing-coverage'
  | 'missing-metric'
  | 'artifact'
  | 'provenance'
  | 'hotspot'
  | 'summary-status'

/** One diagnosable problem, pre-formatted so the view never computes display text. */
export interface StepIssue {
  id: string
  workspaceId: string
  workspaceName: string
  channel: StepIssueChannel
  /**
   * Only the severity the artifact itself reported. Null for channels that carry no
   * severity field, because ranking those would be this panel's opinion, not data.
   */
  severity: StepIssueSeverity | null
  /**
   * True when the artifact listed this finding somewhere it treats as blocking:
   * blocking_issues, a failed hard gate, or a signoff group reported as blocked.
   */
  blocking: boolean
  kind: string
  title: string
  metric: string
  actual: string
  /**
   * Only ever the threshold the artifact itself reported. Never a convention this
   * panel assumes, so a reader can trust that a shown threshold is checkable.
   */
  expected: string | null
  /** Same rule as `expected`: derived from the artifact's operator, never assumed. */
  condition: string | null
  location: string | null
  source: string
  /** Null when the artifact reported no description, so the panel writes none in its place. */
  diagnosis: string | null
}

export interface StepIssueCounts {
  total: number
  /** Findings the artifacts themselves list as blocking. */
  blocking: number
}

/** One chip in the issue queue filter, built from the channels actually present. */
export interface StepIssueFilter {
  id: string
  label: string
  count: number
}

export interface StepVerdictFact {
  label: string
  value: string
  tone: StepTone
}

export interface StepVerdict {
  /** Null when qor_summary.json reported no status, since this panel does not infer one. */
  status: StepVerdictStatus | null
  label: string | null
  summary: string
  facts: StepVerdictFact[]
}

export interface StepMetricRow {
  id: string
  label: string
  value: string
  descriptor: string
  corner: string | null
  sourceFile: string
  delta: string | null
  deltaTone: StepTone
}

export interface StepMetricGroup {
  id: string
  label: string
  rows: StepMetricRow[]
}

export interface StepDetailTable {
  id: string
  title: string
  sourceFile: string
  sourceStatus: ProjectAnalysisArtifactStatus
  coverage: { label: string; status: string; tone: StepTone } | null
  columns: string[]
  rows: string[][]
  emptyMessage: string
  /** A reported fact that explains an empty structured detail, when one exists. */
  emptyDetail: string | null
}

export interface StepCompareColumn {
  workspaceId: string
  workspaceName: string
  isBaseline: boolean
  isBest: boolean
}

export interface StepCompareCell {
  workspaceId: string
  workspaceName: string
  value: string
  state: ProjectMetricPoint['state']
  delta: string | null
  deltaTone: StepTone
}

export interface StepCompareRow {
  id: string
  label: string
  descriptor: string
  cells: StepCompareCell[]
}

export interface StepCompareMatrix {
  columns: StepCompareColumn[]
  rows: StepCompareRow[]
}

export interface StepWorkspaceChip {
  workspaceId: string
  workspaceName: string
  tone: StepTone
  statusLabel: string
  blockingCount: number
  findingCount: number
  isBaseline: boolean
  isBest: boolean
}

export interface StepTab {
  step: FlowStep
  blockingCount: number
  findingCount: number
  analysisAvailability: ProjectAnalysisAvailability
}

/**
 * A queue has to be in some order, so channels are listed from the ones the artifacts
 * tie most directly to a failed gate down to bookkeeping. This is a reading order, not
 * a claim that one channel outranks another.
 */
const CHANNEL_ORDER: readonly StepIssueChannel[] = [
  'blocking',
  'hard-gate',
  'signoff',
  'timing-path',
  'hotspot',
  'timing-coverage',
  'missing-metric',
  'artifact',
  'provenance',
  'summary-status',
]

const CHANNEL_LABELS: Record<StepIssueChannel, string> = {
  blocking: 'Blocking issue',
  'hard-gate': 'Hard gate',
  signoff: 'Signoff',
  'timing-path': 'Timing path',
  hotspot: 'Hotspot',
  'timing-coverage': 'Timing coverage',
  'missing-metric': 'Missing metric',
  artifact: 'Artifact',
  provenance: 'Provenance',
  'summary-status': 'Step status',
}

const REPORTED_SEVERITY_RANK: Record<StepIssueSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

const DIMENSION_LABELS: Record<string, string> = {
  routability_physical: 'Routability',
  clock_robustness_dfm: 'Clock quality',
  timing: 'Timing',
  power_integrity: 'Power integrity',
  area_cost: 'Area and cost',
  runtime: 'Runtime',
}

const DIMENSION_ORDER: Record<string, number> = {
  routability_physical: 0,
  clock_robustness_dfm: 1,
  timing: 2,
  power_integrity: 3,
  area_cost: 4,
  runtime: 5,
}

const POLARITY_LABELS: Record<string, string> = {
  higher_is_better: 'higher is better',
  lower_is_better: 'lower is better',
  target_range: 'target range',
  trend_only: 'trend only',
}

const DETAIL_TITLES: Record<string, string> = {
  place_map_summary: 'Placement maps',
  cts_clock_skew_table: 'Clock timing quality',
  layer_table: 'Route layers',
  rule_layer_table: 'DRC rules by layer',
  rcx_spef_corner_table: 'RCX corners',
  path_group_table: 'STA path groups',
}

const DETAIL_FIELDS: Record<string, string[]> = {
  place_map_summary: [
    'group',
    'metric',
    'top_5_percent_average',
    'max',
    'high_bin_ratio',
  ],
  cts_clock_skew_table: [
    'clock_count',
    'worst_optimized_skew_ns',
    'worst_max_insertion_latency_ns',
    'target_unmet_count',
  ],
  layer_table: ['layer', 'dr_wirelength', 'dr_via_count', 'la_overflow'],
  rule_layer_table: ['display_name', 'value', 'unit'],
  rcx_spef_corner_table: [
    'rc_corner',
    'availability',
    'total_capacitance_ff',
    'coupling_capacitance_ff',
    'total_resistance_ohm',
  ],
  path_group_table: ['corner_context', 'path_group', 'setup', 'hold'],
}

const DETAIL_ROW_KEYS: Record<string, string> = {
  rule_layer_table: 'top_violations',
  rcx_spef_corner_table: 'rc_corners',
  path_group_table: 'records',
}

const FIELD_LABELS: Record<string, string> = {
  corner_context: 'PVT / RC corner',
  clock_count: 'Clock count',
  worst_optimized_skew_ns: 'Worst skew [ns]',
  worst_max_insertion_latency_ns: 'Worst insertion latency [ns]',
  target_unmet_count: 'Target unmet',
  top_5_percent_average: 'Top 5% average',
  max: 'Maximum',
  high_bin_ratio: 'High-bin ratio',
  dr_wirelength: 'DR wirelength',
  dr_via_count: 'DR via count',
  la_overflow: 'LA overflow',
}

const ARTIFACTS = [
  {
    key: 'artifactStatus',
    label: 'QoR metrics artifact',
    source: 'analysis/qor_metrics.json',
  },
  {
    key: 'summaryArtifactStatus',
    label: 'QoR summary artifact',
    source: 'analysis/qor_summary.json',
  },
  {
    key: 'hotspotArtifactStatus',
    label: 'QoR hotspots artifact',
    source: 'analysis/qor_hotspots.json',
  },
] as const

export function stepSnapshot(
  summary: ProjectWorkspaceSummary | null | undefined,
  step: FlowStep,
): ProjectAnalysisStepSnapshot | null {
  return summary?.analysis.steps[step] ?? null
}

/**
 * Flattens every V3 finding channel for one workspace and step into a single
 * severity-sorted list. Values are formatted here so the view stays declarative.
 */
export function buildStepIssues(
  summary: ProjectWorkspaceSummary | null | undefined,
  step: FlowStep,
): StepIssue[] {
  const snapshot = stepSnapshot(summary, step)
  if (!summary || !snapshot) return []

  const issues: StepIssue[] = []
  const byMetric = new Map<string, StepIssue>()
  const unitFor = (metric: string) =>
    snapshot.metrics.find((item) => item.metricName === metric)?.unit

  const base = { workspaceId: summary.workspaceId, workspaceName: summary.workspaceName }

  if (snapshot.flowStatus === 'success') {
    for (const artifact of ARTIFACTS) {
      const status = snapshot[artifact.key]
      if (status === 'available') continue
      issues.push({
        ...base,
        id: `artifact-${summary.workspaceId}-${artifact.source}`,
        channel: 'artifact',
        severity: null,
        blocking: false,
        kind: 'Analysis artifact',
        title: artifact.label,
        metric: artifact.source,
        actual: status,
        expected: null,
        condition: null,
        location: null,
        source: artifact.source,
        diagnosis:
          status === 'invalid'
            ? `${artifact.source} exists but does not satisfy the current V3 analysis schema.`
            : `The successful ${step} step did not create required file ${artifact.source}.`,
      })
    }
  }

  for (const issue of snapshot.blockingIssues) {
    const unit = unitFor(issue.metric)
    const entry: StepIssue = {
      ...base,
      id: `blocking-${summary.workspaceId}-${issue.metric}`,
      channel: 'blocking',
      severity: null,
      blocking: true,
      kind: 'Blocking issue',
      title: issue.displayName,
      metric: issue.metric,
      actual: formatScalar(issue.value, unit),
      expected: formatOptionalScalar(issue.evidence.expectedValue, unit),
      condition: findingCondition(issue.metric, issue.evidence, unit),
      location: evidenceLocation(issue.evidence),
      source: 'analysis/qor_summary.json',
      diagnosis: issue.evidence.diagnosis ?? issue.reason,
    }
    issues.push(entry)
    byMetric.set(issue.metric, entry)
  }

  for (const gate of snapshot.hardGateFailures) {
    const unit = unitFor(gate.metric)
    const existing = byMetric.get(gate.metric)
    if (existing) {
      existing.kind = `${existing.kind} / failed hard gate`
      existing.expected = formatOptionalScalar(
        gate.evidence.expectedValue ?? gate.threshold,
        unit,
      )
      existing.condition = findingCondition(gate.metric, gate.evidence, unit)
      existing.location = evidenceLocation(gate.evidence) ?? existing.location
      existing.diagnosis =
        gate.evidence.diagnosis ?? `${existing.diagnosis} Hard gate ${gate.id} failed.`
      continue
    }
    const entry: StepIssue = {
      ...base,
      id: `hard-gate-${summary.workspaceId}-${gate.id}`,
      channel: 'hard-gate',
      severity: null,
      blocking: true,
      kind: gate.kind ? `Failed hard gate: ${gate.kind}` : 'Failed hard gate',
      title: titleFromIdentifier(gate.id),
      metric: gate.metric,
      actual: formatScalar(gate.actual, unit),
      expected: formatOptionalScalar(gate.evidence.expectedValue ?? gate.threshold, unit),
      condition: findingCondition(gate.metric, gate.evidence, unit),
      location: evidenceLocation(gate.evidence),
      source: 'analysis/qor_summary.json',
      diagnosis:
        gate.evidence.diagnosis ??
        `qor_summary.json lists hard gate ${gate.id} as failed without a diagnosis.`,
    }
    issues.push(entry)
    byMetric.set(gate.metric, entry)
  }

  for (const hotspot of snapshot.hotspots) {
    if (byMetric.has(hotspot.metric)) continue
    const entry: StepIssue = {
      ...base,
      id: `hotspot-${summary.workspaceId}-${hotspot.metric}`,
      channel: 'hotspot',
      severity: hotspot.severity,
      blocking: false,
      kind: hotspot.kind ? `Hotspot: ${hotspot.kind}` : 'Hotspot',
      title: hotspot.displayName,
      metric: hotspot.metric,
      actual: formatScalar(hotspot.value, unitFor(hotspot.metric)),
      expected: null,
      condition: null,
      location: null,
      source: hotspot.sourceFile,
      diagnosis: hotspot.description,
    }
    issues.push(entry)
    byMetric.set(hotspot.metric, entry)
  }

  for (const missing of snapshot.missingMetrics) {
    issues.push({
      ...base,
      id: `missing-metric-${summary.workspaceId}-${missing.metricName}`,
      channel: 'missing-metric',
      severity: null,
      blocking: false,
      kind: 'Required metric unavailable',
      title: missing.metricName,
      metric: missing.metricName,
      actual: 'Not reported',
      expected: null,
      condition: null,
      location: evidenceLocation(missing.evidence),
      source: 'analysis/qor_summary.json',
      diagnosis: missing.evidence.diagnosis ?? missing.reason,
    })
  }

  for (const integrity of snapshot.integrityIssues) {
    for (const id of integrity.invalidMetricSourceIds) {
      issues.push({
        ...base,
        id: `integrity-metric-${summary.workspaceId}-${id}`,
        channel: 'provenance',
        severity: null,
        blocking: false,
        kind: 'Metric provenance',
        title: `Metric ${id} has no valid source`,
        metric: id,
        actual: 'No feature/ source reference',
        expected: null,
        condition: null,
        location: null,
        source: 'analysis/qor_metrics.json',
        diagnosis: `Metric ${id} has no valid feature/ source reference in qor_metrics.json.`,
      })
    }
    for (const id of integrity.invalidDetailIds) {
      issues.push({
        ...base,
        id: `integrity-detail-${summary.workspaceId}-${id}`,
        channel: 'provenance',
        severity: null,
        blocking: false,
        kind: 'Detail provenance',
        title: `Detail ${id} has no valid source`,
        metric: id,
        actual: 'No feature/ source reference',
        expected: null,
        condition: null,
        location: null,
        source: 'analysis/qor_metrics.json',
        diagnosis: `Detail ${id} has no valid feature/ source reference in qor_metrics.json.`,
      })
    }
  }

  const signoff = summary.analysis.signoffReadiness
  for (const group of signoff.groups) {
    if (group.step !== step || group.status === 'pass') continue
    issues.push({
      ...base,
      id: `signoff-${summary.workspaceId}-${group.id}`,
      channel: 'signoff',
      severity: null,
      blocking: group.status === 'blocked',
      kind: group.gate ? 'Required signoff gate' : 'Signoff readiness',
      title: titleFromIdentifier(group.id),
      metric: group.id,
      actual: group.status,
      expected: null,
      condition: null,
      location: null,
      source: 'analysis/qor_summary.json',
      diagnosis:
        signoff.reasonCodes.length > 0
          ? `${titleFromIdentifier(group.id)} is ${group.status}; reported reasons: ${signoff.reasonCodes.join(', ')}.`
          : `${titleFromIdentifier(group.id)} is ${group.status}; no specific reason code was emitted.`,
    })
  }

  for (const timing of snapshot.timingIssues) {
    issues.push({
      ...base,
      id: `timing-${summary.workspaceId}-${timing.issueId}`,
      channel: 'timing-path',
      severity: timing.severity,
      blocking: false,
      kind: `Timing path: ${timing.analysisType}`,
      title: `${timing.analysisType.toUpperCase()} ${timing.checkType}`,
      metric: timing.issueId,
      actual: formatScalar(timing.slackNs, 'ns'),
      expected: null,
      condition: null,
      location: `analysis/sta_timing_issues.json#issue_id=${timing.issueId}`,
      source: 'analysis/sta_timing_issues.json',
      diagnosis: timingDiagnosis(timing),
    })
  }

  const coverage = snapshot.timingCoverage
  if (coverage) {
    issues.push({
      ...base,
      id: `timing-coverage-${summary.workspaceId}`,
      channel: 'timing-coverage',
      severity: null,
      blocking: false,
      kind: 'STA timing coverage',
      title: 'STA timing corners missing',
      metric: 'sta_missing_corner_count',
      actual: formatScalar(coverage.missingCornerCount, 'count'),
      expected: null,
      condition: null,
      location: null,
      source: 'analysis/sta_timing_issues.json',
      diagnosis: `Missing timing corner artifacts: ${coverage.missingCorners.join(', ')}. ${coverage.availableArtifactCount} corner artifacts are available.`,
    })
  }

  const hasSummaryEvidence = issues.some(
    (issue) => issue.source === 'analysis/qor_summary.json',
  )
  if (
    snapshot.summaryStatus &&
    snapshot.summaryStatus !== 'pass' &&
    !hasSummaryEvidence
  ) {
    issues.push({
      ...base,
      id: `summary-status-${summary.workspaceId}-${step}`,
      channel: 'summary-status',
      severity: null,
      blocking: snapshot.summaryStatus === 'blocked',
      kind: 'Step analysis status',
      title: `${step} analysis ${snapshot.summaryStatus}`,
      metric: 'qor_summary.status',
      actual: snapshot.summaryStatus,
      expected: null,
      condition: null,
      location: null,
      source: 'analysis/qor_summary.json',
      diagnosis: `${step} qor_summary.json reports status ${snapshot.summaryStatus}; no more specific finding was emitted.`,
    })
  }

  return issues.sort((left, right) => {
    const byChannel =
      CHANNEL_ORDER.indexOf(left.channel) - CHANNEL_ORDER.indexOf(right.channel)
    if (byChannel !== 0) return byChannel
    return reportedSeverityRank(left) - reportedSeverityRank(right)
  })
}

function reportedSeverityRank(issue: StepIssue): number {
  return issue.severity === null ? 3 : REPORTED_SEVERITY_RANK[issue.severity]
}

export function countStepIssues(issues: readonly StepIssue[]): StepIssueCounts {
  return {
    total: issues.length,
    blocking: issues.filter((issue) => issue.blocking).length,
  }
}

/**
 * Chips for the issue queue. Channels come from the findings themselves, so the row
 * never offers a filter that would return nothing.
 */
export function buildStepIssueFilters(issues: readonly StepIssue[]): StepIssueFilter[] {
  const filters: StepIssueFilter[] = [{ id: 'all', label: 'All', count: issues.length }]

  const blocking = issues.filter((issue) => issue.blocking)
  const blockingChannels = new Set(blocking.map((issue) => issue.channel))
  // With blocking findings confined to one channel, that channel's own chip already
  // selects them, so a second chip would return the same rows.
  if (blocking.length < issues.length && blockingChannels.size > 1) {
    filters.push({ id: 'blocking', label: 'Blocking', count: blocking.length })
  }

  const channels = CHANNEL_ORDER.filter((channel) =>
    issues.some((issue) => issue.channel === channel),
  )
  // A lone channel chip would just duplicate All.
  if (channels.length > 1) {
    for (const channel of channels) {
      filters.push({
        id: channel,
        label: CHANNEL_LABELS[channel],
        count: issues.filter((issue) => issue.channel === channel).length,
      })
    }
  }

  return filters
}

/**
 * These channels report nothing the queue row does not already show: no threshold, no
 * pass condition, no evidence selector, and a description that restates the title. An
 * evidence card for them would be a copy of the row, so the panel renders none and
 * leaves the artifact path on the row's tooltip instead.
 */
const CHANNELS_WITHOUT_EVIDENCE: readonly StepIssueChannel[] = [
  'hotspot',
  'artifact',
  'provenance',
]

export function hasStepIssueEvidence(issue: StepIssue): boolean {
  return !CHANNELS_WITHOUT_EVIDENCE.includes(issue.channel)
}

export function matchesStepIssueFilter(issue: StepIssue, filterId: string): boolean {
  if (filterId === 'all') return true
  if (filterId === 'blocking') return issue.blocking
  return issue.channel === filterId
}

export function buildStepVerdict(
  summary: ProjectWorkspaceSummary | null | undefined,
  step: FlowStep,
  issues: readonly StepIssue[],
): StepVerdict {
  const snapshot = stepSnapshot(summary, step)
  if (!summary || !snapshot) {
    return {
      status: 'no_data',
      label: 'No analysis',
      summary: `${step} has no V3 analysis artifacts for this workspace.`,
      facts: [],
    }
  }

  const counts = countStepIssues(issues)
  const status = snapshot.summaryStatus ?? null

  const availableArtifacts = ARTIFACTS.filter(
    (artifact) => snapshot[artifact.key] === 'available',
  ).length
  const invalidArtifacts = ARTIFACTS.filter(
    (artifact) => snapshot[artifact.key] === 'invalid',
  ).length

  const facts: StepVerdictFact[] = [
    {
      label: 'Flow',
      value: snapshot.flowStatus ?? 'unstart',
      tone:
        snapshot.flowStatus === 'success' || snapshot.flowStatus === 'reused'
          ? 'good'
          : snapshot.flowStatus === 'failed'
            ? 'bad'
            : 'neutral',
    },
    {
      label: 'Artifacts',
      value: `${availableArtifacts}/${ARTIFACTS.length}`,
      tone:
        invalidArtifacts > 0
          ? 'bad'
          : availableArtifacts < ARTIFACTS.length
            ? 'warn'
            : 'good',
    },
    {
      label: 'Metrics',
      value: String(snapshot.metrics.length),
      tone: snapshot.metrics.length > 0 ? 'neutral' : 'warn',
    },
  ]

  const coverage = cornerCoverage(snapshot, step)
  if (coverage) {
    facts.push({
      label: 'Corners',
      value: `${coverage.available}/${coverage.expected}`,
      tone: coverage.available < coverage.expected ? 'warn' : 'good',
    })
  }

  const signoff = signoffStatus(summary, step)
  if (signoff) {
    facts.push({
      label: 'Signoff',
      value: signoff,
      tone: signoff === 'pass' ? 'good' : signoff === 'blocked' ? 'bad' : 'warn',
    })
  }

  return {
    status,
    label: status === null ? null : verdictLabel(status),
    summary:
      counts.total === 0
        ? 'No findings reported for this step.'
        : counts.blocking > 0
          ? `${counts.total} findings · ${counts.blocking} listed as blocking`
          : `${counts.total} findings · none listed as blocking`,
    facts,
  }
}

export function buildStepTabs(
  steps: readonly ProjectStepCompareSummary[],
  summary: ProjectWorkspaceSummary | null | undefined,
): StepTab[] {
  return steps.map((stage) => {
    const snapshot = stepSnapshot(summary, stage.step)
    const counts = countStepIssues(buildStepIssues(summary, stage.step))
    return {
      step: stage.step,
      blockingCount: counts.blocking,
      findingCount: counts.total,
      analysisAvailability: stepAnalysisAvailability(snapshot),
    }
  })
}

export function buildStepWorkspaceChips(
  workspaceSummaries: readonly ProjectWorkspaceSummary[],
  qorTrendSummary: ProjectQorTrendSummary,
  bestWorkspaceId: string,
  step: FlowStep,
): StepWorkspaceChip[] {
  return workspaceSummaries.map((summary) => {
    const snapshot = stepSnapshot(summary, step)
    const counts = countStepIssues(buildStepIssues(summary, step))
    const availability = stepAnalysisAvailability(snapshot)
    return {
      workspaceId: summary.workspaceId,
      workspaceName: summary.workspaceName,
      tone: stepWorkspaceTone(counts, availability),
      statusLabel: stepWorkspaceStatusLabel(step, counts, availability),
      blockingCount: counts.blocking,
      findingCount: counts.total,
      isBaseline: summary.workspaceId === qorTrendSummary.baselineWorkspaceId,
      isBest: summary.workspaceId === bestWorkspaceId,
    }
  })
}

/** Every metric the selected workspace reported for this step, grouped by QoR dimension. */
export function buildStepMetricGroups(
  summary: ProjectWorkspaceSummary | null | undefined,
  baseline: ProjectWorkspaceSummary | null | undefined,
  step: FlowStep,
): StepMetricGroup[] {
  const records = (stepSnapshot(summary, step)?.metrics ?? []).filter(
    (record) => record.stepRole !== 'hidden',
  )
  const baselineRecords = stepSnapshot(baseline, step)?.metrics ?? []
  const isBaselineWorkspace =
    Boolean(baseline) && summary?.workspaceId === baseline?.workspaceId

  const groups = new Map<string, StepMetricGroup>()
  for (const record of records) {
    const baselineRecord = baselineRecords.find(
      (item) => item.metricName === record.metricName,
    )
    const row = buildMetricRow(record, baselineRecord ?? null, isBaselineWorkspace)
    const group = groups.get(record.dimension)
    if (group) {
      group.rows.push(row)
      continue
    }
    groups.set(record.dimension, {
      id: record.dimension,
      label: DIMENSION_LABELS[record.dimension] ?? titleFromIdentifier(record.dimension),
      rows: [row],
    })
  }

  return [...groups.values()].sort(
    (left, right) =>
      (DIMENSION_ORDER[left.id] ?? 99) - (DIMENSION_ORDER[right.id] ?? 99) ||
      left.label.localeCompare(right.label),
  )
}

export function buildStepDetailTables(
  summary: ProjectWorkspaceSummary | null | undefined,
  step: FlowStep,
): StepDetailTable[] {
  const snapshot = stepSnapshot(summary, step)
  if (!snapshot) return []

  const tables = snapshot.details.map((detail) => {
    const rows = detailRows(detail)
    const fields = detailFields(detail, rows)
    const drcEmptyState =
      detail.presentation === 'rule_layer_table' ? drcBreakdownEmptyState(snapshot) : null
    return {
      id: detail.id,
      title:
        DETAIL_TITLES[detail.presentation] ?? titleFromIdentifier(detail.presentation),
      sourceFile: detail.sourceFile,
      sourceStatus: snapshot.artifactStatus,
      coverage: detailCoverage(detail),
      columns: fields.map((field) => FIELD_LABELS[field] ?? titleFromIdentifier(field)),
      rows: rows.map((row) => fields.map((field) => detailValue(row, field))),
      emptyMessage: drcEmptyState?.message ?? 'No bounded detail rows are available.',
      emptyDetail: drcEmptyState?.detail ?? null,
    }
  })

  // A DRC result is still useful when qor_metrics.json omitted its optional rule/layer
  // descriptor. Keep the evidence slot visible without claiming that an empty table is clean.
  if (
    step === 'DRC' &&
    !snapshot.details.some((detail) => detail.presentation === 'rule_layer_table')
  ) {
    const drcEmptyState = drcBreakdownEmptyState(snapshot)
    tables.push({
      id: 'drc-rule-layer-breakdown',
      title: DETAIL_TITLES.rule_layer_table,
      sourceFile: 'analysis/qor_metrics.json',
      sourceStatus: snapshot.artifactStatus,
      coverage: null,
      columns: DETAIL_FIELDS.rule_layer_table.map(
        (field) => FIELD_LABELS[field] ?? titleFromIdentifier(field),
      ),
      rows: [],
      emptyMessage: drcEmptyState.message,
      emptyDetail: drcEmptyState.detail,
    })
  }

  return tables
}

/** Cross-workspace comparison of the curated key metrics, kept as a secondary view. */
export function buildStepCompareMatrix(
  stage: ProjectStepCompareSummary | null | undefined,
  workspaceSummaries: readonly ProjectWorkspaceSummary[],
  qorTrendSummary: ProjectQorTrendSummary,
  bestWorkspaceId: string,
  step: FlowStep,
): StepCompareMatrix {
  const baselineId = qorTrendSummary.baselineWorkspaceId
  const columns: StepCompareColumn[] = workspaceSummaries.map((summary) => ({
    workspaceId: summary.workspaceId,
    workspaceName: summary.workspaceName,
    isBaseline: summary.workspaceId === baselineId,
    isBest: summary.workspaceId === bestWorkspaceId,
  }))

  const rows = (stage?.metrics ?? []).map((metric) => {
    const meta = metricMeta(workspaceSummaries, step, metric.id)
    const baselinePoint = baselineId
      ? metric.points.find((point) => point.workspaceId === baselineId)
      : undefined

    return {
      id: metric.id,
      label: metric.label,
      descriptor: descriptorFor(meta?.unit, meta?.polarity, metric.hint),
      cells: columns.map((column) => {
        const point = metric.points.find(
          (item) => item.workspaceId === column.workspaceId,
        )
        const delta = deltaAgainst(
          point?.value ?? null,
          baselinePoint?.value ?? null,
          column.isBaseline,
          meta?.polarity,
        )
        return {
          workspaceId: column.workspaceId,
          workspaceName: column.workspaceName,
          value: point?.label ?? 'N/A',
          state: point?.state ?? 'pending',
          delta: delta.label,
          deltaTone: delta.tone,
        }
      }),
    }
  })

  return { columns, rows }
}

function buildMetricRow(
  record: ProjectQorMetricRecord,
  baselineRecord: ProjectQorMetricRecord | null,
  isBaselineWorkspace: boolean,
): StepMetricRow {
  const delta = deltaAgainst(
    record.value,
    baselineRecord?.value ?? null,
    isBaselineWorkspace,
    record.polarity,
  )
  return {
    id: record.metricName,
    label: record.displayName || record.metricName,
    value: formatScalar(record.value, record.unit),
    descriptor: descriptorFor(record.unit, record.polarity, record.confidence),
    corner: record.cornerContext?.label ?? record.corner,
    sourceFile: record.sourceFile,
    delta: delta.label,
    deltaTone: delta.tone,
  }
}

function deltaAgainst(
  value: number | null,
  baselineValue: number | null,
  isBaseline: boolean,
  polarity: string | undefined,
): { label: string | null; tone: StepTone } {
  if (isBaseline) {
    return { label: value === null ? null : 'base', tone: 'neutral' }
  }
  if (value === null || baselineValue === null) return { label: null, tone: 'neutral' }

  const delta = value - baselineValue
  if (delta === 0) return { label: '±0', tone: 'neutral' }

  // The surrounding header already names the baseline, so the sign carries the meaning.
  const label = `${delta > 0 ? '+' : '-'}${formatNumber(Math.abs(delta))}`
  if (polarity === 'lower_is_better') {
    return { label, tone: delta < 0 ? 'good' : 'bad' }
  }
  if (polarity === 'higher_is_better') {
    return { label, tone: delta > 0 ? 'good' : 'bad' }
  }
  return { label, tone: 'neutral' }
}

function metricMeta(
  workspaceSummaries: readonly ProjectWorkspaceSummary[],
  step: FlowStep,
  metricId: string,
): ProjectQorMetricRecord | null {
  for (const summary of workspaceSummaries) {
    const record = stepSnapshot(summary, step)?.metrics.find(
      (item) => item.metricName === metricId,
    )
    if (record) return record
  }
  return null
}

function descriptorFor(
  unit: string | undefined,
  polarity: string | undefined,
  fallback: string,
): string {
  const parts = [unit, polarity ? POLARITY_LABELS[polarity] : undefined].filter(Boolean)
  return parts.length > 0 ? parts.join(' / ') : fallback
}

function cornerCoverage(
  snapshot: ProjectAnalysisStepSnapshot,
  step: FlowStep,
): { available: number | string; expected: number | string } | null {
  const prefix = step === 'RCX' ? 'rcx_' : step === 'STA' ? 'sta_' : null
  if (!prefix) return null

  const available =
    snapshot.metrics.find((metric) => metric.metricName === `${prefix}corner_count`) ??
    snapshot.metrics.find((metric) => metric.metricName === `${prefix}spef_file_count`)
  const expected = snapshot.metrics.find(
    (metric) => metric.metricName === `${prefix}expected_corner_count`,
  )
  if (
    available?.value === null ||
    available?.value === undefined ||
    expected?.value === null ||
    expected?.value === undefined
  ) {
    return null
  }
  return { available: available.value, expected: expected.value }
}

function signoffStatus(
  summary: ProjectWorkspaceSummary,
  step: FlowStep,
): QorGateStatus | null {
  if (step !== 'RCX' && step !== 'STA') return null
  const statuses = summary.analysis.signoffReadiness.groups
    .filter((group) => group.step === step)
    .map((group) => group.status)
  if (statuses.length === 0) return null
  if (statuses.includes('blocked')) return 'blocked'
  if (statuses.includes('incomplete')) return 'incomplete'
  if (statuses.every((status) => status === 'pass')) return 'pass'
  return 'unavailable'
}

function verdictLabel(status: StepVerdictStatus): string {
  return (
    {
      pass: 'Pass',
      blocked: 'Blocked',
      incomplete: 'Incomplete',
      unavailable: 'Unavailable',
      no_data: 'No analysis',
    }[status] ?? status
  )
}

function detailRows(detail: ProjectQorDetailDescriptor): Record<string, unknown>[] {
  const summary = detail.summary
  if (detail.presentation === 'cts_clock_skew_table') {
    return [
      {
        clock_count: summary.clock_count,
        worst_optimized_skew_ns: summary.worst_optimized_skew_ns,
        worst_max_insertion_latency_ns: summary.worst_max_insertion_latency_ns,
        target_unmet_count: summary.target_unmet_count,
      },
    ].filter((row) => Object.values(row).some(isDisplayValue))
  }
  if (detail.presentation === 'place_map_summary') {
    return arrayRows(summary.maps).map((row) => ({
      group: row.group,
      metric: row.metric,
      top_5_percent_average: row.top_5_percent_average,
      max: row.max,
      high_bin_ratio: row.high_bin_ratio,
    }))
  }
  if (detail.presentation === 'layer_table') {
    return arrayRows(summary.layers).map((row) => ({
      layer: row.layer,
      dr_wirelength: recordValue(row.dr, 'wirelength'),
      dr_via_count: recordValue(row.dr, 'via_count'),
      la_overflow: recordValue(row.la, 'overflow'),
    }))
  }
  const key = DETAIL_ROW_KEYS[detail.presentation]
  return key ? arrayRows(summary[key]) : []
}

function detailFields(
  detail: ProjectQorDetailDescriptor,
  rows: readonly Record<string, unknown>[],
): string[] {
  return DETAIL_FIELDS[detail.presentation] ?? Object.keys(rows[0] ?? {}).slice(0, 5)
}

function detailCoverage(detail: ProjectQorDetailDescriptor): StepDetailTable['coverage'] {
  const coverage = isRecord(detail.summary.coverage) ? detail.summary.coverage : null
  if (!coverage) return null

  const status = stringValue(coverage.status)
  const expected = coverage.expected_count
  const available = coverage.available_count
  if (!status || !isDisplayValue(expected) || !isDisplayValue(available)) return null

  return {
    label: `${available}/${expected} corners`,
    status,
    tone: status === 'pass' ? 'good' : status === 'blocked' ? 'bad' : 'warn',
  }
}

function drcBreakdownEmptyState(snapshot: ProjectAnalysisStepSnapshot): {
  message: string
  detail: string | null
} {
  const count =
    snapshot.metrics.find((metric) => metric.metricName === 'drc_count')?.value ?? null
  const summary = snapshot.summaryStatus ? `Summary: ${snapshot.summaryStatus}` : null

  if (count === null) {
    return { message: 'DRC count unavailable', detail: summary }
  }

  return {
    message: count === 0 ? 'No rule/layer breakdown' : 'Breakdown unavailable',
    detail: [`DRC count: ${formatNumber(count)}`, summary].filter(Boolean).join(' · '),
  }
}

function stepWorkspaceTone(
  counts: StepIssueCounts,
  availability: ProjectAnalysisAvailability,
): StepTone {
  if (counts.blocking > 0) return 'bad'
  if (counts.total > 0 || availability === 'incomplete') return 'warn'
  if (availability === 'available') return 'good'
  return 'neutral'
}

function stepWorkspaceStatusLabel(
  step: FlowStep,
  counts: StepIssueCounts,
  availability: ProjectAnalysisAvailability,
): string {
  if (counts.blocking > 0) return `${step}: ${counts.blocking} listed as blocking`
  if (counts.total > 0) return `${step}: ${counts.total} findings reported`
  if (availability === 'incomplete') return `${step} analysis incomplete`
  if (availability === 'unavailable') return `${step} analysis unavailable`
  return `${step} analysis clean`
}

function detailValue(row: Record<string, unknown>, field: string): string {
  const value = row[field]
  if (isRecord(value)) {
    const label = stringValue(value.label)
    if (label) return label
    const wns = value.worst_wns ?? value.wns
    const tns = value.worst_tns ?? value.tns
    return [wns, tns].filter(isDisplayValue).join(' / ') || 'N/A'
  }
  return isDisplayValue(value) ? String(value) : 'N/A'
}

function findingCondition(
  metric: string,
  evidence: ProjectQorFindingEvidence,
  unit: string | undefined,
): string | null {
  if (!evidence.expectedOperator || evidence.expectedValue === null) return null
  return `${metric} ${evidence.expectedOperator} ${formatScalar(evidence.expectedValue, unit)}`
}

function evidenceLocation(evidence: ProjectQorFindingEvidence): string | null {
  if (!evidence.sourceFile) return null
  return evidence.sourceSelector
    ? `${evidence.sourceFile}#${evidence.sourceSelector}`
    : evidence.sourceFile
}

function timingDiagnosis(issue: ProjectQorTimingIssue): string {
  const delays = [
    issue.launchClockNetworkDelayNs === null
      ? null
      : `launch delay ${issue.launchClockNetworkDelayNs} ns`,
    issue.captureClockNetworkDelayNs === null
      ? null
      : `capture delay ${issue.captureClockNetworkDelayNs} ns`,
    issue.clockNetworkDelayDeltaNs === null
      ? null
      : `clock-delay delta ${issue.clockNetworkDelayDeltaNs} ns`,
  ]
    .filter((item): item is string => item !== null)
    .join(', ')
  // sta_timing_issues.json carries no threshold, so the slack is reported, not judged.
  return `${issue.corner} / ${issue.pathGroup} / ${issue.checkType}: slack ${issue.slackNs} ns.${delays ? ` ${delays}.` : ''}`
}

export function formatScalar(
  value: number | string | null | undefined,
  unit?: string,
): string {
  if (value === null || value === undefined) return 'Not reported'
  if (typeof value === 'string') return value
  const label = formatNumber(value)
  return unit ? `${label} ${unit}` : label
}

function formatOptionalScalar(
  value: number | string | null | undefined,
  unit?: string,
): string | null {
  if (value === null || value === undefined) return null
  return formatScalar(value, unit)
}

function formatNumber(value: number): string {
  const absolute = Math.abs(value)
  const digits = absolute > 0 && absolute < 0.01 ? 6 : absolute < 1 ? 4 : 3
  return String(Number(value.toFixed(digits)))
}

export function titleFromIdentifier(value: string): string {
  return value.replace(/[_-]+/g, ' ')
}

function arrayRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function recordValue(value: unknown, field: string): unknown {
  return isRecord(value) ? value[field] : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isDisplayValue(value: unknown): value is string | number {
  return (
    typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
  )
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
