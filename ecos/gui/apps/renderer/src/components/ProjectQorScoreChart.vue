<template>
  <section class="qor-score-panel" aria-label="QoR score by workspace">
    <header class="qor-score-header">
      <div class="qor-score-heading">
        <span>QoR score by workspace</span>
        <strong v-if="highestScore !== null" class="qor-best-chip">
          {{ formatScore(highestScore) }}
          <em>best</em>
        </strong>
        <strong v-else class="qor-best-chip muted">NR</strong>
      </div>
      <small>{{ trendPoints.length }} workspaces · baseline {{ baselineLabel }}</small>
    </header>

    <div
      v-if="trendPoints.length > 0"
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
          :x="CHART_LEFT"
          :y="CHART_TOP"
          :width="Math.max(0, chartPlotRight - CHART_LEFT)"
          :height="Math.max(0, CHART_BOTTOM - CHART_TOP)"
          rx="1.2"
        />
        <g v-for="score in SCORE_TICKS" :key="score">
          <line
            class="qor-chart-gridline"
            :class="{ threshold: score === SCORE_THRESHOLD }"
            :x1="CHART_LEFT"
            :x2="chartPlotRight"
            :y1="scoreToChartY(score)"
            :y2="scoreToChartY(score)"
          />
          <text
            class="qor-chart-score-label"
            :class="{ threshold: score === SCORE_THRESHOLD }"
            :x="CHART_LEFT - 2.4"
            :y="scoreToChartY(score)"
            text-anchor="end"
            dominant-baseline="middle"
          >
            {{ score }}
          </text>
        </g>
        <line
          class="qor-chart-axis"
          :x1="CHART_LEFT"
          :x2="CHART_LEFT"
          :y1="CHART_TOP"
          :y2="CHART_BOTTOM"
        />
        <line
          class="qor-chart-axis"
          :x1="CHART_LEFT"
          :x2="chartPlotRight"
          :y1="CHART_BOTTOM"
          :y2="CHART_BOTTOM"
        />
        <g
          v-for="point in chartPoints"
          :key="point.workspaceId"
          class="qor-lollipop"
          :class="pointClasses(point)"
          role="button"
          tabindex="0"
          :aria-label="pointDescription(point)"
          @click="emit('select-workspace', point.workspaceId)"
          @keydown.enter.prevent="emit('select-workspace', point.workspaceId)"
          @keydown.space.prevent="emit('select-workspace', point.workspaceId)"
        >
          <title>{{ pointDescription(point) }}</title>
          <rect
            class="qor-chart-hit"
            :x="point.x - hitHalfWidth"
            :y="CHART_TOP"
            :width="hitHalfWidth * 2"
            :height="CHART_BOTTOM - CHART_TOP"
          />
          <line
            class="qor-chart-stem"
            :class="pointClasses(point)"
            :x1="point.x"
            :x2="point.x"
            :y1="CHART_BOTTOM"
            :y2="point.y"
          />
          <circle
            v-if="!point.isNotRated"
            class="qor-chart-point"
            :class="pointClasses(point)"
            :cx="point.x"
            :cy="point.y"
            :r="point.isSelected ? 2.4 : 1.85"
          />
          <text
            v-if="!point.isNotRated"
            class="qor-chart-value-label"
            :class="pointClasses(point)"
            :x="point.x"
            :y="point.y - 5.2"
            text-anchor="middle"
          >
            {{ formatScore(point.score) }}
          </text>
          <g v-else class="qor-chart-nr-marker">
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
          <g class="qor-chart-tick" :transform="`translate(${point.x}, ${CHART_BOTTOM})`">
            <line class="qor-chart-x-tick" x1="0" y1="0" x2="0" y2="2.4" />
            <text
              class="qor-chart-workspace-label"
              :class="pointClasses(point)"
              x="0"
              y="9.2"
              text-anchor="end"
              transform="rotate(-40)"
            >
              {{ shortenLabel(point.label) }}
            </text>
          </g>
        </g>
      </svg>
    </div>
    <p v-else class="qor-score-empty">No workspace has a QoR score yet.</p>

    <p id="qor-chart-description" class="sr-only">{{ accessibleSummary }}</p>

    <div class="qor-chart-legend" role="list" aria-label="QoR chart legend">
      <span role="listitem"
        ><i class="legend-selected" aria-hidden="true"></i>Selected</span
      >
      <span role="listitem"
        ><i class="legend-baseline" aria-hidden="true"></i>Baseline</span
      >
      <span role="listitem"
        ><i class="legend-pass" aria-hidden="true"></i>{{ SCORE_THRESHOLD }} analysis
        threshold</span
      >
      <span role="listitem"><i class="legend-nr" aria-hidden="true"></i>Not rated</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ProjectQorTrendPoint } from '@/utils/projectQorTrend'

const SCORE_TICKS = [0, 20, 40, 60, 80, 100] as const
const SCORE_THRESHOLD = 60
const CHART_LEFT = 20
const CHART_RIGHT = 8
const CHART_TOP = 10
const CHART_BOTTOM = 68
const CHART_NOT_RATED_Y = 56

interface ChartPoint extends ProjectQorTrendPoint {
  isBest: boolean
  isNotRated: boolean
  isSelected: boolean
  isBaseline: boolean
  x: number
  y: number
}

const props = defineProps<{
  trendPoints: ProjectQorTrendPoint[]
  baselineWorkspaceId: string | null
  baselineLabel: string
  selectedWorkspaceId: string
}>()

const emit = defineEmits<{
  'select-workspace': [workspaceId: string]
}>()

const chartViewport = ref<HTMLElement | null>(null)
const chartViewportSize = ref({ width: 0, height: 0 })
let chartResizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!chartViewport.value || typeof ResizeObserver === 'undefined') return

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

const highestScore = computed(() =>
  props.trendPoints.reduce<number | null>(
    (best, point) =>
      point.score === null
        ? best
        : best === null
          ? point.score
          : Math.max(best, point.score),
    null,
  ),
)

const chartCoordinateWidth = computed(() => {
  const { width, height } = chartViewportSize.value
  if (width <= 0 || height <= 0) return 180
  return Math.max(120, (width / height) * 100)
})
const chartPlotRight = computed(() => chartCoordinateWidth.value - CHART_RIGHT)
const chartViewBox = computed(() => `0 0 ${chartCoordinateWidth.value.toFixed(2)} 100`)

const chartPoints = computed<ChartPoint[]>(() => {
  const points = props.trendPoints
  const plotWidth = chartPlotRight.value - CHART_LEFT
  return points.map((point, index) => ({
    ...point,
    isBest: point.score !== null && point.score === highestScore.value,
    isNotRated: point.score === null,
    isSelected: point.workspaceId === props.selectedWorkspaceId,
    isBaseline: point.workspaceId === props.baselineWorkspaceId,
    x:
      points.length <= 1
        ? CHART_LEFT
        : CHART_LEFT + (index / (points.length - 1)) * plotWidth,
    y: point.score === null ? CHART_NOT_RATED_Y : scoreToChartY(point.score),
  }))
})

// Widens the pointer target so thin lollipops stay clickable at any workspace count.
const hitHalfWidth = computed(() => {
  const plotWidth = chartPlotRight.value - CHART_LEFT
  if (props.trendPoints.length <= 1) return Math.min(12, plotWidth / 2)
  return Math.min(12, plotWidth / (props.trendPoints.length - 1) / 2)
})

const accessibleSummary = computed(() => {
  const rated = props.trendPoints.filter((point) => point.score !== null).length
  return `QoR score by workspace from 0 to 100. ${rated} of ${props.trendPoints.length} workspaces are rated. The ${SCORE_THRESHOLD} line is an analysis threshold only and does not determine signoff. Baseline: ${props.baselineLabel}.`
})

function scoreToChartY(score: number): number {
  const normalized = Math.max(0, Math.min(100, score))
  return Number(
    (CHART_BOTTOM - (normalized / 100) * (CHART_BOTTOM - CHART_TOP)).toFixed(2),
  )
}

function pointClasses(point: ChartPoint): Record<string, boolean> {
  return {
    rated: !point.isNotRated,
    best: point.isBest && !point.isNotRated,
    selected: point.isSelected,
    baseline: point.isBaseline,
  }
}

function pointDescription(point: ChartPoint): string {
  const tags: string[] = []
  if (point.isSelected) tags.push('selected')
  if (point.isBaseline) tags.push('baseline')
  if (point.score === null) {
    tags.push('not rated')
  } else {
    tags.push(
      point.score < SCORE_THRESHOLD
        ? `below the ${SCORE_THRESHOLD} analysis threshold`
        : `meets the ${SCORE_THRESHOLD} analysis threshold`,
    )
  }
  return `${point.label}: ${formatScore(point.score)} (${tags.join(', ')})`
}

function shortenLabel(label: string): string {
  return label.length > 8 ? `${label.slice(0, 8)}...` : label
}

function formatScore(score: number | null): string {
  return score === null ? 'Not rated' : score.toFixed(1)
}
</script>

<style scoped>
.qor-score-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 14px 14px;
  background: var(--bg-primary);
}

.qor-score-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.qor-score-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 750;
}

.qor-score-header small {
  min-width: 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qor-best-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  color: var(--success-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.qor-best-chip em {
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 9px;
  font-style: normal;
  font-weight: 700;
  text-transform: uppercase;
}

.qor-best-chip.muted {
  color: var(--text-secondary);
}

.qor-chart-viewport {
  min-height: 210px;
  height: 210px;
  flex: 0 0 auto;
  margin: 0 -4px;
  padding: 8px 4px 2px;
  overflow: hidden;
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
  stroke: color-mix(in srgb, var(--warn-color) 78%, #b45309);
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
  fill: color-mix(in srgb, var(--warn-color) 86%, var(--text-secondary));
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
  fill: var(--success-color);
  font-weight: 720;
}

.qor-chart-workspace-label.selected {
  fill: var(--text-primary);
  font-weight: 760;
}

.qor-chart-value-label {
  fill: var(--accent-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 3.6px;
  font-weight: 760;
}

.qor-chart-value-label.best {
  fill: var(--success-color);
}

.qor-chart-value-label.selected {
  fill: var(--text-primary);
}

.qor-lollipop {
  color: var(--accent-color);
  cursor: pointer;
}

.qor-chart-hit {
  fill: transparent;
}

.qor-lollipop:hover .qor-chart-hit {
  fill: color-mix(in srgb, var(--accent-color) 7%, transparent);
}

/*
 * The pointer target spans the full plot height, so an outline on the group would
 * ring the whole column. Focus is shown on the marker and its axis label instead.
 */
.qor-lollipop:focus,
.qor-lollipop:focus-visible {
  outline: none;
}

.qor-lollipop:focus-visible .qor-chart-point {
  stroke: var(--accent-color);
  stroke-width: 3;
}

.qor-lollipop:focus-visible .qor-chart-nr-pill {
  stroke: var(--accent-color);
  stroke-width: 1.4;
}

.qor-lollipop:focus-visible .qor-chart-workspace-label {
  fill: var(--text-primary);
  font-weight: 780;
  text-decoration: underline;
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
  stroke-width: 1.15;
  stroke-dasharray: none;
}

.qor-chart-stem.best {
  stroke: color-mix(in srgb, var(--success-color) 58%, transparent);
}

.qor-chart-stem.baseline {
  stroke: var(--warn-color);
  stroke-dasharray: none;
}

.qor-chart-stem.selected {
  stroke: var(--text-primary);
  stroke-width: 1.55;
}

.qor-chart-point {
  fill: var(--bg-primary);
  stroke: var(--accent-color);
  stroke-width: 1.45;
  vector-effect: non-scaling-stroke;
}

.qor-chart-point.best {
  fill: var(--success-color);
  stroke: color-mix(in srgb, var(--success-color) 55%, #0b6b48);
  stroke-width: 1;
}

.qor-chart-point.baseline {
  stroke: var(--warn-color);
  stroke-width: 1.55;
}

.qor-chart-point.selected {
  fill: var(--text-primary);
  stroke: var(--text-primary);
  stroke-width: 1.2;
}

.qor-chart-point.selected.baseline {
  fill: var(--warn-color);
  stroke: var(--warn-color);
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
  gap: 8px 14px;
  border-top: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);
  padding-top: 8px;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 650;
}

.qor-chart-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.qor-chart-legend i {
  display: inline-block;
  box-sizing: border-box;
  width: 11px;
  height: 11px;
  border-radius: 999px;
}

.qor-chart-legend .legend-selected {
  border: 2px solid var(--text-primary);
  background: var(--bg-primary);
}

.qor-chart-legend .legend-baseline {
  border: 2px solid var(--warn-color);
  background: var(--bg-primary);
}

.qor-chart-legend .legend-pass {
  width: 14px;
  height: 0;
  border: 1.5px dashed color-mix(in srgb, var(--warn-color) 88%, #b45309);
  border-radius: 2px;
  background: transparent;
}

.qor-chart-legend .legend-nr {
  border: 1px solid color-mix(in srgb, var(--text-secondary) 34%, var(--border-color));
  border-radius: 3px;
  background: color-mix(in srgb, var(--text-secondary) 10%, var(--bg-primary));
}

.qor-score-empty {
  margin: 0;
  padding: 28px 12px;
  color: var(--text-secondary);
  font-size: 11px;
  text-align: center;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  clip: rect(0, 0, 0, 0);
  overflow: hidden;
  white-space: nowrap;
}
</style>
