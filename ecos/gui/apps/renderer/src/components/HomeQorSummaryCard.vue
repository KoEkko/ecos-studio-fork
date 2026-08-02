<script setup lang="ts">
import { computed } from 'vue'
import SummaryDonut from '@/components/SummaryDonut.vue'
import { useBottomPanel } from '@/composables/useBottomPanel'
import { QOR_GATE_LABELS } from '@/composables/useHomeQorMetrics'
import type {
  ProjectQorBlockingIssue,
  ProjectQorGateTally,
  QorGateStatus,
} from '@/utils/projectQorTrend'
import type { SummaryDonutSlice, SummaryDonutTone } from '@/utils/summaryDonut'

const props = defineProps<{
  overallScore: number | null
  gateStatus: QorGateStatus
  blockingIssues: ProjectQorBlockingIssue[]
  gateTally: ProjectQorGateTally
  loading?: boolean
  error?: string | null
}>()

const { openBottomPanel } = useBottomPanel()

const scoreDisplay = computed(() =>
  props.overallScore === null ? '–' : String(Math.round(props.overallScore)),
)

/*
 * The gate is the verdict; the score is the reading behind it. Colouring both meant a
 * run could show a red 57 beside a green "Gate pass" and leave the reader deciding
 * which one to believe — so only the verdict carries a tone, and the score stays
 * neutral until there is no score at all.
 */
const hasScore = computed(() => props.overallScore !== null)

const gateLabel = computed(() => QOR_GATE_LABELS[props.gateStatus])

const GATE_TONES: Record<QorGateStatus, SummaryDonutTone> = {
  pass: 'good',
  blocked: 'bad',
  incomplete: 'warn',
  unavailable: 'neutral',
}

/*
 * The ring measures the score against 100, the same number printed inside it. It used
 * to plot how the eight metrics were distributed while the centre showed the score —
 * two different quantities in one graphic, which read as "57% of the ring" and was
 * wrong however you interpreted it. How the metrics are distributed is the snapshot
 * card's job. Colour follows the gate so the ring echoes the verdict instead of
 * arguing with it.
 */
const slices = computed<SummaryDonutSlice[]>(() =>
  props.overallScore === null
    ? []
    : [
        {
          id: 'score',
          label: 'Score',
          value: props.overallScore,
          tone: GATE_TONES[props.gateStatus],
        },
      ],
)

/*
 * Guards the tally, which counts gates rather than the eight metric tiles. The tiles
 * belong to the snapshot card, which already colours the ones out of spec, so counting
 * them here would tell the same story twice and put the snapshot's denominator beside a
 * card whose subject is the gates.
 */
const hasGates = computed(() => props.gateTally.total > 0)

/*
 * Names the gates holding sign-off shut, which is the part the counts cannot give.
 */
const gateDetail = computed(() => {
  if (props.blockingIssues.length) {
    return props.blockingIssues.map((issue) => issue.displayName).join(' · ')
  }
  if (!hasGates.value) return ''
  if (props.gateTally.warning > 0) return 'Nothing blocking sign-off'
  return `All ${props.gateTally.total} gates passed`
})

const gateHint = computed(() =>
  props.blockingIssues.length
    ? props.blockingIssues
        .map((issue) => `${issue.displayName}: ${issue.reason}`)
        .join('\n')
    : undefined,
)
</script>

<template>
  <section class="section-card qor-summary-card">
    <div class="section-header">
      <h2>Quality of Results</h2>
    </div>

    <div class="qor-summary-body">
      <SummaryDonut :slices="slices" :total="100" :size="56" :thickness="8">
        <span class="qor-score" :class="{ 'qor-score--pending': !hasScore }">
          {{ scoreDisplay }}
        </span>
        <span class="qor-score-label">/ 100</span>
      </SummaryDonut>

      <dl class="qor-facts">
        <div class="qor-fact qor-fact--verdict">
          <dd :class="`qor-gate--${gateStatus}`">{{ gateLabel }}</dd>
        </div>
        <template v-if="hasGates">
          <div class="qor-fact">
            <dt>Blocked</dt>
            <dd :class="{ 'qor-fact--bad': gateTally.blocked > 0 }">
              {{ gateTally.blocked }}/{{ gateTally.total }}
            </dd>
          </div>
          <div class="qor-fact">
            <dt>Warning</dt>
            <dd :class="{ 'qor-fact--warn': gateTally.warning > 0 }">
              {{ gateTally.warning }}/{{ gateTally.total }}
            </dd>
          </div>
        </template>
        <!-- No tone of its own: the verdict above already carries the colour. -->
        <div v-if="gateDetail" class="qor-fact qor-fact--detail">
          <dd :title="gateHint">{{ gateDetail }}</dd>
        </div>
      </dl>

      <p v-if="error" class="qor-note qor-note--error">{{ error }}</p>
      <p v-else-if="loading" class="qor-note">Loading…</p>

      <button type="button" class="card-details-link" @click="openBottomPanel('qor')">
        QoR details
      </button>
    </div>
  </section>
</template>

<style scoped src="./sectionCard.css"></style>

<style scoped>
.qor-summary-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  /* min-content floor on the first row: without it a short window lets the facts
     bleed into the row the details link occupies. */
  grid-template-rows: minmax(min-content, 1fr) auto;
  align-items: center;
  gap: 6px 14px;
  padding: 0 14px 10px;
}

.qor-score {
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 17px;
  font-weight: 600;
  line-height: 1;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.qor-score--pending {
  color: var(--text-secondary);
}

.qor-score-label {
  font-size: 9px;
  color: var(--text-secondary);
  opacity: 0.7;
}

.qor-facts {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0;
  min-width: 0;
}

.qor-fact {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.qor-fact dt {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.qor-fact dd {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.qor-fact--verdict dd {
  font-size: 13px;
  font-weight: 600;
}

.qor-fact--detail dd {
  min-width: 0;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.qor-gate--pass {
  color: var(--success-color);
}

.qor-gate--blocked {
  color: var(--danger-color);
}

.qor-gate--incomplete {
  color: var(--warn-color);
}

.qor-gate--unavailable {
  color: var(--text-secondary);
}

/*
 * `dd` qualifier required: `.qor-fact dd` above sets the neutral colour at the same
 * specificity a bare class cannot beat, so an unqualified rule here would lose and the
 * count would stay grey however bad it got.
 */
.qor-fact dd.qor-fact--bad {
  color: var(--danger-color);
}

.qor-fact dd.qor-fact--warn {
  color: var(--warn-color);
}

.qor-note {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qor-note--error {
  color: var(--danger-color);
}

.card-details-link {
  grid-column: 1 / -1;
  justify-self: end;
}
</style>
