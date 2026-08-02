<script setup lang="ts">
import { computed } from 'vue'
import { QOR_GATE_LABELS, useHomeQorMetrics } from '@/composables/useHomeQorMetrics'

const {
  metricTiles,
  hasMetrics,
  overallScore,
  gateStatus,
  blockingIssues,
  isLoading,
  error,
} = useHomeQorMetrics()

const scoreDisplay = computed(() =>
  overallScore.value === null ? '–' : String(Math.round(overallScore.value)),
)
const gateLabel = computed(() => QOR_GATE_LABELS[gateStatus.value])
</script>

<template>
  <div class="qor-details-panel">
    <div class="qor-details-bar">
      <span class="qor-details-score">{{ scoreDisplay }}<small>/ 100</small></span>
      <span class="qor-details-gate" :class="`qor-details-gate--${gateStatus}`">
        <i class="ri-shield-check-line"></i>{{ gateLabel }}
      </span>
      <span v-if="isLoading" class="qor-details-note">Loading…</span>
      <span v-else-if="error" class="qor-details-note qor-details-note--error">
        {{ error }}
      </span>
    </div>

    <div class="qor-details-body">
      <section class="qor-details-section">
        <h3>Metrics</h3>
        <table class="qor-details-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tile in metricTiles" :key="tile.id" :title="tile.hint">
              <td>{{ tile.label }}</td>
              <td :class="`qor-details-value--${tile.state}`">{{ tile.display }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!hasMetrics && !isLoading" class="qor-details-note">
          Metrics appear once the flow produces step QoR analysis.
        </p>
      </section>

      <section class="qor-details-section">
        <h3>Blocking issues</h3>
        <ul v-if="blockingIssues.length" class="qor-details-issues">
          <li v-for="issue in blockingIssues" :key="`${issue.step}-${issue.metric}`">
            <span class="qor-details-issue-step">{{ issue.step }}</span>
            <span class="qor-details-issue-metric">{{ issue.displayName }}</span>
            <span class="qor-details-issue-reason">{{ issue.reason }}</span>
          </li>
        </ul>
        <p v-else class="qor-details-note">No blocking issues.</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.qor-details-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.qor-details-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: baseline;
  gap: 14px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}

.qor-details-score {
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.qor-details-score small {
  margin-left: 3px;
  font-size: 10px;
  font-weight: 400;
  color: var(--text-secondary);
}

.qor-details-gate {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

.qor-details-gate--pass {
  color: var(--success-color);
}

.qor-details-gate--blocked {
  color: var(--danger-color);
}

.qor-details-gate--incomplete {
  color: var(--warn-color);
}

.qor-details-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(0, 1.4fr);
  gap: 16px;
  padding: 12px;
  overflow: auto;
}

.qor-details-section h3 {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.qor-details-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.qor-details-table th {
  text-align: left;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-secondary);
  padding: 0 8px 5px 0;
}

.qor-details-table td {
  padding: 5px 8px 5px 0;
  border-top: 1px solid color-mix(in srgb, var(--border-color) 55%, transparent);
  color: var(--text-primary);
}

.qor-details-table td:last-child {
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.qor-details-value--good {
  color: var(--success-color);
}

.qor-details-value--warn {
  color: var(--warn-color);
}

.qor-details-value--bad {
  color: var(--danger-color);
}

.qor-details-value--pending {
  color: var(--text-secondary);
}

.qor-details-issues {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.qor-details-issues li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  font-size: 11px;
  color: var(--text-secondary);
}

.qor-details-issue-step {
  flex: 0 0 auto;
  font-weight: 600;
  color: var(--text-primary);
}

.qor-details-issue-metric {
  flex: 0 0 auto;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
}

.qor-details-issue-reason {
  min-width: 0;
}

.qor-details-note {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--text-secondary);
}

.qor-details-note--error {
  color: var(--danger-color);
}
</style>
