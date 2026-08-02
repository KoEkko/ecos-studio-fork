<script setup lang="ts">
import { computed } from 'vue'
import {
  buildSummaryDonutArcs,
  donutCircumference,
  type SummaryDonutSlice,
} from '@/utils/summaryDonut'

const props = withDefaults(
  defineProps<{
    slices: SummaryDonutSlice[]
    size?: number
    thickness?: number
    /** Set it to read the ring as a gauge against a fixed scale; see buildSummaryDonutArcs. */
    total?: number
  }>(),
  { size: 62, thickness: 9, total: undefined },
)

const radius = computed(() => (props.size - props.thickness) / 2)
const center = computed(() => props.size / 2)
const circumference = computed(() => donutCircumference(radius.value))
const arcs = computed(() =>
  buildSummaryDonutArcs(props.slices, circumference.value, props.total),
)
</script>

<template>
  <div class="summary-donut" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :viewBox="`0 0 ${size} ${size}`" role="presentation" focusable="false">
      <!-- Rotated so the first slice starts at twelve o'clock rather than three. -->
      <g :transform="`rotate(-90 ${center} ${center})`">
        <circle
          class="summary-donut-track"
          :cx="center"
          :cy="center"
          :r="radius"
          :stroke-width="thickness"
          fill="none"
        />
        <circle
          v-for="arc in arcs"
          :key="arc.id"
          class="summary-donut-arc"
          :class="`summary-donut-arc--${arc.tone}`"
          :cx="center"
          :cy="center"
          :r="radius"
          :stroke-width="thickness"
          :stroke-dasharray="arc.dashArray"
          :stroke-dashoffset="arc.dashOffset"
          fill="none"
        >
          <title>{{ arc.label }}: {{ arc.value }}</title>
        </circle>
      </g>
    </svg>
    <div class="summary-donut-center">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.summary-donut {
  position: relative;
  flex: 0 0 auto;
}

.summary-donut svg {
  width: 100%;
  height: 100%;
  display: block;
}

.summary-donut-track {
  stroke: color-mix(in srgb, var(--text-secondary) 14%, transparent);
}

.summary-donut-arc {
  stroke-linecap: butt;
}

.summary-donut-arc--good {
  stroke: var(--success-color);
}

.summary-donut-arc--warn {
  stroke: var(--warn-color);
}

.summary-donut-arc--bad {
  stroke: var(--danger-color);
}

.summary-donut-arc--neutral {
  stroke: color-mix(in srgb, var(--text-secondary) 45%, transparent);
}

.summary-donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  pointer-events: none;
}
</style>
