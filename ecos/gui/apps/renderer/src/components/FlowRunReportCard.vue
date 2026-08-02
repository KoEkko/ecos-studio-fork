<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  runningFlowRunStep,
  type FlowRunReportView,
} from '@/composables/flowRunReport'
import type { FlowRunStep, FlowRunStepState } from '@/composables/flowRunStore'
import { formatDurationSeconds, formatPeakMemory } from '@/utils/duration'

const props = withDefaults(
  defineProps<{
    report: FlowRunReportView
    assistantReady?: boolean
  }>(),
  { assistantReady: false },
)

const emit = defineEmits<{
  openFlowLog: [step: FlowRunStep]
  askAssistant: [step: FlowRunStep, lines: string[]]
}>()

const STEP_ICONS: Record<FlowRunStepState, string> = {
  success: 'ri-check-line',
  failed: 'ri-close-line',
  running: 'ri-loader-4-line',
  pending: 'ri-circle-line',
}

// 失败默认展开看断点；running 也默认展开，好盯当前步骤。
const manualExpanded = ref<boolean | null>(null)
const expanded = computed(
  () =>
    manualExpanded.value ??
    (props.report.state === 'failed' || props.report.state === 'running'),
)

function toggle(): void {
  manualExpanded.value = !expanded.value
}

const runningStep = computed(() => runningFlowRunStep(props.report.steps))

const headline = computed(() => {
  const { title, rerun, failedStep, state } = props.report
  const name = rerun ? `${title} (rerun)` : title
  if (state === 'failed' && failedStep) return `${name} · failed at ${failedStep.label}`
  if (state === 'running' && runningStep.value) {
    return `${name} · running ${runningStep.value.label}`
  }
  return name
})

const durationLabel = computed(() => {
  const { durationSeconds, durationIsStepSum } = props.report
  if (durationSeconds === null) return ''
  const formatted = formatDurationSeconds(durationSeconds)
  return durationIsStepSum ? `${formatted} across steps` : formatted
})

const stateIcon = computed(() => {
  if (props.report.state === 'success') return 'ri-check-line'
  if (props.report.state === 'running') return 'ri-loader-4-line run-report-spin'
  return 'ri-close-line'
})

function stepRuntime(step: FlowRunStep): string {
  if (step.state === 'pending') return 'not run'
  return step.runtime || ''
}

/** pending 步骤没有日志可看，让它不可点，而不是点了打开一个空面板。 */
function canOpen(step: FlowRunStep): boolean {
  return step.state !== 'pending' && Boolean(step.tool)
}

function onOpen(step: FlowRunStep): void {
  if (!canOpen(step)) return
  emit('openFlowLog', step)
}

function onOpenFailedLog(): void {
  const step = props.report.failedStep
  if (!step || !canOpen(step)) return
  emit('openFlowLog', step)
}

function onAskAssistant(): void {
  const step = props.report.failedStep
  if (!step || !props.assistantReady) return
  emit('askAssistant', step, props.report.failureLines)
}
</script>

<template>
  <article class="run-report" :class="`is-${report.state}`">
    <button
      type="button"
      class="run-report-summary"
      :aria-expanded="expanded ? 'true' : 'false'"
      @click="toggle"
    >
      <i class="run-report-icon" :class="stateIcon" aria-hidden="true"></i>
      <span class="run-report-title">{{ headline }}</span>
      <span v-if="report.state === 'running'" class="run-report-tag is-running">in progress</span>
      <span v-else-if="report.fromDisk" class="run-report-tag">last run on disk</span>
      <span v-else-if="report.external" class="run-report-tag">started elsewhere</span>
      <span v-if="durationLabel" class="run-report-meta">{{ durationLabel }}</span>
      <span class="run-report-meta">{{ report.done }} / {{ report.total }}</span>
      <i
        class="run-report-chevron"
        :class="expanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'"
        aria-hidden="true"
      ></i>
    </button>

    <p v-if="report.slowestStep" class="run-report-slowest">
      <span class="run-report-slowest-label">Slowest</span>
      {{ report.slowestStep.label }}
      <span class="run-report-mono">{{ report.slowestStep.runtime }}</span>
      <span v-if="formatPeakMemory(report.slowestStep.peakMemoryMb)" class="run-report-mono">
        {{ formatPeakMemory(report.slowestStep.peakMemoryMb) }}
      </span>
    </p>

    <ul v-if="report.failureLines.length" class="run-report-failure" aria-hidden="true">
      <li v-for="(line, index) in report.failureLines" :key="`${index}:${line}`">
        {{ line }}
      </li>
    </ul>

    <div v-if="report.state === 'failed' && report.failedStep" class="run-report-actions">
      <button type="button" class="run-report-link" @click="onOpenFailedLog">
        <i class="ri-external-link-line" aria-hidden="true"></i>
        Open {{ report.failedStep.label }} log
      </button>
      <button
        type="button"
        class="run-report-link"
        :class="{ 'is-muted': !assistantReady }"
        :aria-disabled="assistantReady ? undefined : 'true'"
        :title="
          assistantReady
            ? 'Ask the assistant about this failure'
            : 'Assistant is not configured yet'
        "
        @click="onAskAssistant"
      >
        <i class="ri-chat-3-line" aria-hidden="true"></i>
        Ask Assistant
      </button>
    </div>

    <ul v-if="expanded && report.steps.length" class="run-report-steps">
      <li v-for="step in report.steps" :key="step.name">
        <button
          type="button"
          class="run-report-step"
          :class="[`is-${step.state}`, { 'is-inert': !canOpen(step) }]"
          :disabled="!canOpen(step)"
          @click="onOpen(step)"
        >
          <i
            class="run-report-step-icon"
            :class="[
              STEP_ICONS[step.state],
              step.state === 'running' ? 'run-report-spin' : '',
            ]"
            aria-hidden="true"
          ></i>
          <span class="run-report-step-label">{{ step.label }}</span>
          <span class="run-report-step-tool">{{ step.tool }}</span>
          <span class="run-report-mono">{{ stepRuntime(step) }}</span>
          <span class="run-report-mono">{{ formatPeakMemory(step.peakMemoryMb) }}</span>
        </button>
      </li>
    </ul>
  </article>
</template>

<style scoped>
/*
 * 成功的报告卡不给背景：已经跑完的运行不该比 agent 的回答更抢眼。只有失败值得
 * 一片底色，因为那是唯一需要立刻处理的东西。
 */
.run-report {
  min-width: 0;
  border-radius: 8px;
  padding: 8px 10px;
}

.run-report.is-failed {
  background: var(--danger-bg);
}

.run-report.is-running {
  background: var(--info-bg);
}

.run-report-summary {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}

.run-report-icon {
  flex: 0 0 auto;
  font-size: 13px;
  color: var(--success-color);
}

.is-failed .run-report-icon {
  color: var(--danger-color);
}

.is-running .run-report-icon {
  color: var(--info-color);
}

.run-report-tag.is-running {
  background: color-mix(in srgb, var(--info-color) 16%, transparent);
  color: var(--info-color);
}

.run-report-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: var(--text-primary);
}

.run-report-tag {
  flex: 0 0 auto;
  padding: 0 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-secondary) 14%, transparent);
  font-size: 9px;
  opacity: 0.8;
  white-space: nowrap;
}

.run-report-meta {
  flex: 0 0 auto;
  font-size: 10px;
  opacity: 0.7;
  white-space: nowrap;
}

.run-report-meta:last-of-type {
  margin-left: auto;
}

.run-report-chevron {
  flex: 0 0 auto;
  opacity: 0.5;
}

.run-report-slowest {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 3px 0 0 20px;
  font-size: 10px;
  color: var(--text-secondary);
  opacity: 0.7;
}

.run-report-slowest-label {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 9px;
}

.run-report-failure {
  margin: 6px 0 0 20px;
  padding: 0;
  list-style: none;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 10px;
  line-height: 1.45;
  color: var(--danger-color);
}

.run-report-failure li {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.run-report-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 6px 0 0 20px;
}

.run-report-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: none;
  color: var(--accent-color);
  font-size: 11px;
  cursor: pointer;
}

.run-report-link.is-muted {
  color: var(--text-secondary);
  opacity: 0.55;
  cursor: default;
}

.run-report-mono {
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.run-report-steps {
  margin: 6px 0 0;
  padding: 0 0 0 14px;
  list-style: none;
}

.run-report-step {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 3px 6px;
  border: none;
  border-radius: 5px;
  background: none;
  color: var(--text-secondary);
  font-size: 10px;
  text-align: left;
  cursor: pointer;
}

.run-report-step:hover:not(.is-inert) {
  background: color-mix(in srgb, var(--text-secondary) 8%, transparent);
}

.run-report-step.is-inert {
  opacity: 0.45;
  cursor: default;
}

.run-report-step-icon {
  flex: 0 0 auto;
  font-size: 12px;
}

.run-report-step.is-success .run-report-step-icon {
  color: var(--success-color);
}

.run-report-step.is-failed .run-report-step-icon {
  color: var(--danger-color);
}

.run-report-step.is-running .run-report-step-icon {
  color: var(--info-color);
}

.run-report-spin {
  animation: run-report-rotate 0.9s linear infinite;
}

@keyframes run-report-rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.run-report-step-label {
  flex: 0 0 auto;
  min-width: 78px;
  color: var(--text-primary);
}

.run-report-step-tool {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.7;
}
</style>
