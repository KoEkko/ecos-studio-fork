<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import FlowLogCodeViewer from '@/components/FlowLogCodeViewer.vue'
import FlowLogStepList from '@/components/FlowLogStepList.vue'
import { useBottomPanel } from '@/composables/useBottomPanel'
import { useHomeData, type FlowLogSegment } from '@/composables/useHomeData'
import {
  flowLogStepKey,
  formatFlowLogSize,
  reconcileSelectedFlowLogKey,
  toFlowLogListItems,
} from '@/utils/flowLogSelection'

const {
  flowLogSegments,
  flowLogContentByKey,
  flowLogError,
  flowLogLoading,
  currentWorkspaceFlowExecutionActive,
  ensureFlowLogsLoaded,
  ensureFlowLogSegmentContentLoaded,
  expandFlowLogSegment,
} = useHomeData()

const { isOpen, activeTab, requestedFlowLogStepKey, consumeRequestedFlowLogStepKey } =
  useBottomPanel()

const selectedKey = ref<string | null>(null)
const loadingKey = ref<string | null>(null)
const expandingKeys = reactive<Record<string, boolean>>({})
/**
 * Auto-following the live step is only desirable until someone pins a step. Without
 * this the reconcile pass would yank the view back to the running step every time
 * flow.json changes, defeating "open route's log" from outside the panel.
 */
const hasPinnedStep = ref(false)

const isVisible = computed(() => isOpen.value && activeTab.value === 'flow-log')
const items = computed(() => toFlowLogListItems(flowLogSegments.value))

const liveKey = computed(() => {
  const liveSegment = flowLogSegments.value.find((segment) => segment.live)
  return liveSegment ? flowLogStepKey(liveSegment) : null
})

const selectedSegment = computed(() => {
  if (!selectedKey.value) return null
  return (
    flowLogSegments.value.find(
      (segment) => flowLogStepKey(segment) === selectedKey.value,
    ) ?? null
  )
})

const selectedContent = computed(() =>
  selectedKey.value ? (flowLogContentByKey.value[selectedKey.value] ?? '') : '',
)

const isSelectionLoading = computed(
  () => loadingKey.value !== null && loadingKey.value === selectedKey.value,
)

const selectionSignature = computed(() =>
  flowLogSegments.value
    .map((segment) =>
      [flowLogStepKey(segment), segment.state, segment.live ? '1' : '0'].join(':'),
    )
    .join('\u001e'),
)

function onSelectStep(key: string): void {
  selectedKey.value = key
  hasPinnedStep.value = true
}

function onJumpLive(): void {
  if (!liveKey.value) return
  selectedKey.value = liveKey.value
  hasPinnedStep.value = false
}

async function onExpandFullLog(segment: FlowLogSegment): Promise<void> {
  const key = flowLogStepKey(segment)
  if (expandingKeys[key]) return
  expandingKeys[key] = true
  try {
    await expandFlowLogSegment(segment)
  } finally {
    expandingKeys[key] = false
  }
}

function onExpandStep(key: string): void {
  const segment = flowLogSegments.value.find(
    (candidate) => flowLogStepKey(candidate) === key,
  )
  if (segment) void onExpandFullLog(segment)
}

// Flow logs are read from disk, so only pay for them once the tab is actually shown.
watch(
  isVisible,
  (visible) => {
    if (visible) void ensureFlowLogsLoaded()
  },
  { immediate: true },
)

watch(
  [isVisible, requestedFlowLogStepKey],
  () => {
    if (!isVisible.value || !requestedFlowLogStepKey.value) return
    const key = consumeRequestedFlowLogStepKey()
    if (key) onSelectStep(key)
  },
  { immediate: true },
)

watch(
  [selectionSignature, currentWorkspaceFlowExecutionActive],
  ([, isFlowRunning]) => {
    selectedKey.value = reconcileSelectedFlowLogKey(
      flowLogSegments.value,
      selectedKey.value,
      { preferLive: Boolean(isFlowRunning) && !hasPinnedStep.value },
    )
  },
  { immediate: true },
)

watch(
  selectedSegment,
  async (segment) => {
    if (!segment) {
      loadingKey.value = null
      return
    }

    const key = flowLogStepKey(segment)
    const isTailedByWatcher = segment.live && !selectedContent.value
    if (isTailedByWatcher || selectedContent.value || segment.missing) {
      if (loadingKey.value === key) loadingKey.value = null
      return
    }

    loadingKey.value = key
    try {
      await ensureFlowLogSegmentContentLoaded(segment)
    } finally {
      if (loadingKey.value === key) loadingKey.value = null
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="flow-log-panel">
    <div v-if="flowLogError" class="flow-log-panel-notice">
      <i class="ri-error-warning-line"></i>
      <p>{{ flowLogError }}</p>
    </div>

    <template v-else-if="items.length">
      <FlowLogStepList
        :items="items"
        :selected-key="selectedKey"
        :live-key="liveKey"
        :expanding-keys="expandingKeys"
        @select="onSelectStep"
        @expand="onExpandStep"
        @jump-live="onJumpLive"
      />

      <div class="flow-log-panel-viewer">
        <div class="flow-log-panel-viewer-header">
          <template v-if="selectedSegment">
            <span class="flow-log-panel-step">{{ selectedSegment.stepName }}</span>
            <span class="flow-log-panel-tool">{{ selectedSegment.tool }}</span>
            <span
              class="flow-log-panel-state"
              :class="{
                failed: selectedSegment.failed,
                live: selectedSegment.live,
              }"
            >
              {{ selectedSegment.state }}
            </span>
            <span v-if="selectedSegment.totalSize" class="flow-log-panel-size">
              {{ formatFlowLogSize(selectedSegment.totalSize) }}
            </span>
            <span
              v-if="flowLogLoading || isSelectionLoading"
              class="flow-log-panel-loading"
            >
              <i class="ri-loader-4-line flow-log-panel-spin"></i>
              {{ flowLogLoading ? 'Updating…' : 'Loading log…' }}
            </span>
          </template>
          <span v-else class="flow-log-panel-tool">
            Select a step to inspect its output.
          </span>

          <div class="flow-log-panel-actions">
            <button
              v-if="liveKey && liveKey !== selectedKey"
              type="button"
              class="flow-log-panel-btn"
              @click="onJumpLive"
            >
              <i class="ri-skip-right-line"></i>
              <span>Jump to live</span>
            </button>
            <button
              v-if="selectedSegment?.truncated"
              type="button"
              class="flow-log-panel-btn"
              :disabled="expandingKeys[selectedKey || '']"
              :title="`Load full log (${formatFlowLogSize(selectedSegment.totalSize)})`"
              @click="onExpandFullLog(selectedSegment)"
            >
              <i
                :class="
                  expandingKeys[selectedKey || '']
                    ? 'ri-loader-4-line flow-log-panel-spin'
                    : 'ri-expand-up-down-line'
                "
              ></i>
              <span>{{
                expandingKeys[selectedKey || ''] ? 'Loading full log…' : 'Show full log'
              }}</span>
            </button>
          </div>
        </div>

        <div class="flow-log-panel-viewer-shell">
          <FlowLogCodeViewer
            v-if="selectedSegment"
            :key="selectedKey ?? 'no-selection'"
            :content="selectedContent"
            :live="Boolean(selectedSegment.live)"
            :missing="selectedSegment.missing"
            :loading="isSelectionLoading"
          />
          <div v-else class="flow-log-panel-notice">
            <i class="ri-terminal-line"></i>
            <p>No step selected</p>
            <span>Pick a step on the left to inspect its log.</span>
          </div>
        </div>
      </div>
    </template>

    <div v-else-if="flowLogLoading" class="flow-log-panel-notice">
      <i class="ri-loader-4-line flow-log-panel-spin"></i>
      <p>Loading flow step logs…</p>
      <span>Reading flow.json and log files from the workspace.</span>
    </div>

    <div v-else class="flow-log-panel-notice">
      <i class="ri-terminal-line"></i>
      <p>No flow step log yet</p>
      <span
        >Unstarted steps are hidden. Logs show up once a step begins or finishes.</span
      >
    </div>
  </div>
</template>

<style scoped>
.flow-log-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  background: var(--bg-primary);
}

.flow-log-panel-viewer {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.flow-log-panel-viewer-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.flow-log-panel-step {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
}

.flow-log-panel-tool,
.flow-log-panel-size {
  font-size: 10px;
  color: var(--text-secondary);
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  white-space: nowrap;
}

.flow-log-panel-state {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  white-space: nowrap;
}

.flow-log-panel-state.failed {
  color: var(--danger-color);
}

.flow-log-panel-state.live {
  color: var(--accent-color);
}

.flow-log-panel-loading {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.flow-log-panel-actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.flow-log-panel-btn {
  height: 22px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.flow-log-panel-btn:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--accent-color);
}

.flow-log-panel-btn:disabled {
  cursor: progress;
  opacity: 0.7;
}

.flow-log-panel-viewer-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.flow-log-panel-viewer-shell > * {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.flow-log-panel-notice {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 16px;
  text-align: center;
  color: var(--text-secondary);
}

.flow-log-panel-notice i {
  font-size: 22px;
  opacity: 0.6;
}

.flow-log-panel-notice p {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.flow-log-panel-notice span {
  font-size: 11px;
  max-width: 380px;
}

.flow-log-panel-spin {
  animation: flow-log-panel-spin 0.9s linear infinite;
}

@keyframes flow-log-panel-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
