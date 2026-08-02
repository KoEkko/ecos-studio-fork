<script setup lang="ts">
import { computed } from 'vue'
import SummaryDonut from '@/components/SummaryDonut.vue'
import type { ChecklistItem } from '@/composables/useHomeData'
import { useBottomPanel } from '@/composables/useBottomPanel'
import { buildChecklistSummary } from '@/utils/checklistSummary'
import type { SummaryDonutSlice } from '@/utils/summaryDonut'

const props = defineProps<{
  items: ChecklistItem[]
}>()

const { openBottomPanel } = useBottomPanel()

const summary = computed(() => buildChecklistSummary(props.items))

const completionDisplay = computed(() =>
  summary.value.completionRate === null ? '–' : `${summary.value.completionRate}%`,
)

const tone = computed(() => {
  if (summary.value.blockingCount > 0) return 'bad'
  if (summary.value.total === 0) return 'pending'
  if (summary.value.failed > 0) return 'bad'
  if (summary.value.warning > 0 || summary.value.outstanding > 0) return 'warn'
  return 'good'
})

const verdict = computed(() => {
  if (summary.value.total === 0) return 'Not run yet'
  if (summary.value.blockingCount > 0) return 'Sign-off blocked'
  if (summary.value.failed > 0) return 'Failures to clear'
  if (summary.value.warning > 0 || summary.value.outstanding > 0)
    return 'Sign-off pending'
  return 'Sign-off ready'
})

/*
 * "2/24 blocked" tells the reader something is wrong but not what, so the only move
 * left is to open the details panel. Naming the items answers it in place; the count
 * above stays because it is the one that says how much of the checklist is affected.
 */
const blockedDetail = computed(() => {
  if (summary.value.total === 0) return ''
  if (summary.value.blockingItems.length) {
    return summary.value.blockingItems.map((item) => item.title).join(' · ')
  }
  if (summary.value.passed === summary.value.total) {
    return `All ${summary.value.total} checks passed`
  }
  return 'Nothing blocking sign-off'
})

/** The summaries are too long for the card, but worth having on hover. */
const blockedHint = computed(() =>
  summary.value.blockingItems.length
    ? summary.value.blockingItems
        .map((item) => `${item.title}: ${item.summary}`)
        .join('\n')
    : undefined,
)

const slices = computed<SummaryDonutSlice[]>(() => [
  { id: 'passed', label: 'Passed', value: summary.value.passed, tone: 'good' },
  { id: 'failed', label: 'Failed', value: summary.value.failed, tone: 'bad' },
  { id: 'warning', label: 'Warning', value: summary.value.warning, tone: 'warn' },
  { id: 'pending', label: 'Pending', value: summary.value.outstanding, tone: 'neutral' },
])
</script>

<template>
  <section class="section-card checklist-summary-card">
    <div class="section-header">
      <h2>Checklist</h2>
    </div>

    <div class="checklist-summary-body">
      <SummaryDonut :slices="slices" :size="56" :thickness="8">
        <span class="checklist-rate" :class="`checklist-rate--${tone}`">
          {{ completionDisplay }}
        </span>
        <span class="checklist-rate-label">passing</span>
      </SummaryDonut>

      <dl class="checklist-facts">
        <div class="checklist-fact checklist-fact--verdict">
          <dd :class="`checklist-verdict--${tone}`">{{ verdict }}</dd>
        </div>
        <div class="checklist-fact">
          <dt>Blocked</dt>
          <dd :class="{ 'checklist-fact--bad': summary.blockingCount > 0 }">
            {{ summary.blockingCount }}/{{ summary.total }}
          </dd>
        </div>
        <div class="checklist-fact">
          <dt>Warning</dt>
          <dd :class="{ 'checklist-fact--warn': summary.warning > 0 }">
            {{ summary.warning }}/{{ summary.total }}
          </dd>
        </div>
        <div v-if="blockedDetail" class="checklist-fact checklist-fact--detail">
          <dd :title="blockedHint">{{ blockedDetail }}</dd>
        </div>
      </dl>

      <button
        type="button"
        class="card-details-link"
        @click="openBottomPanel('checklist')"
      >
        Sign-off details
      </button>
    </div>
  </section>
</template>

<style scoped src="./sectionCard.css"></style>

<style scoped>
.checklist-summary-body {
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

.checklist-rate {
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 15px;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.checklist-rate--good {
  color: var(--success-color);
}

.checklist-rate--warn {
  color: var(--warn-color);
}

.checklist-rate--bad {
  color: var(--danger-color);
}

.checklist-rate--pending {
  color: var(--text-secondary);
}

.checklist-rate-label {
  font-size: 9px;
  color: var(--text-secondary);
  opacity: 0.7;
}

.checklist-facts {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0;
  min-width: 0;
}

.checklist-fact {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.checklist-fact dt {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.checklist-fact dd {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.checklist-fact--verdict dd {
  font-size: 13px;
  font-weight: 600;
}

.checklist-fact--detail dd {
  min-width: 0;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.checklist-verdict--good {
  color: var(--success-color);
}

.checklist-verdict--warn {
  color: var(--warn-color);
}

.checklist-verdict--bad {
  color: var(--danger-color);
}

.checklist-verdict--pending {
  color: var(--text-secondary);
}

/*
 * `dd` qualifier required: `.checklist-fact dd` above sets the neutral colour at the same
 * specificity a bare class cannot beat, so an unqualified rule here would lose and the
 * count would stay grey however bad it got.
 */
.checklist-fact dd.checklist-fact--bad {
  color: var(--danger-color);
}

.checklist-fact dd.checklist-fact--warn {
  color: var(--warn-color);
}

.card-details-link {
  grid-column: 1 / -1;
  justify-self: end;
}
</style>
