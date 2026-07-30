<template>
  <section class="step-analysis" aria-label="Step analysis">
    <nav class="step-rail" aria-label="Flow steps">
      <button
        v-for="tab in stepTabs"
        :key="tab.step"
        type="button"
        class="step-rail-item"
        :class="{
          selected: tab.step === selectedStep,
          muted: tab.analysisAvailability === 'unavailable',
        }"
        :aria-pressed="tab.step === selectedStep"
        :title="stepTabTitle(tab)"
        @click="emit('select-step', tab.step)"
      >
        <span class="step-rail-name">{{ tab.step }}</span>
        <span class="step-rail-mark" :class="stepTabTone(tab)" aria-hidden="true">
          {{ stepTabBadge(tab) }}
        </span>
      </button>
    </nav>

    <div class="verdict-bar">
      <div class="workspace-picker" role="group" aria-label="Workspace">
        <button
          v-for="chip in workspaceChips"
          :key="chip.workspaceId"
          type="button"
          class="workspace-chip"
          :class="{ selected: chip.workspaceId === activeWorkspaceId }"
          :aria-pressed="chip.workspaceId === activeWorkspaceId"
          :title="workspaceChipTitle(chip)"
          @click="emit('select-workspace', chip.workspaceId)"
        >
          <i class="status-dot" :class="chip.tone" aria-hidden="true"></i>
          <span class="workspace-chip-name">{{ chip.workspaceName }}</span>
          <em
            v-if="chip.findingCount > 0"
            class="chip-count"
            :class="chip.blockingCount > 0 ? 'bad' : 'neutral'"
          >
            {{ chip.findingCount }}
          </em>
          <small v-if="chip.isBaseline" class="chip-role">base</small>
          <small v-if="chip.isBest" class="chip-role accent">best</small>
        </button>
      </div>

      <div class="verdict" aria-label="Step verdict">
        <span v-if="verdict.status" class="verdict-badge" :class="verdict.status">
          {{ verdict.label }}
        </span>
        <span class="verdict-summary">{{ verdict.summary }}</span>
        <span v-for="fact in verdict.facts" :key="fact.label" class="verdict-fact">
          <small>{{ fact.label }}</small>
          <strong :class="fact.tone">{{ fact.value }}</strong>
        </span>
      </div>
    </div>

    <div class="step-body">
      <section class="issue-pane" aria-label="Issues">
        <header class="pane-header">
          <span class="pane-title">Issues</span>
          <div class="severity-filters" aria-label="Filter issues by finding channel">
            <button
              v-for="filter in issueFilters"
              :key="filter.id"
              type="button"
              :class="{ selected: issueFilter === filter.id }"
              :aria-pressed="issueFilter === filter.id"
              @click="issueFilter = filter.id"
            >
              {{ filter.label }} {{ filter.count }}
            </button>
          </div>
        </header>

        <ul v-if="filteredIssues.length > 0" class="issue-list">
          <li v-for="issue in filteredIssues" :key="issue.id">
            <button
              type="button"
              class="issue-item"
              :class="[
                issue.severity,
                { blocking: issue.blocking, selected: issue.id === selectedIssue?.id },
              ]"
              :aria-current="issue.id === selectedIssue?.id ? 'true' : undefined"
              :title="issueRowTitle(issue)"
              @click="selectedIssueId = issue.id"
            >
              <span class="issue-kind">{{ issue.kind }}</span>
              <strong class="issue-title">{{ issue.title }}</strong>
              <code class="issue-actual">{{ issue.actual }}</code>
            </button>
          </li>
        </ul>
        <p v-else class="pane-empty">{{ issueEmptyMessage }}</p>
      </section>

      <section class="evidence-pane" aria-label="Evidence">
        <article
          v-if="evidenceIssue"
          class="evidence-card"
          :class="[evidenceIssue.severity, { blocking: evidenceIssue.blocking }]"
        >
          <header>
            <strong class="evidence-kind">{{ evidenceIssue.kind }}</strong>
            <span v-if="evidenceIssue.blocking" class="evidence-flag">blocking</span>
            <span v-if="evidenceIssue.severity" class="evidence-severity">
              {{ evidenceIssue.severity }}
            </span>
          </header>
          <dl class="evidence-facts">
            <div>
              <dt>Actual</dt>
              <dd class="mono strong">{{ evidenceIssue.actual }}</dd>
            </div>
            <div v-if="evidenceIssue.expected">
              <dt>Expected</dt>
              <dd class="mono">{{ evidenceIssue.expected }}</dd>
            </div>
            <div v-if="evidenceIssue.condition">
              <dt>Pass condition</dt>
              <dd class="mono">{{ evidenceIssue.condition }}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd class="mono">
                {{ evidenceIssue.location ?? evidenceIssue.source }}
                <span v-if="evidenceMetricId(evidenceIssue)" class="evidence-metric-id">
                  {{ evidenceMetricId(evidenceIssue) }}
                </span>
              </dd>
            </div>
            <div v-if="evidenceIssue.diagnosis" class="evidence-diagnosis">
              <dt>Diagnosis</dt>
              <dd>{{ evidenceIssue.diagnosis }}</dd>
            </div>
          </dl>
        </article>
        <p v-else-if="!selectedIssue" class="pane-empty">{{ evidenceEmptyMessage }}</p>

        <section class="evidence-block" aria-label="Step metrics">
          <header class="pane-header">
            <span class="pane-title">Metrics</span>
            <small>{{ metricsCaption }}</small>
          </header>
          <div v-if="metricGroups.length > 0" class="metric-groups">
            <div v-for="group in metricGroups" :key="group.id" class="metric-group">
              <span class="metric-group-label">{{ group.label }}</span>
              <div
                v-for="row in group.rows"
                :key="row.id"
                class="metric-row"
                :class="{ highlighted: row.id === selectedIssue?.metric }"
                :title="metricRowTitle(row)"
              >
                <span class="metric-name">{{ row.label }}</span>
                <span class="metric-value mono">{{ row.value }}</span>
                <span v-if="row.delta" class="metric-delta" :class="row.deltaTone">
                  {{ row.delta }}
                </span>
              </div>
            </div>
          </div>
          <p v-else class="pane-empty">
            No V3 metrics were reported for {{ selectedStep }} in this workspace.
          </p>
        </section>

        <section
          v-for="table in detailTables"
          :key="table.id"
          class="evidence-block"
          :aria-label="table.title"
        >
          <header class="pane-header">
            <span class="pane-title">{{ table.title }}</span>
            <small v-if="table.coverage" :class="table.coverage.tone">
              {{ table.coverage.label }} · {{ table.coverage.status }}
            </small>
            <small
              v-else
              :class="detailSourceTone(table.sourceStatus)"
              :title="`${table.sourceFile}: ${table.sourceStatus}`"
            >
              {{ detailSourceLabel(table.sourceFile, table.sourceStatus) }}
            </small>
          </header>
          <div v-if="table.rows.length > 0" class="detail-table-wrap">
            <table>
              <thead>
                <tr>
                  <th v-for="column in table.columns" :key="column">{{ column }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in table.rows" :key="`${table.id}-${index}`">
                  <td v-for="(cell, cellIndex) in row" :key="cellIndex" :title="cell">
                    {{ cell }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="pane-empty pane-empty-detail">
            <span>{{ table.emptyMessage }}</span>
            <small v-if="table.emptyDetail">{{ table.emptyDetail }}</small>
          </p>
        </section>
      </section>
    </div>

    <section class="compare-drawer" aria-label="Cross-workspace comparison">
      <button
        type="button"
        class="compare-toggle"
        :aria-expanded="compareOpen"
        :aria-controls="compareOpen ? 'step-compare-region' : undefined"
        @click="compareOpen = !compareOpen"
      >
        <span class="compare-caret" aria-hidden="true">{{
          compareOpen ? '▾' : '▸'
        }}</span>
        Compare {{ compareMatrix.columns.length }} workspaces on {{ selectedStep }}
        <small>baseline {{ qorTrendSummary.baselineLabel }}</small>
      </button>
      <div v-if="compareOpen" id="step-compare-region" class="compare-region">
        <div
          v-if="compareMatrix.rows.length > 0"
          class="compare-table"
          role="grid"
          :aria-colcount="compareMatrix.columns.length + 1"
          :aria-rowcount="compareMatrix.rows.length + 1"
        >
          <div class="compare-row" role="row" :style="compareGridStyle">
            <div role="columnheader" class="compare-corner">Metric</div>
            <div
              v-for="column in compareMatrix.columns"
              :key="column.workspaceId"
              role="columnheader"
              class="compare-head"
              :class="{ selected: column.workspaceId === activeWorkspaceId }"
            >
              <button type="button" @click="emit('select-workspace', column.workspaceId)">
                {{ column.workspaceName }}
                <small v-if="column.isBaseline">base</small>
              </button>
            </div>
          </div>
          <div
            v-for="row in compareMatrix.rows"
            :key="row.id"
            class="compare-row"
            role="row"
            :style="compareGridStyle"
          >
            <div role="rowheader" class="compare-metric" :title="row.descriptor">
              <strong>{{ row.label }}</strong>
              <small>{{ row.descriptor }}</small>
            </div>
            <div
              v-for="cell in row.cells"
              :key="`${row.id}-${cell.workspaceId}`"
              role="gridcell"
              class="compare-cell"
              :class="[cell.state, { selected: cell.workspaceId === activeWorkspaceId }]"
            >
              <button
                type="button"
                :title="`${cell.workspaceName} ${row.label}: ${cell.value}`"
                @click="emit('select-workspace', cell.workspaceId)"
              >
                <strong>{{ cell.value }}</strong>
                <small v-if="cell.delta" :class="cell.deltaTone">{{ cell.delta }}</small>
              </button>
            </div>
          </div>
        </div>
        <p v-else class="pane-empty">
          No comparable key metrics are registered for {{ selectedStep }}.
        </p>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  buildStepCompareMatrix,
  buildStepDetailTables,
  buildStepIssueFilters,
  buildStepIssues,
  buildStepMetricGroups,
  buildStepTabs,
  buildStepVerdict,
  buildStepWorkspaceChips,
  countStepIssues,
  hasStepIssueEvidence,
  matchesStepIssueFilter,
  type StepIssue,
  type StepMetricRow,
  type StepTab,
  type StepWorkspaceChip,
} from './projectStepAnalysis'
import type {
  FlowStep,
  ProjectStepCompareSummary,
  ProjectWorkspaceSummary,
} from '@/utils/projectManagement'
import type { ProjectQorTrendSummary } from '@/utils/projectQorTrend'

const props = defineProps<{
  steps: ProjectStepCompareSummary[]
  workspaceSummaries: ProjectWorkspaceSummary[]
  qorTrendSummary: ProjectQorTrendSummary
  projectName: string
  projectObjective: string
  bestWorkspaceId: string
  bestWorkspaceReason?: string
  selectedStep: FlowStep
  selectedWorkspaceId: string
  selectedIssueMetric?: string | null
}>()

const emit = defineEmits<{
  'select-step': [step: FlowStep]
  'select-workspace': [workspaceId: string]
}>()

const issueFilter = ref('all')
const selectedIssueId = ref<string | null>(null)
const compareOpen = ref(false)

const activeWorkspace = computed(
  () =>
    props.workspaceSummaries.find(
      (summary) => summary.workspaceId === props.selectedWorkspaceId,
    ) ??
    props.workspaceSummaries[0] ??
    null,
)
const activeWorkspaceId = computed(() => activeWorkspace.value?.workspaceId ?? '')
const baselineWorkspace = computed(
  () =>
    props.workspaceSummaries.find(
      (summary) => summary.workspaceId === props.qorTrendSummary.baselineWorkspaceId,
    ) ?? null,
)

const issues = computed(() => buildStepIssues(activeWorkspace.value, props.selectedStep))
const issueCounts = computed(() => countStepIssues(issues.value))
const issueFilters = computed(() => buildStepIssueFilters(issues.value))
const filteredIssues = computed(() =>
  issues.value.filter((issue) => matchesStepIssueFilter(issue, issueFilter.value)),
)
// Falls back to the first queued issue so the evidence pane is never empty after
// switching step, workspace, or filter.
const selectedIssue = computed(
  () =>
    filteredIssues.value.find((issue) => issue.id === selectedIssueId.value) ??
    filteredIssues.value[0] ??
    null,
)
// Channels whose artifacts add nothing past the queue row get no card at all, so the
// pane goes straight to the step metrics with the matching row highlighted.
const evidenceIssue = computed(() =>
  selectedIssue.value && hasStepIssueEvidence(selectedIssue.value)
    ? selectedIssue.value
    : null,
)
const issueEmptyMessage = computed(() =>
  issueCounts.value.total === 0
    ? `No findings reported for ${props.selectedStep} in this workspace.`
    : 'No findings match this filter.',
)
const evidenceEmptyMessage = computed(() =>
  issueCounts.value.total === 0
    ? `No findings reported for ${props.selectedStep} in this workspace.`
    : 'No findings match this filter.',
)

// Context changes start from the complete queue. A metric supplied by Dashboard then
// becomes the selected evidence, instead of relying on whichever issue happens to sort first.
watch(
  [() => props.selectedStep, activeWorkspaceId, () => props.selectedIssueMetric],
  () => {
    issueFilter.value = 'all'
    const requested = props.selectedIssueMetric
      ? issues.value.find((issue) => issue.metric === props.selectedIssueMetric)
      : null
    selectedIssueId.value = requested?.id ?? null
  },
  { immediate: true },
)

const verdict = computed(() =>
  buildStepVerdict(activeWorkspace.value, props.selectedStep, issues.value),
)
const stepTabs = computed(() => buildStepTabs(props.steps, activeWorkspace.value))
const workspaceChips = computed(() =>
  buildStepWorkspaceChips(
    props.workspaceSummaries,
    props.qorTrendSummary,
    props.bestWorkspaceId,
    props.selectedStep,
  ),
)
const metricGroups = computed(() =>
  buildStepMetricGroups(
    activeWorkspace.value,
    baselineWorkspace.value,
    props.selectedStep,
  ),
)
const detailTables = computed(() =>
  buildStepDetailTables(activeWorkspace.value, props.selectedStep),
)
const compareMatrix = computed(() =>
  buildStepCompareMatrix(
    props.steps.find((stage) => stage.step === props.selectedStep) ?? null,
    props.workspaceSummaries,
    props.qorTrendSummary,
    props.bestWorkspaceId,
    props.selectedStep,
  ),
)
const compareGridStyle = computed(() => ({
  gridTemplateColumns: `minmax(180px, 1.4fr) repeat(${compareMatrix.value.columns.length}, minmax(108px, 1fr))`,
}))
const metricsCaption = computed(() => {
  const name = activeWorkspace.value?.workspaceName ?? 'No workspace'
  const baseline = baselineWorkspace.value
  if (!baseline || baseline.workspaceId === activeWorkspaceId.value) {
    return `${name} · reference workspace`
  }
  return `${name} · vs ${baseline.workspaceName}`
})

// Red is reserved for what the artifacts call blocking. Other findings are counted but
// not ranked, since their importance is not something these artifacts report.
function stepTabTone(tab: StepTab): string {
  if (tab.blockingCount > 0) return 'bad'
  if (tab.findingCount > 0 || tab.analysisAvailability === 'incomplete') return 'warn'
  if (tab.analysisAvailability === 'available') return 'good'
  return 'none'
}

function stepTabBadge(tab: StepTab): string {
  return tab.findingCount > 0 ? String(tab.findingCount) : ''
}

function stepTabTitle(tab: StepTab): string {
  if (tab.analysisAvailability === 'unavailable')
    return `${tab.step}: analysis unavailable`
  if (tab.analysisAvailability === 'incomplete') return `${tab.step}: analysis incomplete`
  return `${tab.step}: ${tab.findingCount} findings, ${tab.blockingCount} listed as blocking`
}

function workspaceChipTitle(chip: StepWorkspaceChip): string {
  const roles = [chip.isBaseline ? 'baseline' : null, chip.isBest ? 'best' : null]
    .filter(Boolean)
    .join(', ')
  const suffix = roles ? ` (${roles})` : ''
  const findings = `${chip.findingCount} findings, ${chip.blockingCount} listed as blocking`
  return `${chip.workspaceName} · ${chip.statusLabel}${suffix} · ${findings}`
}

function detailSourceLabel(
  sourceFile: string,
  status: 'available' | 'missing' | 'invalid',
): string {
  return status === 'available' ? sourceFile : `QoR metrics: ${status}`
}

function detailSourceTone(status: 'available' | 'missing' | 'invalid'): string {
  if (status === 'invalid') return 'bad'
  if (status === 'missing') return 'warn'
  return 'neutral'
}

/** Keeps the artifact path reachable for the channels that get no evidence card. */
function issueRowTitle(issue: StepIssue): string {
  return [issue.location ?? issue.source, issue.diagnosis].filter(Boolean).join(' · ')
}

/**
 * Some channels use the artifact path as their metric id, or already name the metric in
 * the evidence selector, so printing it again would just repeat the line.
 */
function evidenceMetricId(issue: StepIssue): string | null {
  const source = issue.location ?? issue.source
  return source.includes(issue.metric) ? null : issue.metric
}

function metricRowTitle(row: StepMetricRow): string {
  return [row.label, row.descriptor, row.corner, row.sourceFile]
    .filter(Boolean)
    .join(' · ')
}
</script>

<style scoped src="./projectStepAnalysisPanel.css"></style>
