<template>
  <section class="analysis-panel mockup-analysis-panel" aria-label="Analysis">
    <div class="analysis-heading">
      <p id="project-analysis-subtitle" class="analysis-subtitle">
        {{ analysisSubtitle }}
      </p>
      <div class="analysis-tabs" role="tablist" aria-label="Analysis views">
        <button
          type="button"
          role="tab"
          :aria-selected="selectedAnalysisTab === 'dashboard'"
          :class="{ selected: selectedAnalysisTab === 'dashboard' }"
          @click="selectAnalysisTab('dashboard')"
        >
          Dashboard
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="selectedAnalysisTab === 'step'"
          :class="{ selected: selectedAnalysisTab === 'step' }"
          @click="selectAnalysisTab('step')"
        >
          Step Analysis
        </button>
      </div>
    </div>

    <div
      v-if="hasProjectData && selectedAnalysisTab === 'dashboard'"
      class="analysis-dashboard-v3"
    >
      <div class="dashboard-summary-strip" aria-label="Project summary">
        <section class="dashboard-card dashboard-run-state-card" aria-label="Run state">
          <div class="run-state-main">
            <div class="run-state-layout">
              <div
                class="run-state-pie"
                :style="{ background: runStatePieBackground }"
                aria-hidden="true"
              ></div>
              <div class="run-state-copy">
                <div class="dashboard-stat-row">
                  <strong>{{ project.dashboardSummary.workspaceCount }}</strong>
                  <small>workspaces</small>
                </div>
                <div class="run-state-legend" aria-label="Workspace run state pie legend">
                  <span
                    v-for="slice in project.dashboardSummary.runStateSlices"
                    :key="slice.state"
                  >
                    <i :class="runStateSliceClass(slice.state)"></i>
                    {{ slice.label }} {{ slice.count }}
                  </span>
                </div>
              </div>
            </div>
            <div class="dashboard-pill-row">
              <span
                :class="
                  dashboardPillClass(project.dashboardSummary.drcCleanCount, 'success')
                "
                >{{ project.dashboardSummary.drcCleanCount }} DRC clean</span
              >
              <span
                :class="
                  dashboardPillClass(project.dashboardSummary.timingCleanCount, 'success')
                "
                >{{ project.dashboardSummary.timingCleanCount }} timing clean</span
              >
              <span
                :class="
                  dashboardPillClass(project.dashboardSummary.signoffReadyCount, 'info')
                "
                >{{ project.dashboardSummary.signoffReadyCount }} signoff ready</span
              >
            </div>
          </div>
        </section>

        <section
          class="dashboard-card dashboard-best-card"
          :class="{ 'is-empty': !hasBestFrequencyData }"
          aria-label="Best Frequency workspace"
        >
          <header class="best-card-header">
            <div>
              <span>Best Frequency</span>
              <strong>{{ bestFrequencyWorkspace?.workspaceId ?? '—' }}</strong>
            </div>
            <span
              v-if="hasBestFrequencyData"
              :class="
                dashboardPillClass(project.dashboardSummary.drcCleanCount, 'success')
              "
              >{{ project.dashboardSummary.drcCleanCount }} DRC clean</span
            >
          </header>
          <div v-if="hasBestFrequencyData" class="best-ppa-grid">
            <div
              v-for="metric in bestWorkspacePpaMetrics"
              :key="metric.id"
              class="best-ppa-item"
            >
              <span>{{ metric.label }}</span>
              <strong :class="metricValueClass(metric.state)">{{
                metric.display
              }}</strong>
            </div>
          </div>
          <p v-else class="best-empty-hint">No frequency data yet</p>
        </section>
      </div>

      <ProjectQorTrendPanel
        :qor-trend-summary="project.qorTrendSummary"
        :selected-workspace-id="selectedWorkspaceId"
        @export-report="exportReport"
        @set-baseline="setBaseline"
        @select-workspace="selectWorkspace($event.workspaceId)"
      />

      <section class="dashboard-card dashboard-chart-card dashboard-key-metric-card">
        <div
          class="dashboard-key-metric-table"
          :style="{
            '--dashboard-metric-count': String(dashboardMetricRows.length),
            gridTemplateColumns: dashboardMetricColumnsTemplate(dashboardMetricRows),
          }"
          aria-label="Workspace key metrics comparison"
        >
          <button
            type="button"
            class="dashboard-key-header dashboard-key-workspace-header"
            :class="{ 'is-sorted': dashboardSort?.key === 'workspace' }"
            :aria-sort="metricSortAriaValue(dashboardSort, 'workspace')"
            @click="toggleMetricSort('dashboard', 'workspace')"
          >
            <span>Workspace</span>
            <i
              v-if="dashboardSort?.key === 'workspace'"
              :class="sortIconClass(dashboardSort.direction)"
              class="metric-sort-icon"
              aria-hidden="true"
            ></i>
          </button>
          <button
            v-for="metric in dashboardMetricRows"
            :key="metric.id"
            type="button"
            class="dashboard-key-header"
            :class="{
              'is-sparse': !metricHasComparableData(metric),
              'is-sorted': dashboardSort?.key === metric.id,
            }"
            :aria-sort="metricSortAriaValue(dashboardSort, metric.id)"
            :title="`Sort by ${metric.label}`"
            @click="toggleMetricSort('dashboard', metric.id)"
          >
            <span>{{ metric.label }}</span>
            <i
              v-if="dashboardSort?.key === metric.id"
              :class="sortIconClass(dashboardSort.direction)"
              class="metric-sort-icon"
              aria-hidden="true"
            ></i>
          </button>
          <template v-for="row in displayedDashboardWorkspaceRows" :key="row.workspaceId">
            <button
              type="button"
              class="dashboard-key-workspace-cell"
              :class="{ selected: row.workspaceId === selectedWorkspaceId }"
              @click="selectWorkspace(row.workspaceId)"
            >
              {{ row.workspaceId }}
            </button>
            <button
              v-for="cell in row.cells"
              :key="`${row.workspaceId}-${cell.metric.id}`"
              type="button"
              class="dashboard-key-metric-cell"
              :class="[
                metricValueClass(cell.point.state),
                {
                  selected: row.workspaceId === selectedWorkspaceId,
                  'is-sparse': !metricHasComparableData(cell.metric),
                },
              ]"
              :title="metricCellTitle(row.workspaceId, cell.metric.label, cell.point)"
              @click="selectWorkspace(row.workspaceId)"
            >
              <strong>
                <i
                  v-if="cell.metric.id === 'drc' && cell.point.value !== null"
                  class="metric-status-dot"
                  aria-hidden="true"
                ></i>
                {{ cell.point.label }}
              </strong>
            </button>
          </template>
        </div>
      </section>
    </div>

    <ProjectStepAnalysisPanel
      v-else-if="hasProjectData"
      :steps="project.stepCompareSummaries"
      :workspace-summaries="project.workspaceSummaries"
      :qor-trend-summary="project.qorTrendSummary"
      :selected-step="selectedStep"
      :selected-workspace-id="selectedWorkspaceId"
      @select-step="selectStep"
      @select-workspace="selectWorkspace"
    />

    <div v-else class="metrics-empty-state">
      <i class="ri-line-chart-line" aria-hidden="true"></i>
      <strong>No project data available</strong>
      <span
        >Import a project or create one, then add a workspace to populate
        analysis.</span
      >
      <div class="empty-state-actions">
        <button
          type="button"
          class="empty-state-action primary"
          @click="emit('import-project')"
        >
          Import Project
        </button>
        <button type="button" class="empty-state-action" @click="emit('new-project')">
          New Project
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import ProjectQorTrendPanel from '@/components/ProjectQorTrendPanel.vue'
import ProjectStepAnalysisPanel from '@/components/ProjectStepAnalysisPanel.vue'
import {
  type FlowStep,
  type ProjectManagementProject,
  type ProjectMetricPoint,
} from '@/utils/projectManagement'
import {
  buildBestWorkspacePpaMetrics,
  buildDashboardMetricRows,
  buildDashboardWorkspaceMetricRows,
  buildRunStatePieBackground,
  dashboardMetricColumnsTemplate,
  dashboardPillClass,
  findBestFrequencyWorkspace,
  metricHasComparableData,
  metricSortAriaValue,
  metricValueClass,
  nextMetricSortState,
  runStateSliceClass,
  sortWorkspaceMetricRows,
  type MetricTableSortDirection,
  type MetricTableSortKey,
  type MetricTableSortState,
} from './projectAnalysisPresentation'

type AnalysisTab = 'dashboard' | 'step'

const props = defineProps<{
  project: ProjectManagementProject
  selectedAnalysisTab: AnalysisTab
  selectedStep: FlowStep
  selectedWorkspaceId: string
}>()

const emit = defineEmits<{
  'select-analysis-tab': [tab: AnalysisTab]
  'select-step': [step: FlowStep]
  'select-workspace': [workspaceId: string]
  'export-report': []
  'set-baseline': [{ workspaceId: string }]
  'import-project': []
  'new-project': []
}>()

const dashboardSort = ref<MetricTableSortState | null>(null)

const hasProjectData = computed(() => props.project.workspaces.length > 0)
const analysisSubtitle = computed(() => {
  const count = props.project.workspaces.length
  const workspaceLabel = `${count} workspace${count === 1 ? '' : 's'}`
  if (props.selectedAnalysisTab === 'dashboard') {
    return `${workspaceLabel} · key metrics`
  }
  return `${workspaceLabel} · ${props.selectedStep} comparison`
})
const dashboardMetricRows = computed(() =>
  buildDashboardMetricRows(
    props.project.metricsRows,
    props.project.dashboardSummary.flowMetricSummary,
  ),
)
const dashboardWorkspaceMetricRows = computed(() =>
  buildDashboardWorkspaceMetricRows(props.project.workspaces, dashboardMetricRows.value),
)
const displayedDashboardWorkspaceRows = computed(() =>
  sortWorkspaceMetricRows(dashboardWorkspaceMetricRows.value, dashboardSort.value),
)
const bestFrequencyWorkspace = computed(() =>
  findBestFrequencyWorkspace(dashboardMetricRows.value),
)
const bestWorkspacePpaMetrics = computed(() =>
  buildBestWorkspacePpaMetrics(
    dashboardMetricRows.value,
    bestFrequencyWorkspace.value?.workspaceId,
  ),
)
const hasBestFrequencyData = computed(() => bestWorkspacePpaMetrics.value.length > 0)
const runStatePieBackground = computed(() =>
  buildRunStatePieBackground(props.project.dashboardSummary.runStateSlices),
)

function metricCellTitle(
  workspaceId: string,
  metricLabel: string,
  point: ProjectMetricPoint,
): string {
  if (point.value === null) return `${workspaceId} ${metricLabel}: ${point.label}`
  return `${workspaceId} ${metricLabel}: ${point.value} (${point.label})`
}

function sortIconClass(direction: MetricTableSortDirection): string {
  return direction === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'
}

function toggleMetricSort(
  target: 'dashboard' | 'step',
  key: MetricTableSortKey,
): void {
  if (target !== 'dashboard') return
  dashboardSort.value = nextMetricSortState(dashboardSort.value, key)
}

function selectAnalysisTab(tab: AnalysisTab): void {
  emit('select-analysis-tab', tab)
}

function selectStep(step: FlowStep): void {
  emit('select-step', step)
}

function selectWorkspace(workspaceId: string): void {
  emit('select-workspace', workspaceId)
}

function exportReport(): void {
  emit('export-report')
}

function setBaseline(payload: { workspaceId: string }): void {
  emit('set-baseline', payload)
}
</script>

<style scoped src="./projectAnalysisPanel.css"></style>
