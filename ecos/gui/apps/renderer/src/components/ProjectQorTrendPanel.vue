<template>
  <div class="qor-overview-panel" aria-label="QoR Overview">
    <section
      v-if="baselineChangePending"
      class="qor-baseline-confirmation"
      role="group"
      aria-label="Confirm QoR baseline change"
    >
      <span>
        Use <strong>{{ baselineChangePending }}</strong> as the QoR baseline for this
        project?
      </span>
      <div>
        <button type="button" class="qor-inline-action" @click="cancelBaselineChange">
          Cancel
        </button>
        <button
          type="button"
          class="qor-inline-action primary"
          @click="confirmBaselineChange"
        >
          Confirm baseline
        </button>
      </div>
    </section>

    <div class="qor-panel-toolbar">
      <div class="qor-toolbar-leading">
        <p class="qor-selection-context">
          <template v-if="selectedWorkspaceIsBaseline">
            <span>Viewing baseline</span>
            <strong>{{ baselineLabel }}</strong>
          </template>
          <template v-else>
            <span>Comparing</span>
            <strong>{{ selectedWorkspace?.workspaceId ?? 'No workspace' }}</strong>
            <span>with baseline</span>
            <strong>{{ baselineLabel }}</strong>
          </template>
        </p>
        <div class="qor-toolbar-meta">
          <span class="qor-meta-chip">Baseline: {{ baselineLabel }}</span>
          <span class="qor-meta-chip" :class="`qor-signoff-${selectedSignoffStatus}`">
            Signoff: {{ selectedSignoffStatus }}
          </span>
        </div>
      </div>
      <div class="qor-toolbar-actions">
        <div class="qor-baseline-action">
          <button
            type="button"
            class="qor-toolbar-button"
            title="Set selected workspace as the project QoR baseline"
            aria-label="Set selected workspace as the project QoR baseline"
            :disabled="!canSetSelectedWorkspaceAsBaseline"
            @click="requestSetSelectedWorkspaceAsBaseline"
          >
            <i class="ri-flag-line" aria-hidden="true"></i>
            <span>Set Baseline</span>
          </button>
        </div>
        <button
          type="button"
          class="qor-toolbar-button"
          title="Export QoR report"
          aria-label="Export QoR report"
          @click="exportReport"
        >
          <i class="ri-download-line" aria-hidden="true"></i>
          <span>Export</span>
        </button>
      </div>
    </div>

    <section class="qor-attention" aria-label="Current engineering attention">
      <header>
        <div>
          <span>Needs attention</span>
          <small
            >Prioritized for
            {{ selectedWorkspace?.workspaceId ?? 'the selected workspace' }}</small
          >
        </div>
        <small class="qor-attention-threshold">{{ attentionThresholdContext }}</small>
      </header>
      <ol v-if="attentionItems.length > 0" class="qor-attention-list">
        <li
          v-for="(item, index) in attentionItems"
          :key="item.id"
          class="qor-attention-item"
          :class="item.tone"
        >
          <span class="qor-attention-rank">{{ index === 0 ? 'Priority' : 'Next' }}</span>
          <strong>{{ item.label }}</strong>
          <small>{{ item.detail }}</small>
        </li>
      </ol>
      <p v-else class="qor-attention-empty">
        No active QoR findings for this workspace. Review the score trend for comparison.
      </p>
    </section>

    <div class="qor-main-grid">
      <section class="qor-trend-card qor-chart-card">
        <div class="qor-section-title">
          <div class="qor-score-heading">
            <span>Overall Score</span>
            <strong v-if="highestTrendScore !== null" class="qor-best-score-chip">
              {{ formatScore(highestTrendScore) }}
              <em>best</em>
            </strong>
            <strong v-else class="qor-best-score-chip muted">NR</strong>
          </div>
          <div class="qor-section-meta">
            <small>{{ qorTrendSummary.trendPoints.length }} workspaces</small>
            <em class="qor-score-context" :class="selectedScoreClass">{{
              selectedScoreContext
            }}</em>
          </div>
        </div>
        <div
          ref="chartViewport"
          class="qor-chart-viewport"
          aria-label="Overall QoR score by workspace"
        >
          <svg
            class="qor-score-chart"
            :viewBox="chartViewBox"
            role="img"
            aria-label="Overall QoR score by workspace from 0 to 100"
            aria-describedby="qor-chart-description"
          >
            <rect
              class="qor-chart-plot-bg"
              :x="chartLeft"
              :y="chartTop"
              :width="Math.max(0, chartPlotRight - chartLeft)"
              :height="Math.max(0, chartBottom - chartTop)"
              rx="1.2"
            />
            <g v-for="score in scoreTicks" :key="score">
              <line
                class="qor-chart-gridline"
                :class="{ threshold: score === 60 }"
                :x1="chartLeft"
                :x2="chartPlotRight"
                :y1="scoreToChartY(score)"
                :y2="scoreToChartY(score)"
              />
              <text
                class="qor-chart-score-label"
                :class="{ threshold: score === 60 }"
                :x="chartLeft - 2.4"
                :y="scoreToChartY(score)"
                text-anchor="end"
                dominant-baseline="middle"
              >
                {{ score }}
              </text>
            </g>
            <line
              class="qor-chart-axis qor-chart-y-axis"
              :x1="chartLeft"
              :x2="chartLeft"
              :y1="chartTop"
              :y2="chartBottom"
            />
            <line
              class="qor-chart-axis qor-chart-x-axis"
              :x1="chartLeft"
              :x2="chartPlotRight"
              :y1="chartBottom"
              :y2="chartBottom"
            />
            <g
              v-for="point in scoreChartPoints"
              :key="point.workspaceId"
              class="qor-lollipop"
              :class="{
                rated: !point.isNotRated,
                best: point.isBest && !point.isNotRated,
                selected: point.workspaceId === selectedWorkspace?.workspaceId,
                baseline: point.workspaceId === qorTrendSummary.baselineWorkspaceId,
              }"
            >
              <line
                class="qor-chart-stem"
                :class="{
                  rated: !point.isNotRated,
                  best: point.isBest && !point.isNotRated,
                  selected: point.workspaceId === selectedWorkspace?.workspaceId,
                  baseline: point.workspaceId === qorTrendSummary.baselineWorkspaceId,
                }"
                :x1="point.x"
                :x2="point.x"
                :y1="chartBottom"
                :y2="point.y"
              />
              <circle
                v-if="!point.isNotRated"
                class="qor-chart-point"
                :class="{
                  best: point.isBest,
                  selected: point.workspaceId === selectedWorkspace?.workspaceId,
                  baseline: point.workspaceId === qorTrendSummary.baselineWorkspaceId,
                }"
                :cx="point.x"
                :cy="point.y"
                :r="point.workspaceId === selectedWorkspace?.workspaceId ? 2.4 : 1.85"
              >
                <title>{{ chartPointDescription(point) }}</title>
              </circle>
              <text
                v-if="!point.isNotRated"
                class="qor-chart-value-label"
                :class="{
                  best: point.isBest,
                  selected: point.workspaceId === selectedWorkspace?.workspaceId,
                }"
                :x="point.x"
                :y="point.y - 5.2"
                text-anchor="middle"
              >
                {{ formatScore(point.score) }}
              </text>
              <g v-else class="qor-chart-nr-marker">
                <title>{{ `${point.label}: ${formatScore(point.score)}` }}</title>
                <rect
                  class="qor-chart-nr-pill"
                  :x="point.x - 4.2"
                  :y="point.y - 2.6"
                  width="8.4"
                  height="5.2"
                  rx="1.4"
                />
                <text
                  class="qor-chart-not-rated"
                  :x="point.x"
                  :y="point.y"
                  text-anchor="middle"
                  dominant-baseline="middle"
                >
                  NR
                </text>
              </g>
              <g
                class="qor-chart-workspace-tick"
                :transform="`translate(${point.x}, ${chartBottom})`"
              >
                <line class="qor-chart-x-tick" x1="0" y1="0" x2="0" y2="2.4" />
                <text
                  class="qor-chart-workspace-label"
                  :class="{ best: point.isBest && !point.isNotRated }"
                  x="0"
                  y="9.2"
                  text-anchor="end"
                  transform="rotate(-40)"
                >
                  <title>{{ point.label }}</title>
                  {{ shortenWorkspaceLabel(point.label) }}
                </text>
              </g>
            </g>
          </svg>
        </div>
        <p id="qor-chart-description" class="sr-only">
          {{ chartAccessibleSummary }}
        </p>
        <div class="qor-chart-legend" role="list" aria-label="QoR chart legend">
          <span role="listitem"
            ><i class="legend-selected" aria-hidden="true"></i>Selected</span
          >
          <span role="listitem"
            ><i class="legend-baseline" aria-hidden="true"></i>Baseline</span
          >
          <span role="listitem"
            ><i class="legend-pass" aria-hidden="true"></i>60 analysis threshold</span
          >
          <span role="listitem"
            ><i class="legend-nr" aria-hidden="true"></i>Not rated</span
          >
        </div>
        <details class="qor-chart-data">
          <summary>Score data</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">Workspace</th>
                <th scope="col">QoR score</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="point in scoreChartPoints"
                :key="`score-data-${point.workspaceId}`"
              >
                <th scope="row">{{ point.label }}</th>
                <td>{{ formatScore(point.score) }}</td>
              </tr>
            </tbody>
          </table>
        </details>
      </section>

      <section class="qor-trend-card qor-delta-card">
        <div class="qor-delta-tabs" role="tablist" aria-label="QoR findings">
          <button
            v-for="tab in deltaTabs"
            :id="`qor-tab-${tab.id}`"
            :key="tab.id"
            type="button"
            role="tab"
            class="qor-delta-tab"
            :class="{ selected: activeDeltaTab === tab.id }"
            :aria-selected="activeDeltaTab === tab.id"
            :tabindex="activeDeltaTab === tab.id ? 0 : -1"
            aria-controls="qor-tabpanel"
            @click="activeDeltaTab = tab.id"
            @keydown="handleDeltaTabKeydown($event, tab.id)"
          >
            <span>{{ tab.label }}</span>
            <strong v-if="tabCount(tab.id) > 0">{{ tabCount(tab.id) }}</strong>
          </button>
        </div>
        <div
          id="qor-tabpanel"
          class="qor-delta-list-panel"
          role="tabpanel"
          :aria-labelledby="`qor-tab-${activeDeltaTab}`"
        >
          <div class="qor-delta-list-header">
            <span>{{ activeListTitle }}</span>
            <small>{{ activeListContext }}</small>
          </div>
          <template v-if="isDeltaCompareTab">
            <div
              v-if="activeDeltaCompareItems.length > 0"
              class="qor-delta-table-wrap qor-scroll-list"
            >
              <table
                class="qor-delta-table"
                :class="{
                  'is-regressions': activeDeltaTab === 'regressions',
                  'is-improvements': activeDeltaTab === 'improvements',
                }"
              >
                <thead>
                  <tr>
                    <th scope="col">Metric</th>
                    <th scope="col">{{ deltaBaselineColumnLabel }}</th>
                    <th scope="col">{{ deltaCurrentColumnLabel }}</th>
                    <th scope="col">Δ</th>
                    <th scope="col">Δ%</th>
                    <th scope="col" aria-hidden="true">
                      <span class="sr-only">Magnitude</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in activeDeltaCompareItems"
                    :key="deltaCompareRowKey(item)"
                  >
                    <th scope="row">
                      <span class="qor-delta-metric-name">{{ item.displayName }}</span>
                    </th>
                    <td>{{ formatMetricValue(item.baselineValue) }}</td>
                    <td>{{ formatMetricValue(item.currentValue) }}</td>
                    <td>{{ formatAbsoluteDelta(item.absoluteDelta) }}</td>
                    <td>{{ formatDelta(item.relativeDeltaPct) }}</td>
                    <td aria-hidden="true">
                      <span
                        class="qor-delta-bar"
                        :style="{ width: `${deltaBarWidth(item.relativeDeltaPct)}%` }"
                      ></span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="qor-empty-note">{{ activeDeltaEmptyMessage }}</p>
          </template>
          <template v-else-if="activeDeltaTab === 'risks'">
            <div
              v-if="activeRiskItems.length > 0"
              class="qor-delta-table-wrap qor-scroll-list"
            >
              <table class="qor-delta-table qor-risk-table">
                <thead>
                  <tr>
                    <th scope="col">Risk</th>
                    <th scope="col">Severity</th>
                    <th scope="col">Step</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in activeRiskItems" :key="qorListItemKey(item)">
                    <th scope="row">
                      <span class="qor-delta-metric-name">{{ item.displayName }}</span>
                    </th>
                    <td>
                      <span class="qor-severity-pill" :class="qorListItemClass(item)">
                        {{ item.severity.toUpperCase() }}
                      </span>
                    </td>
                    <td>{{ item.step }}</td>
                    <td class="qor-cell-wrap">
                      {{ item.message
                      }}<template v-if="item.value !== null">
                        · {{ item.value }}</template
                      >
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="qor-empty-note">{{ activeRiskEmptyMessage }}</p>
          </template>
          <template v-else>
            <div v-if="hasSelectedTimingContent" class="qor-timing-panel qor-scroll-list">
              <div class="qor-timing-summary" aria-label="Timing summary">
                <span
                  v-if="selectedTimingSummary.critical > 0"
                  class="qor-summary-chip critical"
                >
                  {{ selectedTimingSummary.critical }} critical
                </span>
                <span
                  v-if="selectedTimingSummary.warning > 0"
                  class="qor-summary-chip warning"
                >
                  {{ selectedTimingSummary.warning }} warning
                </span>
                <span
                  v-if="selectedTimingSummary.coverage > 0"
                  class="qor-summary-chip coverage"
                >
                  {{ selectedTimingSummary.coverage }} coverage gap{{
                    selectedTimingSummary.coverage === 1 ? '' : 's'
                  }}
                </span>
                <span
                  v-if="selectedTimingSummary.cleared > 0"
                  class="qor-summary-chip cleared"
                >
                  {{ selectedTimingSummary.cleared }} cleared
                </span>
              </div>

              <div
                v-if="filteredVisibleTimingIssues.length > 0"
                class="qor-delta-table-wrap"
              >
                <table class="qor-delta-table qor-timing-table">
                  <thead>
                    <tr>
                      <th scope="col">Type</th>
                      <th scope="col">Corner</th>
                      <th scope="col">Path</th>
                      <th scope="col">Slack</th>
                      <th scope="col">Triage</th>
                      <th scope="col" aria-hidden="true">
                        <span class="sr-only">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <template
                      v-for="issue in filteredVisibleTimingIssues"
                      :key="issue.issueId"
                    >
                      <tr
                        class="qor-timing-row"
                        :class="{
                          selected: issue.workspaceId === selectedWorkspaceId,
                          expanded: expandedTimingIssueId === issue.issueId,
                        }"
                      >
                        <th scope="row">
                          <button
                            type="button"
                            class="qor-timing-select"
                            :aria-label="`Inspect ${issue.analysisType.toUpperCase()} timing issue for ${issue.workspaceId}`"
                            @click="selectTimingIssueWorkspace(issue.workspaceId)"
                          >
                            {{ issue.analysisType.toUpperCase() }}
                          </button>
                        </th>
                        <td>{{ issue.corner }}</td>
                        <td class="qor-cell-wrap">
                          {{ issue.pathGroup }} · {{ issue.checkType }}
                        </td>
                        <td :class="`qor-risk-${issue.severity}`">
                          {{ formatTimingSlack(issue.slackNs) }}
                        </td>
                        <td>
                          <span class="qor-triage-pill" :class="timingTriageClass(issue)">
                            {{ timingTriageLabel(issue) }}
                          </span>
                        </td>
                        <td>
                          <button
                            v-if="timingIssueHasDetails(issue)"
                            type="button"
                            class="qor-row-expand"
                            :aria-expanded="expandedTimingIssueId === issue.issueId"
                            :aria-label="
                              expandedTimingIssueId === issue.issueId
                                ? 'Collapse timing details'
                                : 'Expand timing details'
                            "
                            @click.stop="toggleTimingIssueExpand(issue.issueId)"
                          >
                            <i
                              :class="
                                expandedTimingIssueId === issue.issueId
                                  ? 'ri-arrow-up-s-line'
                                  : 'ri-arrow-down-s-line'
                              "
                              aria-hidden="true"
                            ></i>
                          </button>
                        </td>
                      </tr>
                      <tr
                        v-if="expandedTimingIssueId === issue.issueId"
                        class="qor-timing-detail-row"
                      >
                        <td colspan="6">
                          <ul class="qor-timing-detail-list">
                            <li v-for="detail in timingIssueDetails(issue)" :key="detail">
                              {{ detail }}
                            </li>
                          </ul>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>

              <div
                v-if="filteredClearedTimingTriage.length > 0"
                class="qor-timing-subsection"
              >
                <h5 class="qor-subsection-title">Cleared</h5>
                <div class="qor-delta-table-wrap">
                  <table class="qor-delta-table qor-timing-table">
                    <thead>
                      <tr>
                        <th scope="col">Type</th>
                        <th scope="col">Corner</th>
                        <th scope="col">Path</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="triage in filteredClearedTimingTriage"
                        :key="`cleared-${triage.workspaceId}-${triage.issueId}`"
                        class="qor-timing-row"
                        :class="{ selected: triage.workspaceId === selectedWorkspaceId }"
                      >
                        <th scope="row">
                          <button
                            type="button"
                            class="qor-timing-select"
                            :aria-label="`Inspect cleared ${triage.analysisType.toUpperCase()} timing issue for ${triage.workspaceId}`"
                            @click="selectTimingIssueWorkspace(triage.workspaceId)"
                          >
                            {{ triage.analysisType.toUpperCase() }}
                          </button>
                        </th>
                        <td>{{ triage.corner }}</td>
                        <td class="qor-cell-wrap">
                          {{ triage.pathGroup }} · {{ triage.checkType }}
                        </td>
                        <td>
                          <span class="qor-triage-pill qor-timing-triage-improved">
                            RESOLVED vs {{ triage.baselineWorkspaceName }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div v-if="filteredTimingCoverage.length > 0" class="qor-timing-subsection">
                <h5 class="qor-subsection-title">Coverage</h5>
                <div class="qor-delta-table-wrap">
                  <table class="qor-delta-table qor-timing-table">
                    <thead>
                      <tr>
                        <th scope="col">Status</th>
                        <th scope="col">Missing</th>
                        <th scope="col">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="coverage in filteredTimingCoverage"
                        :key="`coverage-${coverage.workspaceId}`"
                        class="qor-timing-row"
                        :class="{
                          selected: coverage.workspaceId === selectedWorkspaceId,
                        }"
                      >
                        <th scope="row">
                          <button
                            type="button"
                            class="qor-timing-select"
                            :aria-label="`Inspect timing coverage for ${coverage.workspaceId}`"
                            @click="selectTimingIssueWorkspace(coverage.workspaceId)"
                          >
                            INCOMPLETE
                          </button>
                        </th>
                        <td>
                          {{ formatMissingCornerCount(coverage.missingCornerCount) }}
                        </td>
                        <td class="qor-cell-wrap">
                          Structured STA results missing ·
                          {{
                            formatAvailableArtifactCount(coverage.availableArtifactCount)
                          }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <p v-else class="qor-empty-note">{{ timingEmptyMessage }}</p>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ProjectQorTrendSummary } from '@/utils/projectQorTrend'

const props = defineProps<{
  qorTrendSummary: ProjectQorTrendSummary
  selectedWorkspaceId: string
}>()

const emit = defineEmits<{
  'export-report': []
  'set-baseline': [{ workspaceId: string }]
  'select-workspace': [{ workspaceId: string }]
}>()

const scoreTicks = [0, 20, 40, 60, 80, 100] as const
const chartLeft = 20
const chartRight = 8
const chartTop = 10
const chartBottom = 68
const chartNotRatedY = 56
type QorDashboardTab = 'improvements' | 'regressions' | 'risks' | 'timing'
type QorAttentionItem = {
  id: string
  label: string
  detail: string
  tone: 'critical' | 'warning' | 'info'
}

const deltaTabs: Array<{
  id: QorDashboardTab
  label: string
}> = [
  { id: 'timing', label: 'Timing' },
  { id: 'risks', label: 'Risks' },
  { id: 'regressions', label: 'Regressions' },
  { id: 'improvements', label: 'Improvements' },
]

const activeDeltaTab = ref<QorDashboardTab>(initialDeltaTab())
const baselineChangePending = ref<string | null>(null)
const chartViewport = ref<HTMLElement | null>(null)
const chartViewportSize = ref({ width: 0, height: 0 })
const expandedTimingIssueId = ref<string | null>(null)
let chartResizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!chartViewport.value) return

  chartResizeObserver = new ResizeObserver(([entry]) => {
    chartViewportSize.value = {
      width: entry.contentRect.width,
      height: entry.contentRect.height,
    }
  })
  chartResizeObserver.observe(chartViewport.value)
})

onBeforeUnmount(() => {
  chartResizeObserver?.disconnect()
})

const bestTrendPoint = computed(() => {
  return props.qorTrendSummary.trendPoints.reduce<
    ProjectQorTrendSummary['trendPoints'][number] | null
  >((best, point) => {
    if (point.score === null) return best
    if (!best || best.score === null || point.score > best.score) return point
    return best
  }, null)
})

const highestTrendScore = computed(() => bestTrendPoint.value?.score ?? null)

const baselineLabel = computed(() => {
  return props.qorTrendSummary.baselineWorkspaceId
    ? props.qorTrendSummary.baselineLabel
    : 'sequential baseline'
})

const selectedWorkspace = computed(() => {
  return (
    props.qorTrendSummary.workspaces.find(
      (workspace) => workspace.workspaceId === props.selectedWorkspaceId,
    ) ??
    props.qorTrendSummary.workspaces[0] ??
    null
  )
})

const selectedSignoffStatus = computed(
  () => selectedWorkspace.value?.signoffReadiness.status ?? 'unavailable',
)
const selectedScore = computed(
  () =>
    props.qorTrendSummary.trendPoints.find(
      (point) => point.workspaceId === selectedWorkspace.value?.workspaceId,
    )?.score ?? null,
)
const selectedScoreContext = computed(() => {
  if (selectedScore.value === null) return 'QoR score unavailable'
  const targetState =
    selectedScore.value >= 60
      ? 'meets the 60 analysis threshold'
      : 'is below the 60 analysis threshold'
  return `QoR ${formatScore(selectedScore.value)} · ${targetState}`
})
const selectedScoreClass = computed(() =>
  selectedScore.value === null
    ? 'is-unavailable'
    : selectedScore.value >= 60
      ? 'is-pass'
      : 'is-below',
)

const canSetSelectedWorkspaceAsBaseline = computed(() => {
  const workspaceId = selectedWorkspace.value?.workspaceId
  return Boolean(workspaceId && workspaceId !== props.qorTrendSummary.baselineWorkspaceId)
})

const selectedWorkspaceIsBaseline = computed(() => {
  const workspaceId = selectedWorkspace.value?.workspaceId
  return Boolean(workspaceId && workspaceId === props.qorTrendSummary.baselineWorkspaceId)
})

const chartCoordinateWidth = computed(() => {
  const { width, height } = chartViewportSize.value
  if (width <= 0 || height <= 0) return 180
  return Math.max(120, (width / height) * 100)
})

const chartPlotRight = computed(() => chartCoordinateWidth.value - chartRight)

const chartViewBox = computed(() => `0 0 ${chartCoordinateWidth.value.toFixed(2)} 100`)

const scoreChartPoints = computed(() => {
  const points = props.qorTrendSummary.trendPoints
  const pointCount = points.length
  const plotWidth = chartPlotRight.value - chartLeft
  return points.map((point, index) => ({
    ...point,
    isBest:
      point.score !== null &&
      highestTrendScore.value !== null &&
      point.score === highestTrendScore.value,
    isNotRated: point.score === null,
    x: pointCount <= 1 ? chartLeft : chartLeft + (index / (pointCount - 1)) * plotWidth,
    y: point.score === null ? chartNotRatedY : scoreToChartY(point.score),
  }))
})

const activeDeltaCompareItems = computed(() => {
  const workspaceId = selectedWorkspace.value?.workspaceId
  if (!workspaceId || selectedWorkspaceIsBaseline.value) return []

  const source =
    activeDeltaTab.value === 'improvements'
      ? props.qorTrendSummary.improvements
      : activeDeltaTab.value === 'regressions'
        ? props.qorTrendSummary.regressions
        : []

  return source.filter((item) => item.workspaceId === workspaceId)
})

const activeRiskItems = computed(() => {
  const workspaceId = selectedWorkspace.value?.workspaceId
  if (!workspaceId || activeDeltaTab.value !== 'risks') return []
  return props.qorTrendSummary.risks.filter((item) => item.workspaceId === workspaceId)
})

const selectedWorkspaceRiskCount = computed(() => {
  const workspaceId = selectedWorkspace.value?.workspaceId
  if (!workspaceId) return 0
  return props.qorTrendSummary.risks.filter((item) => item.workspaceId === workspaceId)
    .length
})

const isDeltaCompareTab = computed(
  () => activeDeltaTab.value === 'regressions' || activeDeltaTab.value === 'improvements',
)

const deltaBaselineColumnLabel = computed(() => baselineLabel.value)

const deltaCurrentColumnLabel = computed(
  () => selectedWorkspace.value?.workspaceId ?? 'Current',
)

const maxDeltaBarPct = computed(() => {
  const magnitudes = activeDeltaCompareItems.value
    .map((item) => Math.abs(item.relativeDeltaPct ?? 0))
    .filter((value) => value > 0)
  return magnitudes.length > 0 ? Math.max(...magnitudes) : 1
})

const activeListTitle = computed(() => {
  return (
    deltaTabs.find((tab) => tab.id === activeDeltaTab.value)?.label ?? 'QoR Dashboard'
  )
})

const activeListContext = computed(() => {
  const workspaceId = selectedWorkspace.value?.workspaceId
  if (activeDeltaTab.value === 'risks') {
    if (!workspaceId) return 'Select a workspace to review structured risks.'
    return `${selectedWorkspaceRiskCount.value} structured risk${
      selectedWorkspaceRiskCount.value === 1 ? '' : 's'
    } for ${workspaceId}`
  }
  if (activeDeltaTab.value === 'timing') {
    if (!workspaceId) return 'Select a workspace to review timing results.'
    return `${filteredTimingWorkItemCount.value} timing work item${
      filteredTimingWorkItemCount.value === 1 ? '' : 's'
    } for ${workspaceId}`
  }
  if (selectedWorkspaceIsBaseline.value) {
    return 'Select another workspace to compare against this baseline.'
  }
  if (!workspaceId) return 'Select a workspace to compare against the baseline.'
  return `Metric deltas for ${workspaceId} vs baseline ${baselineLabel.value}`
})

const activeRiskEmptyMessage = computed(() => {
  if (!selectedWorkspace.value?.workspaceId) {
    return 'Select a workspace to review structured risks.'
  }
  return 'No structured analysis risks detected for the selected workspace.'
})

const activeDeltaEmptyMessage = computed(() => {
  if (activeDeltaTab.value === 'improvements') {
    if (!selectedWorkspace.value?.workspaceId) {
      return 'Select a workspace to compare against the baseline.'
    }
    if (selectedWorkspaceIsBaseline.value) {
      return 'The selected workspace is the QoR baseline.'
    }
    return 'No improvements detected for the selected workspace.'
  }
  if (activeDeltaTab.value === 'regressions') {
    if (!selectedWorkspace.value?.workspaceId) {
      return 'Select a workspace to compare against the baseline.'
    }
    if (selectedWorkspaceIsBaseline.value) {
      return 'The selected workspace is the QoR baseline.'
    }
    return 'No regressions detected for the selected workspace.'
  }
  return activeRiskEmptyMessage.value
})

const currentTriageIssueKeys = computed(
  () =>
    new Set(
      props.qorTrendSummary.timingClosure.triage
        .filter((triage) => triage.state !== 'cleared')
        .map((triage) => `${triage.workspaceId}\u0000${triage.issueId}`),
    ),
)
const triagedBaselineIssueKeys = computed(() => {
  const currentIssueKeys = currentTriageIssueKeys.value
  return new Set(
    props.qorTrendSummary.timingClosure.triage
      .map((triage) => `${triage.baselineWorkspaceId}\u0000${triage.issueId}`)
      .filter((issueKey) => !currentIssueKeys.has(issueKey)),
  )
})
const visibleTimingIssues = computed(() =>
  props.qorTrendSummary.timingClosure.issues.filter(
    (issue) =>
      !triagedBaselineIssueKeys.value.has(`${issue.workspaceId}\u0000${issue.issueId}`),
  ),
)
const clearedTimingTriage = computed(() =>
  props.qorTrendSummary.timingClosure.triage.filter(
    (triage) => triage.state === 'cleared',
  ),
)
const timingIssueCount = computed(() => visibleTimingIssues.value.length)
const projectTimingWorkItemCount = computed(
  () =>
    timingIssueCount.value +
    clearedTimingTriage.value.length +
    props.qorTrendSummary.timingClosure.coverage.length,
)

function filterTimingItemsBySelectedWorkspace<T extends { workspaceId: string }>(
  items: T[],
): T[] {
  const workspaceId = selectedWorkspace.value?.workspaceId
  if (!workspaceId) return []
  return items.filter((item) => item.workspaceId === workspaceId)
}

const filteredVisibleTimingIssues = computed(() =>
  filterTimingItemsBySelectedWorkspace(visibleTimingIssues.value),
)
const filteredClearedTimingTriage = computed(() =>
  filterTimingItemsBySelectedWorkspace(clearedTimingTriage.value),
)
const filteredTimingCoverage = computed(() =>
  filterTimingItemsBySelectedWorkspace(props.qorTrendSummary.timingClosure.coverage),
)
const filteredTimingWorkItemCount = computed(
  () =>
    filteredVisibleTimingIssues.value.length +
    filteredClearedTimingTriage.value.length +
    filteredTimingCoverage.value.length,
)
const hasSelectedTimingContent = computed(() => filteredTimingWorkItemCount.value > 0)
const selectedTimingSummary = computed(() => ({
  critical: filteredVisibleTimingIssues.value.filter(
    (issue) => issue.severity === 'critical',
  ).length,
  warning: filteredVisibleTimingIssues.value.filter(
    (issue) => issue.severity === 'warning',
  ).length,
  coverage: filteredTimingCoverage.value.length,
  cleared: filteredClearedTimingTriage.value.length,
}))

const attentionThresholdContext = computed(() => {
  if (selectedScore.value === null) {
    return 'QoR unavailable · 60 is an analysis threshold, not signoff.'
  }
  return `QoR ${formatScore(selectedScore.value)} / analysis threshold 60 · Signoff separate`
})

const attentionItems = computed<QorAttentionItem[]>(() => {
  const workspaceId = selectedWorkspace.value?.workspaceId
  if (!workspaceId) return []

  const items: QorAttentionItem[] = []
  const criticalTiming = filteredVisibleTimingIssues.value.filter(
    (issue) => issue.severity === 'critical',
  ).length
  const warningTiming = filteredVisibleTimingIssues.value.filter(
    (issue) => issue.severity === 'warning',
  ).length
  const criticalRisks = props.qorTrendSummary.risks.filter(
    (item) => item.workspaceId === workspaceId && item.severity === 'critical',
  ).length
  const nonCriticalRisks = props.qorTrendSummary.risks.filter(
    (item) => item.workspaceId === workspaceId && item.severity === 'warning',
  ).length
  const regressions = selectedWorkspaceIsBaseline.value
    ? 0
    : props.qorTrendSummary.regressions.filter((item) => item.workspaceId === workspaceId)
        .length

  if (criticalTiming > 0) {
    items.push({
      id: 'critical-timing',
      label: `${criticalTiming} critical timing ${criticalTiming === 1 ? 'issue' : 'issues'}`,
      detail: 'Failing paths need triage.',
      tone: 'critical',
    })
  } else if (warningTiming > 0 || filteredTimingCoverage.value.length > 0) {
    const count = warningTiming + filteredTimingCoverage.value.length
    items.push({
      id: 'timing',
      label: `${count} timing work ${count === 1 ? 'item' : 'items'}`,
      detail: 'Paths or analysis coverage require review.',
      tone: 'warning',
    })
  }

  if (criticalRisks > 0 || nonCriticalRisks > 0) {
    const count = criticalRisks + nonCriticalRisks
    items.push({
      id: 'risks',
      label: `${count} analysis ${count === 1 ? 'risk' : 'risks'}`,
      detail: riskAttentionDetail(workspaceId),
      tone: criticalRisks > 0 ? 'critical' : 'warning',
    })
  }

  if (regressions > 0) {
    items.push({
      id: 'regressions',
      label: `${regressions} QoR ${regressions === 1 ? 'regression' : 'regressions'}`,
      detail: `Against baseline ${baselineLabel.value}.`,
      tone: 'warning',
    })
  }

  return items.slice(0, 3)
})

const chartAccessibleSummary = computed(() => {
  const workspace = selectedWorkspace.value?.workspaceId ?? 'No workspace selected'
  return `QoR score by workspace from 0 to 100. ${workspace}: ${selectedScoreContext.value}. The 60 line is an analysis threshold only and does not determine signoff. Baseline: ${baselineLabel.value}.`
})

const timingEmptyMessage = computed(() => {
  const summary = props.qorTrendSummary.timingClosure
  const workspaceId = selectedWorkspace.value?.workspaceId
  if (!workspaceId) return 'Select a workspace to review timing results.'
  const unavailableOrIncomplete =
    summary.unavailableWorkspaceCount + summary.incompleteWorkspaceCount
  if (
    props.qorTrendSummary.workspaces.length > 0 &&
    summary.unavailableWorkspaceCount === props.qorTrendSummary.workspaces.length
  ) {
    return 'STA timing analysis is unavailable for this project.'
  }
  if (unavailableOrIncomplete > 0 && filteredTimingWorkItemCount.value === 0) {
    return `STA timing analysis is incomplete for ${workspaceId}.`
  }
  return 'All available STA timing analyses are clean for the selected workspace.'
})

watch(
  () => props.selectedWorkspaceId,
  () => {
    expandedTimingIssueId.value = null
    activeDeltaTab.value = initialDeltaTab()
  },
)

watch(activeDeltaTab, () => {
  expandedTimingIssueId.value = null
})

watch(
  () => projectTimingWorkItemCount.value,
  (workItemCount, previousWorkItemCount) => {
    if (
      previousWorkItemCount === 0 &&
      workItemCount > 0 &&
      activeDeltaTab.value === 'improvements'
    ) {
      activeDeltaTab.value = 'timing'
    }
  },
)

function scoreToChartY(score: number): number {
  const normalizedScore = Math.max(0, Math.min(100, score))
  return Number(
    (chartBottom - (normalizedScore / 100) * (chartBottom - chartTop)).toFixed(2),
  )
}

function shortenWorkspaceLabel(label: string): string {
  const maxLength = 8
  return label.length > maxLength ? `${label.slice(0, maxLength)}...` : label
}

function exportReport() {
  emit('export-report')
}

function initialDeltaTab(): QorDashboardTab {
  const workspaceId = props.selectedWorkspaceId
  if (!workspaceId) return 'improvements'

  const hasTimingForWorkspace =
    props.qorTrendSummary.timingClosure.issues.some(
      (issue) => issue.workspaceId === workspaceId,
    ) ||
    props.qorTrendSummary.timingClosure.coverage.some(
      (coverage) => coverage.workspaceId === workspaceId,
    ) ||
    props.qorTrendSummary.timingClosure.triage.some(
      (triage) => triage.workspaceId === workspaceId && triage.state === 'cleared',
    )
  if (hasTimingForWorkspace) return 'timing'

  if (
    props.qorTrendSummary.risks.some(
      (item) => item.workspaceId === workspaceId && item.severity !== 'info',
    )
  ) {
    return 'risks'
  }

  const isBaseline = workspaceId === props.qorTrendSummary.baselineWorkspaceId
  if (
    !isBaseline &&
    props.qorTrendSummary.regressions.some((item) => item.workspaceId === workspaceId)
  ) {
    return 'regressions'
  }
  if (
    !isBaseline &&
    props.qorTrendSummary.improvements.some((item) => item.workspaceId === workspaceId)
  ) {
    return 'improvements'
  }
  return 'improvements'
}

function riskAttentionDetail(workspaceId: string): string {
  const steps = [
    ...new Set(
      props.qorTrendSummary.risks
        .filter((item) => item.workspaceId === workspaceId && item.severity !== 'info')
        .map((item) => item.step.toUpperCase()),
    ),
  ]
  const visibleSteps = steps.slice(0, 3)
  const remainingCount = steps.length - visibleSteps.length
  const remainingSuffix = remainingCount > 0 ? ` +${remainingCount}` : ''
  return `Affected steps: ${visibleSteps.join(', ')}${remainingSuffix}`
}

function requestSetSelectedWorkspaceAsBaseline() {
  const workspaceId = selectedWorkspace.value?.workspaceId
  if (!workspaceId || workspaceId === props.qorTrendSummary.baselineWorkspaceId) return
  baselineChangePending.value = workspaceId
}

function cancelBaselineChange() {
  baselineChangePending.value = null
}

function confirmBaselineChange() {
  const workspaceId = baselineChangePending.value
  if (!workspaceId || workspaceId === props.qorTrendSummary.baselineWorkspaceId) return
  emit('set-baseline', { workspaceId })
  baselineChangePending.value = null
}

function selectTimingIssueWorkspace(workspaceId: string) {
  emit('select-workspace', { workspaceId })
}

function formatScore(score: number | null): string {
  return score === null ? 'Not rated' : score.toFixed(1)
}

function formatTimingSlack(slackNs: number): string {
  const sign = slackNs > 0 ? '+' : ''
  return `${sign}${slackNs.toFixed(3)} ns`
}

function timingTriageLabel(
  issue: ProjectQorTrendSummary['timingClosure']['issues'][number],
): string {
  return issue.triage?.state.toUpperCase() ?? issue.severity.toUpperCase()
}

function timingTriageClass(
  issue: ProjectQorTrendSummary['timingClosure']['issues'][number],
): string {
  return issue.triage ? `qor-timing-triage-${issue.triage.state}` : ''
}

function formatTimingTriage(
  issue: ProjectQorTrendSummary['timingClosure']['issues'][number],
): string | null {
  const triage = issue.triage
  if (!triage) return null
  if (triage.state === 'new') return `New relative to ${triage.baselineWorkspaceName}`
  if (triage.slackDeltaNs === null) return null
  const delta = formatTimingSlack(triage.slackDeltaNs)
  return `vs ${triage.baselineWorkspaceName} · Delta ${delta}`
}

function formatTimingPhysicalContext(
  issue: ProjectQorTrendSummary['timingClosure']['issues'][number],
): string | null {
  const signals = issue.triage?.physicalContext ?? []
  if (signals.length === 0) return null
  const changes = signals.map((signal) => {
    const unit = signal.unit ? ` ${signal.unit}` : ''
    const sign = signal.absoluteDelta > 0 ? '+' : ''
    return `${signal.displayName} ${sign}${signal.absoluteDelta}${unit}`
  })
  return `Observed physical changes: ${changes.join(' · ')}`
}

function formatTimingReviewHints(
  issue: ProjectQorTrendSummary['timingClosure']['issues'][number],
): string | null {
  const hints = issue.triage?.reviewHints ?? []
  return hints.length
    ? `Review next: ${hints.map((hint) => hint.label).join(' · ')}`
    : null
}

function formatMissingCornerCount(missingCornerCount: number): string {
  return `${missingCornerCount} corner${missingCornerCount === 1 ? '' : 's'}`
}

function formatAvailableArtifactCount(availableArtifactCount: number): string {
  return `${availableArtifactCount} validated STA artifact${
    availableArtifactCount === 1 ? '' : 's'
  } available`
}

function formatTimingClockDelays(
  issue: ProjectQorTrendSummary['timingClosure']['issues'][number],
): string | null {
  const launch = issue.launchClockNetworkDelayNs
  const capture = issue.captureClockNetworkDelayNs
  if (launch === null || capture === null) return null
  const delta = issue.clockNetworkDelayDeltaNs
  const deltaText = delta === null ? '' : ` · Delta ${delta.toFixed(3)} ns`
  return `Launch ${launch.toFixed(3)} ns · Capture ${capture.toFixed(3)} ns${deltaText}`
}

function timingIssueHasDetails(
  issue: ProjectQorTrendSummary['timingClosure']['issues'][number],
): boolean {
  return timingIssueDetails(issue).length > 0
}

function timingIssueDetails(
  issue: ProjectQorTrendSummary['timingClosure']['issues'][number],
): string[] {
  return [
    formatTimingTriage(issue),
    formatTimingPhysicalContext(issue),
    formatTimingReviewHints(issue),
    formatTimingClockDelays(issue),
  ].filter((detail): detail is string => Boolean(detail))
}

function toggleTimingIssueExpand(issueId: string): void {
  expandedTimingIssueId.value = expandedTimingIssueId.value === issueId ? null : issueId
}

function tabCount(tabId: QorDashboardTab): number {
  const workspaceId = selectedWorkspace.value?.workspaceId
  if (tabId === 'timing') return filteredTimingWorkItemCount.value
  if (tabId === 'risks') return selectedWorkspaceRiskCount.value
  if (!workspaceId || selectedWorkspaceIsBaseline.value) return 0
  if (tabId === 'regressions') {
    return props.qorTrendSummary.regressions.filter(
      (item) => item.workspaceId === workspaceId,
    ).length
  }
  return props.qorTrendSummary.improvements.filter(
    (item) => item.workspaceId === workspaceId,
  ).length
}

function handleDeltaTabKeydown(event: KeyboardEvent, currentTab: QorDashboardTab) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const currentIndex = deltaTabs.findIndex((tab) => tab.id === currentTab)
  const nextIndex =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? deltaTabs.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + deltaTabs.length) %
          deltaTabs.length
  const nextTab = deltaTabs[nextIndex]
  activeDeltaTab.value = nextTab.id
  document.getElementById(`qor-tab-${nextTab.id}`)?.focus()
}

function chartPointDescription(
  point: ProjectQorTrendSummary['trendPoints'][number],
): string {
  return `${point.label}: ${formatScore(point.score)}${
    chartPointContext(point) ? ` (${chartPointContext(point)})` : ''
  }`
}

function chartPointContext(point: ProjectQorTrendSummary['trendPoints'][number]): string {
  const tags: string[] = []
  if (point.workspaceId === selectedWorkspace.value?.workspaceId) tags.push('selected')
  if (point.workspaceId === props.qorTrendSummary.baselineWorkspaceId)
    tags.push('baseline')
  if (point.score === null) {
    tags.push('not rated')
  } else if (point.score < 60) {
    tags.push('below the 60 analysis threshold')
  } else {
    tags.push('meets the 60 analysis threshold')
  }
  return tags.join(', ')
}

function formatDelta(delta: number | null): string {
  if (delta === null) return 'N/A'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}%`
}

function formatMetricValue(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  if (abs >= 100) return value.toFixed(2)
  if (abs >= 1) return value.toFixed(3)
  return value.toFixed(4)
}

function formatAbsoluteDelta(delta: number): string {
  const sign = delta > 0 ? '+' : ''
  return `${sign}${formatMetricValue(delta)}`
}

function deltaBarWidth(relativeDeltaPct: number | null): number {
  if (relativeDeltaPct === null || relativeDeltaPct === 0) return 0
  const scaled = (Math.abs(relativeDeltaPct) / maxDeltaBarPct.value) * 100
  return Math.max(8, Math.min(100, scaled))
}

function deltaCompareRowKey(
  item:
    | ProjectQorTrendSummary['improvements'][number]
    | ProjectQorTrendSummary['regressions'][number],
): string {
  return `${item.workspaceId}-${item.metricName}`
}

function isProjectQorRisk(
  item:
    | ProjectQorTrendSummary['improvements'][number]
    | ProjectQorTrendSummary['risks'][number],
): item is ProjectQorTrendSummary['risks'][number] {
  return 'severity' in item
}

function qorListItemKey(
  item:
    | ProjectQorTrendSummary['improvements'][number]
    | ProjectQorTrendSummary['regressions'][number]
    | ProjectQorTrendSummary['risks'][number],
): string {
  return isProjectQorRisk(item)
    ? `${item.workspaceId}-${item.step}-${item.kind}-${item.metric}`
    : `${item.workspaceId}-${item.metricName}`
}

function qorListItemClass(
  item:
    | ProjectQorTrendSummary['improvements'][number]
    | ProjectQorTrendSummary['regressions'][number]
    | ProjectQorTrendSummary['risks'][number],
): string {
  if (!isProjectQorRisk(item)) return ''
  return `qor-risk-${item.severity}`
}
</script>

<style scoped>
.qor-overview-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: visible;
  color: var(--text-primary);
}

.qor-section-title,
.qor-trend-card {
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.qor-panel-toolbar {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-height: 34px;
  padding: 0 2px 2px;
}

.qor-toolbar-leading {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.qor-selection-context {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px;
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.qor-selection-context strong {
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 760;
}

.qor-toolbar-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.qor-meta-chip {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-secondary) 58%, var(--bg-primary));
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
}

.qor-meta-chip.qor-signoff-pass {
  color: var(--success-color, #2f9f6f);
  background: color-mix(in srgb, var(--success-color, #2f9f6f) 12%, var(--bg-primary));
}

.qor-meta-chip.qor-signoff-blocked {
  color: var(--danger-color, #b91c1c);
  background: color-mix(in srgb, var(--danger-color, #b91c1c) 10%, var(--bg-primary));
}

.qor-meta-chip.qor-signoff-incomplete,
.qor-meta-chip.qor-signoff-unavailable {
  color: var(--warning-color, #b45309);
  background: color-mix(in srgb, var(--warning-color, #b45309) 12%, var(--bg-primary));
}

.qor-toolbar-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: flex-start;
  gap: 6px;
}

.qor-baseline-action {
  display: inline-flex;
}

.qor-toolbar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--border-color) 88%, transparent);
  border-radius: 6px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-primary) 88%, transparent);
  cursor: pointer;
  font-size: 11px;
  font-weight: 750;
}

.qor-toolbar-button:hover {
  color: var(--accent-color);
  border-color: color-mix(in srgb, var(--accent-color) 42%, transparent);
  background: color-mix(in srgb, var(--accent-color) 8%, var(--bg-primary));
}

.qor-toolbar-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.qor-attention {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--border-color) 80%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, var(--bg-secondary) 46%, var(--bg-primary));
}

.qor-attention header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.qor-attention header > div {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
}

.qor-attention header span {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 760;
}

.qor-attention header small,
.qor-attention-empty {
  color: var(--text-secondary);
  font-size: 11px;
}

.qor-attention-threshold {
  text-align: right;
}

.qor-attention-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.qor-attention-item {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 2px 10px;
  padding: 0 12px;
}

.qor-attention-item:not(:last-child) {
  border-right: 1px solid color-mix(in srgb, var(--border-color) 76%, transparent);
}

.qor-attention-item:first-child {
  padding-left: 0;
}

.qor-attention-item:last-child {
  padding-right: 0;
}

.qor-attention-rank {
  grid-row: 1 / span 2;
  align-self: center;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 760;
}

.qor-attention-item > strong,
.qor-attention-item > small {
  min-width: 0;
}

.qor-attention-item > strong {
  font-size: 11px;
  font-weight: 760;
}

.qor-attention-item > small {
  color: var(--text-secondary);
  font-size: 10px;
}

.qor-attention-item.critical > strong {
  color: var(--danger-color);
}

.qor-attention-item.warning > strong {
  color: var(--warning-color);
}

.qor-attention-empty {
  margin: 0;
}

.qor-baseline-confirmation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--border-color) 82%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, var(--bg-secondary) 58%, var(--bg-primary));
  color: var(--text-secondary);
  font-size: 12px;
}

.qor-baseline-confirmation strong {
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.qor-baseline-confirmation > div {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 6px;
}

.qor-inline-action {
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  color: var(--text-primary);
  background: var(--bg-primary);
  cursor: pointer;
  font-size: 11px;
  font-weight: 750;
}

.qor-inline-action.primary {
  border-color: color-mix(in srgb, var(--accent-color) 54%, var(--border-color));
  color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 10%, var(--bg-primary));
}

.qor-section-title small,
.qor-empty-note,
.qor-delta-list small {
  color: var(--text-secondary);
}

.qor-section-meta {
  display: grid;
  justify-items: end;
  gap: 2px;
  min-width: 0;
  text-align: right;
}

.qor-score-context {
  font-size: 11px;
  font-style: normal;
  font-weight: 720;
}

.qor-score-context.is-pass {
  color: var(--success-color, #2f9f6f);
}

.qor-score-context.is-below {
  color: var(--warning-color, #b45309);
}

.qor-score-context.is-unavailable {
  color: var(--text-secondary);
}

.qor-trend-card {
  border-radius: 8px;
  padding: 14px;
}

.qor-chart-card {
  min-height: 0;
  gap: 0;
}

.qor-score-heading {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.qor-best-score-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--success-color, #2f9f6f) 14%, var(--bg-primary));
  color: var(--success-color, #2f9f6f);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  font-weight: 780;
  line-height: 1.2;
}

.qor-best-score-chip em {
  color: color-mix(in srgb, var(--success-color, #2f9f6f) 72%, var(--text-secondary));
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  text-transform: uppercase;
}

.qor-best-score-chip.muted {
  background: color-mix(in srgb, var(--text-secondary) 12%, var(--bg-primary));
  color: var(--text-secondary);
}

.qor-section-title span,
.qor-delta-list span {
  font-size: 12px;
  font-weight: 700;
}

.qor-main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto auto;
  gap: 12px;
  min-height: 0;
  flex: 0 0 auto;
}

.qor-trend-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.qor-delta-card {
  display: grid;
  min-height: 0;
  grid-template-rows: auto auto;
  padding: 0;
  overflow: hidden;
}

.qor-section-title {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -14px -14px 0;
  padding: 12px 14px;
  border-width: 0 0 1px;
  border-radius: 8px 8px 0 0;
  background: color-mix(in srgb, var(--bg-secondary) 70%, var(--bg-primary));
}

.qor-chart-viewport {
  min-height: 280px;
  height: 280px;
  flex: 0 0 auto;
  margin: 0 -4px;
  padding: 10px 4px 2px;
  overflow: hidden;
  overscroll-behavior: contain;
}

.qor-score-chart {
  display: block;
  width: 100%;
  min-width: 0;
  height: 100%;
  color: var(--accent-color);
}

.qor-chart-plot-bg {
  fill: color-mix(in srgb, var(--bg-secondary) 42%, var(--bg-primary));
}

.qor-chart-gridline {
  stroke: color-mix(in srgb, var(--border-color) 58%, transparent);
  stroke-width: 0.55;
  vector-effect: non-scaling-stroke;
}

.qor-chart-gridline.threshold {
  stroke: color-mix(in srgb, var(--warn-color, #d99a2b) 78%, #b45309);
  stroke-width: 1;
  stroke-dasharray: 2.8 2.2;
}

.qor-chart-axis {
  stroke: color-mix(in srgb, var(--text-secondary) 42%, var(--border-color));
  stroke-width: 0.9;
  vector-effect: non-scaling-stroke;
}

.qor-chart-score-label,
.qor-chart-workspace-label,
.qor-chart-value-label {
  fill: var(--text-secondary);
  font-size: 3.5px;
  font-weight: 600;
}

.qor-chart-score-label.threshold {
  fill: color-mix(in srgb, var(--warn-color, #d99a2b) 86%, var(--text-secondary));
}

.qor-chart-x-tick {
  stroke: color-mix(in srgb, var(--text-secondary) 42%, var(--border-color));
  stroke-width: 0.7;
  vector-effect: non-scaling-stroke;
}

.qor-chart-workspace-label {
  font-size: 3.1px;
  font-weight: 560;
}

.qor-chart-workspace-label.best {
  fill: var(--success-color, #2f9f6f);
  font-weight: 720;
}

.qor-chart-value-label {
  fill: var(--accent-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 3.6px;
  font-weight: 760;
}

.qor-chart-value-label.best {
  fill: var(--success-color, #2f9f6f);
}

.qor-lollipop {
  color: var(--accent-color);
}

.qor-chart-stem {
  stroke: color-mix(in srgb, var(--border-color) 72%, transparent);
  stroke-width: 0.85;
  stroke-linecap: round;
  stroke-dasharray: 1.4 1.4;
  vector-effect: non-scaling-stroke;
}

.qor-chart-stem.rated {
  stroke: color-mix(in srgb, var(--accent-color) 48%, transparent);
  stroke-dasharray: none;
  stroke-width: 1.15;
}

.qor-chart-stem.best {
  stroke: color-mix(in srgb, var(--success-color, #2f9f6f) 58%, transparent);
}

.qor-chart-stem.selected {
  stroke: var(--text-primary);
  stroke-width: 1.55;
}

.qor-chart-stem.baseline {
  stroke: var(--warning-color, #b45309);
  stroke-dasharray: none;
}

.qor-chart-point {
  fill: var(--bg-primary);
  stroke: var(--accent-color);
  stroke-width: 1.45;
  vector-effect: non-scaling-stroke;
}

.qor-chart-point.best {
  fill: var(--success-color, #2f9f6f);
  stroke: color-mix(in srgb, var(--success-color, #2f9f6f) 55%, #0b6b48);
  stroke-width: 1;
}

.qor-chart-point.selected {
  fill: var(--text-primary);
  stroke: var(--text-primary);
  stroke-width: 1.2;
}

.qor-chart-point.baseline {
  stroke: var(--warning-color, #b45309);
  stroke-width: 1.55;
}

.qor-chart-point.selected.baseline {
  fill: var(--warning-color, #b45309);
  stroke: var(--warning-color, #b45309);
}

.qor-chart-value-label.selected {
  fill: var(--text-primary);
}

.qor-chart-nr-pill {
  fill: color-mix(in srgb, var(--text-secondary) 10%, var(--bg-primary));
  stroke: color-mix(in srgb, var(--text-secondary) 28%, var(--border-color));
  stroke-width: 0.55;
  vector-effect: non-scaling-stroke;
}

.qor-chart-not-rated {
  fill: var(--text-secondary);
  font-size: 2.9px;
  font-weight: 780;
  letter-spacing: 0.06em;
}

.qor-chart-legend {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 10px 14px;
  margin-top: 2px;
  padding-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 650;
}

.qor-chart-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.qor-chart-legend i {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  box-sizing: border-box;
}

.qor-chart-legend .legend-selected {
  border: 2px solid var(--text-primary);
  background: var(--bg-primary);
}

.qor-chart-legend .legend-baseline {
  border: 2px solid var(--warning-color, #b45309);
  background: var(--bg-primary);
}

.qor-chart-legend .legend-pass {
  border: 1.5px dashed color-mix(in srgb, var(--warn-color, #d99a2b) 88%, #b45309);
  background: transparent;
  border-radius: 2px;
  height: 0;
  width: 14px;
}

.qor-chart-legend .legend-nr {
  border: 1px solid color-mix(in srgb, var(--text-secondary) 34%, var(--border-color));
  background: color-mix(in srgb, var(--text-secondary) 10%, var(--bg-primary));
  border-radius: 3px;
}

.qor-chart-data {
  flex: 0 0 auto;
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 11px;
}

.qor-chart-data summary {
  width: max-content;
  cursor: pointer;
  font-weight: 700;
}

.qor-chart-data table {
  width: 100%;
  margin-top: 7px;
  border-collapse: collapse;
  color: var(--text-primary);
  font-size: 11px;
  text-align: left;
}

.qor-chart-data th,
.qor-chart-data td {
  padding: 5px 6px;
  border-top: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);
}

.qor-chart-data th[scope='row'] {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.qor-chart-data td:last-child {
  white-space: normal;
}

.qor-delta-list-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 14px;
}

.qor-delta-tabs {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-bottom: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--bg-secondary) 68%, var(--bg-primary));
}

.qor-delta-tab {
  display: inline-flex;
  min-width: 0;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 6px;
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  font-weight: 760;
}

.qor-delta-tab span {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qor-delta-tab:hover,
.qor-delta-tab.selected {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-color) 7%, var(--bg-primary));
}

.qor-delta-tab.selected {
  border-bottom-color: var(--accent-color);
}

.qor-delta-tab:focus-visible,
.qor-inline-action:focus-visible,
.qor-toolbar-button:focus-visible,
.qor-timing-select:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent-color) 72%, transparent);
  outline-offset: -2px;
}

.qor-delta-tab strong {
  display: inline-grid;
  min-width: 16px;
  height: 16px;
  place-items: center;
  border-radius: 999px;
  color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 12%, var(--bg-primary));
  font-size: 10px;
}

.qor-delta-list-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  padding-bottom: 9px;
  border-bottom: 1px solid var(--border-color);
}

.qor-delta-list-header > span {
  font-size: 12px;
  font-weight: 700;
}

.qor-delta-list-header small {
  color: var(--text-secondary);
  font-size: 11px;
  text-align: right;
}

.qor-delta-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.qor-delta-table-wrap {
  border: 1px solid color-mix(in srgb, var(--border-color) 78%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-secondary) 24%, var(--bg-primary));
}

.qor-delta-table {
  width: 100%;
  min-width: 0;
  border-collapse: collapse;
  font-size: 11px;
  text-align: right;
}

.qor-delta-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--border-color) 72%, transparent);
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-secondary) 82%, var(--bg-primary));
  font-size: 10px;
  font-weight: 780;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
}

.qor-delta-table thead th:first-child,
.qor-delta-table tbody th {
  text-align: left;
}

.qor-delta-table tbody td,
.qor-delta-table tbody th {
  padding: 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--border-color) 62%, transparent);
  vertical-align: middle;
}

.qor-timing-select {
  width: 100%;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-weight: inherit;
  text-align: left;
}

.qor-timing-select:hover {
  color: var(--accent-color);
}

.qor-delta-table tbody tr:last-child td,
.qor-delta-table tbody tr:last-child th {
  border-bottom: 0;
}

.qor-delta-table tbody td {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  white-space: nowrap;
}

.qor-delta-table.is-regressions tbody td:nth-child(4),
.qor-delta-table.is-regressions tbody td:nth-child(5) {
  color: var(--danger-color, #b91c1c);
}

.qor-delta-table.is-improvements tbody td:nth-child(4),
.qor-delta-table.is-improvements tbody td:nth-child(5) {
  color: var(--success-color, #2f9f6f);
}

.qor-delta-metric-name {
  display: block;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 720;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qor-delta-table.is-regressions tbody td:last-child,
.qor-delta-table.is-improvements tbody td:last-child {
  width: 72px;
  padding-right: 10px;
}

.qor-delta-bar {
  display: block;
  height: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-color) 72%, transparent);
}

.qor-delta-table.is-regressions .qor-delta-bar {
  background: color-mix(in srgb, var(--danger-color, #b91c1c) 72%, transparent);
}

.qor-delta-table.is-improvements .qor-delta-bar {
  background: color-mix(in srgb, var(--success-color, #2f9f6f) 72%, transparent);
}

.qor-risk-table tbody td:nth-child(2),
.qor-risk-table tbody td:nth-child(3) {
  white-space: nowrap;
}

.qor-severity-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 820;
  letter-spacing: 0.04em;
}

.qor-severity-pill.qor-risk-critical {
  color: var(--error-color, #b91c1c);
  background: color-mix(in srgb, var(--error-color, #b91c1c) 12%, var(--bg-primary));
}

.qor-severity-pill.qor-risk-warning {
  color: var(--warning-color, #b45309);
  background: color-mix(in srgb, var(--warning-color, #b45309) 12%, var(--bg-primary));
}

.qor-severity-pill.qor-risk-info {
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-secondary) 70%, var(--bg-primary));
}

.qor-cell-wrap {
  overflow-wrap: anywhere;
  white-space: normal;
  text-align: left;
}

.qor-timing-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.qor-timing-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.qor-summary-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 760;
}

.qor-summary-chip.critical {
  color: var(--error-color, #b91c1c);
  background: color-mix(in srgb, var(--error-color, #b91c1c) 10%, var(--bg-primary));
}

.qor-summary-chip.warning {
  color: var(--warning-color, #b45309);
  background: color-mix(in srgb, var(--warning-color, #b45309) 10%, var(--bg-primary));
}

.qor-summary-chip.coverage {
  color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 10%, var(--bg-primary));
}

.qor-summary-chip.cleared {
  color: var(--success-color, #15803d);
  background: color-mix(in srgb, var(--success-color, #15803d) 10%, var(--bg-primary));
}

.qor-timing-table tbody td:nth-child(4) {
  font-weight: 760;
}

.qor-timing-row {
  cursor: pointer;
}

.qor-timing-row:hover td,
.qor-timing-row:hover th,
.qor-timing-row.selected td,
.qor-timing-row.selected th {
  background: color-mix(in srgb, var(--accent-color) 6%, var(--bg-primary));
}

.qor-timing-row.expanded td,
.qor-timing-row.expanded th {
  border-bottom-color: transparent;
}

.qor-row-expand {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--border-color) 78%, transparent);
  border-radius: 4px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  cursor: pointer;
}

.qor-row-expand:hover,
.qor-row-expand:focus-visible {
  border-color: color-mix(in srgb, var(--accent-color) 50%, var(--border-color));
  color: var(--accent-color);
}

.qor-timing-detail-row td {
  padding-top: 0;
  background: color-mix(in srgb, var(--bg-secondary) 28%, var(--bg-primary));
}

.qor-timing-detail-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0 0 8px 0;
  list-style: none;
  color: var(--text-secondary);
  font-size: 11px;
  text-align: left;
}

.qor-triage-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 780;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.qor-triage-pill.qor-timing-triage-new {
  color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 10%, var(--bg-primary));
}

.qor-triage-pill.qor-timing-triage-regressed {
  color: var(--error-color, #b91c1c);
  background: color-mix(in srgb, var(--error-color, #b91c1c) 10%, var(--bg-primary));
}

.qor-triage-pill.qor-timing-triage-persistent {
  color: var(--warning-color, #b45309);
  background: color-mix(in srgb, var(--warning-color, #b45309) 10%, var(--bg-primary));
}

.qor-triage-pill.qor-timing-triage-improved {
  color: var(--success-color, #15803d);
  background: color-mix(in srgb, var(--success-color, #15803d) 10%, var(--bg-primary));
}

.qor-timing-subsection {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.qor-subsection-title {
  margin: 0;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 780;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.sr-only {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  border: 0;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.qor-scroll-list {
  min-height: 0;
}

.qor-delta-list > li:not(.qor-timing-issue) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px 10px;
  padding: 9px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
}

.qor-delta-list strong {
  color: var(--accent-color);
  font-size: 12px;
}

.qor-delta-list strong.qor-risk-critical {
  color: var(--error-color, #b91c1c);
}

.qor-delta-list strong.qor-risk-warning {
  color: var(--warning-color, #b45309);
}

.qor-delta-list strong.qor-risk-info {
  color: var(--text-secondary);
}

.qor-delta-list small {
  grid-column: 1 / -1;
  overflow-wrap: anywhere;
  text-align: left;
}

.qor-timing-issue {
  min-width: 0;
}

.qor-timing-issue button {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 7px 10px;
  padding: 9px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.qor-timing-issue button:hover,
.qor-timing-issue button:focus-visible,
.qor-timing-issue button.selected {
  border-color: color-mix(in srgb, var(--accent-color) 50%, var(--border-color));
  background: color-mix(in srgb, var(--accent-color) 8%, var(--bg-primary));
}

.qor-timing-issue-kind {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 800;
}

.qor-timing-issue-kind em {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 10px;
  font-style: normal;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qor-timing-issue-kind em.qor-timing-triage-new {
  color: var(--accent-color);
}

.qor-timing-issue-kind em.qor-timing-triage-regressed {
  color: var(--error-color, #b91c1c);
}

.qor-timing-issue-kind em.qor-timing-triage-persistent {
  color: var(--warning-color, #b45309);
}

.qor-timing-issue-kind em.qor-timing-triage-improved,
.qor-timing-issue strong.qor-timing-triage-improved {
  color: var(--success-color, #15803d);
}

.qor-timing-issue button > small {
  grid-column: 1 / -1;
  overflow-wrap: anywhere;
  color: var(--text-secondary);
  font-size: 11px;
}

.qor-empty-note {
  margin: 0;
  font-size: 12px;
}

@media (max-width: 560px) {
  .qor-attention header,
  .qor-attention header > div {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }

  .qor-attention-threshold {
    text-align: left;
  }

  .qor-attention-list {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .qor-attention-item {
    padding: 0;
  }

  .qor-attention-item:not(:last-child) {
    padding-bottom: 8px;
    border-right: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--border-color) 76%, transparent);
  }

  .qor-delta-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .qor-delta-card {
    padding: 14px;
  }

  .qor-delta-list-panel {
    padding: 0;
  }
}
</style>
