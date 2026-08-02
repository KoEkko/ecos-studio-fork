<script setup lang="ts">
import type { AnalysisChartItem } from '@/composables/useHomeData'
import type { HomeQorMetricTile } from '@/composables/useHomeQorMetrics'

defineProps<{
  tiles: HomeQorMetricTile[]
  charts: AnalysisChartItem[]
  loading?: boolean
  error?: string | null
  hasMetrics?: boolean
}>()

const emit = defineEmits<{
  preview: [chart: AnalysisChartItem]
}>()
</script>

<template>
  <section class="section-card snapshot-card">
    <div class="section-header">
      <h2>Snapshot</h2>
      <span class="header-hint">Key metrics and analysis charts</span>
    </div>

    <div class="snapshot-body">
      <div class="snapshot-metrics">
        <p v-if="error" class="snapshot-note snapshot-note--error">{{ error }}</p>

        <table
          v-else
          class="snapshot-table"
          :class="{ 'snapshot-table--muted': loading }"
        >
          <tbody>
            <tr v-for="tile in tiles" :key="tile.id" :title="tile.hint">
              <th scope="row">{{ tile.label }}</th>
              <td :class="`snapshot-value--${tile.state}`">{{ tile.display }}</td>
            </tr>
          </tbody>
        </table>

        <p v-if="!error && !hasMetrics && !loading" class="snapshot-note">
          Metrics appear once the flow produces step QoR analysis.
        </p>
      </div>

      <div v-if="charts.length" class="snapshot-charts">
        <button
          v-for="chart in charts"
          :key="chart.label"
          type="button"
          class="snapshot-chart"
          :title="chart.label"
          @click="emit('preview', chart)"
        >
          <span class="snapshot-chart-label">{{ chart.label }}</span>
          <span class="snapshot-chart-visual">
            <img :src="chart.imageBlobUrl" :alt="chart.label" draggable="false" />
          </span>
        </button>
      </div>

      <p v-else class="snapshot-note snapshot-charts-empty">
        After running the flow, indicator snapshots will be displayed.
      </p>
    </div>
  </section>
</template>

<style scoped src="./sectionCard.css"></style>

<style scoped>
/*
 * The metrics column is capped at the width its longest label plus a value needs.
 * Given a share of the card instead, the table stretches and leaves a void between
 * "Frequency [MHz]" and its number, which breaks the pair the eye is reading. The
 * width it gives up goes to the thumbnails, which are the part that wants area.
 */
.snapshot-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 200px) minmax(0, 1fr);
  gap: 18px;
  padding: 0 14px 12px;
  align-items: stretch;
}

.snapshot-metrics {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  align-self: center;
}

.snapshot-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.snapshot-table--muted {
  opacity: 0.55;
}

/* Split so the longest label still fits before the value column claims the rest. */
.snapshot-table th {
  width: 62%;
  padding: 3px 8px 3px 0;
  text-align: left;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.snapshot-table td {
  padding: 3px 0;
  text-align: right;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Rules between rows, not around them: the card already has an outline. */
.snapshot-table tr + tr th,
.snapshot-table tr + tr td {
  border-top: 1px solid color-mix(in srgb, var(--border-color) 55%, transparent);
}

/*
 * Only the exceptions are coloured. Any metric that is merely within spec reports
 * `good`, so colouring those too would turn the whole column green and leave the one
 * number that wants attention no louder than the rest — `good` keeps the neutral
 * value colour. The `td` qualifier is required: `.snapshot-table td` above would
 * otherwise out-specify a bare state class and silently win.
 */
.snapshot-table td.snapshot-value--warn {
  color: var(--warn-color);
}

.snapshot-table td.snapshot-value--bad {
  color: var(--danger-color);
}

.snapshot-table td.snapshot-value--pending {
  color: var(--text-secondary);
}

/*
 * The snapshot row absorbs leftover viewport height; these tiles should grow with it.
 * Equal `1fr` rows keep a wrapped last line from swallowing the slack alone. Images
 * scale inside each plate via `max-*` + `place-items: center`, not by stretching the
 * `<img>` box to the full cell (which pinned bar charts to the bottom in full screen).
 */
.snapshot-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  gap: 10px;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.snapshot-chart {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  min-height: 0;
  height: 100%;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
}

.snapshot-chart-label {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snapshot-chart:hover .snapshot-chart-label {
  color: var(--text-primary);
}

.snapshot-chart-visual {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);
  border-radius: 7px;
  /* Charts are rendered on a white canvas, so the plate stays white in both themes
     rather than fighting the image with a dark frame. */
  background: #fff;
  overflow: hidden;
  transition: border-color 0.12s ease;
}

.snapshot-chart:hover .snapshot-chart-visual {
  border-color: color-mix(in srgb, var(--accent-color) 60%, transparent);
}

.snapshot-chart-visual img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}

.snapshot-note {
  margin: 0;
  font-size: 11px;
  color: var(--text-secondary);
}

.snapshot-note--error {
  color: var(--danger-color);
}

.snapshot-charts-empty {
  align-self: center;
}
</style>
