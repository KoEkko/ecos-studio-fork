<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import {
  liveBlockLineIsError,
  toFlowRunLiveView,
} from '@/composables/flowRunLiveBlock'
import { flowRunCounts } from '@/composables/flowRunReport'
import type { FlowRunRecord, FlowRunStep, FlowRunStepState } from '@/composables/flowRunStore'
import { formatPeakMemory } from '@/utils/duration'

const props = withDefaults(
  defineProps<{
    run: FlowRunRecord
    /** Current step log body from useHomeData; empty until live watch fills it. */
    logText?: string
    /** Provider ready: Ask Assistant becomes a real action instead of a grey promise. */
    assistantReady?: boolean
  }>(),
  { logText: '', assistantReady: false },
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

// 秒级刷新不值得占 requestAnimationFrame，而且 LiveBlock 常常一挂就是几十分钟。
const now = ref(Date.now())
const ticker = setInterval(() => {
  now.value = Date.now()
}, 1000)
onUnmounted(() => clearInterval(ticker))

const view = computed(() => toFlowRunLiveView(props.run, props.logText, now.value))
const progress = computed(() => flowRunCounts(props.run.steps))

const logExpanded = ref(false)
const trackExpanded = ref(false)

watch(
  () => view.value.mode,
  (mode) => {
    if (mode !== 'running') logExpanded.value = false
    trackExpanded.value = mode === 'failed'
  },
  { immediate: true },
)

const logPanelOpen = computed(() => {
  if (view.value.mode === 'failed') return true
  if (!view.value.canExpand) return false
  return logExpanded.value
})

function toggleLogPanel(): void {
  if (view.value.mode === 'failed') return
  if (!view.value.canExpand) return
  logExpanded.value = !logExpanded.value
}

function toggleTrack(): void {
  trackExpanded.value = !trackExpanded.value
}

function onOpenLog(): void {
  const step = view.value.focusStep
  if (!step?.tool) return
  emit('openFlowLog', step)
}

function onOpenStepLog(step: FlowRunStep): void {
  if (step.state === 'pending' || !step.tool) return
  emit('openFlowLog', step)
}

function onAskAssistant(): void {
  const step = view.value.focusStep
  if (!step || !props.assistantReady || view.value.mode !== 'failed') return
  emit('askAssistant', step, view.value.logLines)
}

function stepRuntime(step: FlowRunStep): string {
  if (step.state === 'pending') return 'not run'
  return step.runtime || ''
}

const trackCurrentLabel = computed(() => {
  const step = view.value.focusStep
  if (step) return step.label
  if (view.value.mode === 'starting') return 'Starting…'
  return ''
})
</script>

<template>
  <section
    class="live-block"
    :class="{
      'is-failed': view.mode === 'failed',
      'is-running': view.mode === 'running',
      'is-starting': view.mode === 'starting',
      'is-log-expanded': logPanelOpen,
      'is-track-expanded': trackExpanded,
    }"
    role="status"
    aria-live="polite"
  >
    <div class="live-block-accent" aria-hidden="true"></div>

    <div class="live-block-body">
      <!-- 监控焦点：当前步 + 计时 + live log -->
      <div class="live-block-focus">
        <div class="live-block-summary">
          <i
            class="live-block-icon"
            :class="
              view.mode === 'failed'
                ? 'ri-close-circle-fill'
                : 'ri-loader-4-line live-block-spin'
            "
            aria-hidden="true"
          ></i>

          <span class="live-block-headline">{{ view.headline }}</span>

          <span v-if="view.tag" class="live-block-tag">{{ view.tag }}</span>

          <span class="live-block-time" aria-hidden="true">{{ view.timeLabel }}</span>
        </div>

        <button
          v-if="view.mode !== 'failed'"
          type="button"
          class="live-block-preview"
          :class="{ 'is-inert': !view.canExpand }"
          :aria-expanded="logPanelOpen ? 'true' : 'false'"
          :disabled="!view.canExpand"
          @click="toggleLogPanel"
        >
          <span class="live-block-chevron" aria-hidden="true">{{
            logPanelOpen ? '▾' : '▸'
          }}</span>
          <span class="live-block-preview-text">{{ view.previewLine }}</span>
        </button>

        <div
          v-if="logPanelOpen || view.mode === 'failed'"
          class="live-block-console-wrap"
          aria-hidden="true"
        >
          <ul v-if="view.logLines.length" class="live-block-console">
            <li
              v-for="(line, index) in view.logLines"
              :key="`${index}:${line}`"
              :class="{
                'is-error': liveBlockLineIsError(line),
                'is-latest': index === view.logLines.length - 1,
              }"
            >
              {{ line }}
            </li>
          </ul>
          <p v-else class="live-block-console-empty">
            {{
              view.mode === 'failed'
                ? 'No error lines captured. Check the full log.'
                : view.previewLine
            }}
          </p>
        </div>

        <div v-if="view.mode === 'running' && logPanelOpen" class="live-block-actions">
          <button
            type="button"
            class="live-block-link"
            :disabled="!view.canOpenLog"
            @click="onOpenLog"
          >
            View full log →
          </button>
        </div>

        <div v-else-if="view.mode === 'failed'" class="live-block-actions">
          <button
            type="button"
            class="live-block-btn"
            :disabled="!view.canOpenLog"
            @click="onOpenLog"
          >
            Open {{ view.focusStep?.label ?? 'step' }} log
          </button>
          <button
            type="button"
            class="live-block-link"
            :class="{ 'is-muted': !assistantReady }"
            :aria-disabled="assistantReady ? undefined : 'true'"
            :title="
              assistantReady
                ? 'Ask the assistant about this failure'
                : 'Assistant is not configured yet'
            "
            @click="onAskAssistant"
          >
            Ask Assistant
          </button>
        </div>
      </div>

      <!-- 进度轨：压缩步骤条，可展开明细，无独立 headline -->
      <div v-if="run.steps.length" class="live-block-track">
        <button
          type="button"
          class="live-block-track-toggle"
          :aria-expanded="trackExpanded ? 'true' : 'false'"
          @click="toggleTrack"
        >
          <div class="live-block-track-bar" aria-hidden="true">
            <span
              v-for="step in run.steps"
              :key="step.name"
              class="live-block-track-seg"
              :class="`is-${step.state}`"
              :title="step.label"
            ></span>
          </div>
          <span v-if="trackCurrentLabel" class="live-block-track-current">{{
            trackCurrentLabel
          }}</span>
          <span class="live-block-track-count"
            >{{ progress.done }} / {{ progress.total }}</span
          >
          <i
            class="live-block-track-chevron"
            :class="trackExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'"
            aria-hidden="true"
          ></i>
        </button>

        <ul v-if="trackExpanded" class="live-block-track-steps">
          <li v-for="step in run.steps" :key="step.name">
            <button
              type="button"
              class="live-block-track-step"
              :class="[`is-${step.state}`, { 'is-inert': step.state === 'pending' || !step.tool }]"
              :disabled="step.state === 'pending' || !step.tool"
              @click="onOpenStepLog(step)"
            >
              <i
                class="live-block-track-step-icon"
                :class="[
                  STEP_ICONS[step.state],
                  step.state === 'running' ? 'live-block-spin' : '',
                ]"
                aria-hidden="true"
              ></i>
              <span class="live-block-track-step-label">{{ step.label }}</span>
              <span class="live-block-track-step-tool">{{ step.tool }}</span>
              <span class="live-block-track-mono">{{ stepRuntime(step) }}</span>
              <span class="live-block-track-mono">{{
                formatPeakMemory(step.peakMemoryMb)
              }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
/*
 * 运行控制台：上方监控焦点（当前步 + 计时 + log），下方进度轨（压缩/可展开）。
 * Sticky 宿主在 AgentFeed — 本组件只负责表面。
 */
.live-block {
  position: relative;
  display: flex;
  gap: 0;
  min-width: 0;
  border-radius: 8px;
  padding: 8px 10px 8px 0;
  background: color-mix(in srgb, var(--text-secondary) 3%, var(--bg-secondary));
}

.live-block.is-running,
.live-block.is-starting {
  background: var(--info-bg);
}

.live-block.is-failed {
  background: var(--danger-bg);
}

.live-block-accent {
  flex: 0 0 2px;
  margin: 0 8px 0 0;
  border-radius: 2px;
  background: color-mix(in srgb, var(--text-secondary) 30%, transparent);
  opacity: 0.35;
}

.is-running .live-block-accent,
.is-starting .live-block-accent {
  background: var(--info-color);
  opacity: 1;
  animation: live-block-breathe 1.8s ease-in-out infinite;
}

.is-failed .live-block-accent {
  background: var(--danger-color);
  opacity: 1;
  animation: none;
}

.live-block-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.live-block-focus {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.live-block-summary {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.live-block-icon {
  flex: 0 0 auto;
  font-size: 13px;
  line-height: 1;
  color: var(--info-color);
}

.is-failed .live-block-icon {
  color: var(--danger-color);
}

.live-block-headline {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.live-block-tag {
  flex: 0 0 auto;
  padding: 0 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-secondary) 14%, transparent);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  opacity: 0.8;
  white-space: nowrap;
}

.live-block-time {
  flex: 0 0 auto;
  margin-left: auto;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
  white-space: nowrap;
}

.is-failed .live-block-time {
  color: var(--danger-color);
}

.live-block-preview {
  display: flex;
  align-items: baseline;
  gap: 6px;
  width: 100%;
  padding: 0 0 0 20px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  color: var(--text-secondary);
}

.live-block-preview.is-inert {
  cursor: default;
}

.live-block-chevron {
  flex: 0 0 auto;
  font-size: 10px;
  opacity: 0.55;
  user-select: none;
}

.live-block-preview-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.45;
}

.live-block-console-wrap {
  margin-left: 20px;
  border: 1px solid color-mix(in srgb, var(--border-color) 80%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--text-secondary) 4%, var(--bg-primary));
  padding: 6px 8px;
  overflow: hidden;
}

.is-failed .live-block-console-wrap {
  border-left: 2px solid var(--danger-color);
}

.live-block-console {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.live-block-console li {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-secondary);
  opacity: 0.45;
}

.live-block-console li.is-latest {
  opacity: 1;
  color: var(--text-primary);
  animation: live-block-line-in 180ms ease-out;
}

.live-block-console li.is-error {
  color: var(--danger-color);
  opacity: 1;
}

.live-block-console-empty {
  margin: 0;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.55;
}

.live-block-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding-left: 20px;
}

.live-block-link,
.live-block-btn {
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

.live-block-btn {
  font-weight: 500;
}

.live-block-link:hover:not(:disabled):not(.is-muted),
.live-block-btn:hover:not(:disabled) {
  text-decoration: underline;
}

.live-block-link:disabled,
.live-block-btn:disabled,
.live-block-link.is-muted {
  color: var(--text-secondary);
  opacity: 0.45;
  cursor: default;
  text-decoration: none;
}

/* ── 进度轨 ── */

.live-block-track {
  padding-top: 6px;
  border-top: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);
}

.live-block-track-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 10px;
  text-align: left;
  cursor: pointer;
}

.live-block-track-bar {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}

.live-block-track-bar::-webkit-scrollbar {
  display: none;
}

.live-block-track-seg {
  flex: 1 0 6px;
  max-width: 14px;
  height: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-secondary) 22%, transparent);
}

.live-block-track-seg.is-success {
  background: var(--success-color);
}

.live-block-track-seg.is-failed {
  background: var(--danger-color);
}

.live-block-track-seg.is-running {
  background: var(--info-color);
  animation: live-block-seg-pulse 1.1s ease-in-out infinite;
}

.live-block-track-current {
  flex: 0 0 auto;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
}

.live-block-track-count {
  flex: 0 0 auto;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  opacity: 0.75;
}

.live-block-track-chevron {
  flex: 0 0 auto;
  font-size: 12px;
  opacity: 0.5;
}

.live-block-track-steps {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.live-block-track-step {
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

.live-block-track-step:hover:not(.is-inert) {
  background: color-mix(in srgb, var(--text-secondary) 8%, transparent);
}

.live-block-track-step.is-inert {
  opacity: 0.45;
  cursor: default;
}

.live-block-track-step-icon {
  flex: 0 0 auto;
  font-size: 12px;
}

.live-block-track-step.is-success .live-block-track-step-icon {
  color: var(--success-color);
}

.live-block-track-step.is-failed .live-block-track-step-icon {
  color: var(--danger-color);
}

.live-block-track-step.is-running .live-block-track-step-icon {
  color: var(--info-color);
}

.live-block-track-step-label {
  flex: 0 0 auto;
  min-width: 78px;
  color: var(--text-primary);
}

.live-block-track-step-tool {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.7;
}

.live-block-track-mono {
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.live-block-spin {
  animation: live-block-rotate 0.9s linear infinite;
}

@keyframes live-block-rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes live-block-breathe {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }
}

@keyframes live-block-seg-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.35;
  }
}

@keyframes live-block-line-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
