<!-- ecos/gui/src/components/StatusBar.vue -->
<template>
  <div class="status-bar">
    <span class="status-text">
      ECOS Studio{{ guiVersion ? ` v${guiVersion}` : '' }}
    </span>

    <button
      v-if="liveHint"
      type="button"
      class="status-live-run"
      :class="{ 'is-failed': liveHint.failed }"
      :title="liveHint.title"
      @click="onLiveRunClick"
    >
      <i
        :class="liveHint.failed ? 'ri-close-circle-fill' : 'ri-loader-4-line status-live-spin'"
        aria-hidden="true"
      ></i>
      <span>{{ liveHint.label }}</span>
    </button>

    <button
      v-for="entry in PANEL_ENTRIES"
      :key="entry.tab"
      class="status-panel-toggle"
      :class="{ 'status-panel-toggle--active': isPanelTabActive(entry.tab) }"
      type="button"
      :title="isPanelTabActive(entry.tab) ? `Hide ${entry.label}` : `Show ${entry.label}`"
      :aria-pressed="isPanelTabActive(entry.tab)"
      @click="toggleBottomPanelTab(entry.tab)"
    >
      <i :class="entry.icon" aria-hidden="true"></i>
      <span>{{ entry.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { requestAssistantFocus } from '@/composables/useAssistantFocus'
import { deckFocusStep, flowRunElapsedMs } from '@/composables/flowRunReport'
import { useFlowRunStore } from '@/composables/flowRunStore'
import { useVersion } from '@/composables/useVersion'
import { useBottomPanel, type BottomPanelTab } from '@/composables/useBottomPanel'
import { formatElapsedMs } from '@/utils/duration'

const PANEL_ENTRIES: Array<{ tab: BottomPanelTab; label: string; icon: string }> = [
  { tab: 'flow-log', label: 'Flow Log', icon: 'ri-file-list-3-line' },
  { tab: 'terminal', label: 'Terminal', icon: 'ri-terminal-box-line' },
]

const { versions } = useVersion()
const guiVersion = computed(() => versions.value?.gui ?? '')

const { isOpen, activeTab, toggleBottomPanelTab } = useBottomPanel()
const { activeRun } = useFlowRunStore()
const route = useRoute()
const router = useRouter()

const now = ref(Date.now())
const ticker = setInterval(() => {
  now.value = Date.now()
}, 1000)
onUnmounted(() => clearInterval(ticker))

const liveHint = computed(() => {
  const run = activeRun.value
  if (!run) return null
  const focus = deckFocusStep(run.steps)
  const duration = formatElapsedMs(flowRunElapsedMs(run, now.value))
  const failed = focus.mode === 'failed'
  const stepLabel = focus.step?.label

  if (failed && stepLabel) {
    return {
      failed: true,
      label: `${stepLabel} failed · ${duration}`,
      title: 'Show the run in Assistant',
    }
  }

  return {
    failed: false,
    label: `${stepLabel ?? 'Starting'} · ${duration}`,
    title: 'Show the run in Assistant',
  }
})

function isPanelTabActive(tab: BottomPanelTab): boolean {
  return isOpen.value && activeTab.value === tab
}

async function onLiveRunClick(): Promise<void> {
  if (!route.path.endsWith('/home') && !route.path.endsWith('/Home')) {
    await router.push({ path: '/workspace/home', query: route.query })
  }
  requestAssistantFocus()
}
</script>

<style scoped>
.status-bar {
  height: var(--status-bar-height, 24px);
  min-height: var(--status-bar-height, 24px);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  user-select: none;
}

.status-text {
  font-size: 11px;
  color: var(--text-secondary);
}

.status-live-run {
  margin-left: auto;
  height: 20px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 7px;
  border: none;
  border-radius: 4px;
  color: var(--text-secondary);
  background: transparent;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.status-live-run:hover {
  color: var(--accent-color);
  background: var(--hover-bg);
}

.status-live-run.is-failed {
  color: var(--danger-color);
}

.status-live-run.is-failed:hover {
  color: var(--danger-color);
}

.status-live-spin {
  animation: status-live-rotate 0.9s linear infinite;
}

@keyframes status-live-rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.status-panel-toggle {
  height: 20px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 7px;
  border: none;
  border-radius: 4px;
  color: var(--text-secondary);
  background: transparent;
  font-size: 11px;
  cursor: pointer;
}

.status-panel-toggle:first-of-type {
  margin-left: 0;
}

.status-bar:not(:has(.status-live-run)) .status-panel-toggle:first-of-type {
  margin-left: auto;
}

.status-panel-toggle:hover {
  color: var(--text-primary);
  background: var(--hover-bg);
}

.status-panel-toggle--active {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-color) 18%, transparent);
}

.status-panel-toggle i {
  font-size: 13px;
}
</style>
