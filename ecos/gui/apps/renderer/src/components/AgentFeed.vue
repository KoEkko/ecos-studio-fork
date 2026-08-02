<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AgentMessage from '@/components/AgentMessage.vue'
import FlowRunLiveBlock from '@/components/FlowRunLiveBlock.vue'
import FlowRunReportCard from '@/components/FlowRunReportCard.vue'
import { shouldStickToBottom } from '@/composables/agentAutoScroll'
import { mergeAgentFeed } from '@/composables/agentFeed'
import {
  isAgentTurnPending,
  type AgentTimelineEntry,
} from '@/composables/agentTimeline'
import {
  flowRunReportView,
  flowRunSnapshotReportView,
  type FlowRunSnapshot,
} from '@/composables/flowRunReport'
import type { FlowRunRecord, FlowRunStep } from '@/composables/flowRunStore'

const props = withDefaults(
  defineProps<{
    entries: AgentTimelineEntry[]
    /** 省略即只渲染对话，step 页的聊天面板就是这么用的。 */
    runs?: FlowRunRecord[]
    /** 进行中的 run：sticky 钉在 feed 顶部，不进 merge 列表。 */
    activeRun?: FlowRunRecord | null
    /** activeRun 当前步骤的 live log 正文。 */
    activeRunLogText?: string
    snapshot?: FlowRunSnapshot | null
    assistantReady?: boolean
    /** 设为 false 让外层容器接管滚动，例如混排的消息列表。 */
    scrollable?: boolean
    /** 外层界面已经解释过自己时，隐藏空状态。 */
    hideEmpty?: boolean
    emptyHint?: string
  }>(),
  {
    runs: () => [],
    activeRun: null,
    activeRunLogText: '',
    snapshot: null,
    assistantReady: false,
    scrollable: true,
    hideEmpty: false,
  },
)

const emit = defineEmits<{
  openFlowLog: [step: FlowRunStep]
  askAssistant: [step: FlowRunStep, lines: string[]]
  retry: []
}>()

const scrollerRef = ref<HTMLElement>()
const stuckToBottom = ref(true)
const unreadCount = ref(0)

const items = computed(() => mergeAgentFeed(props.entries, props.runs, props.snapshot))

// 流式输出期间关掉 live region，否则屏幕阅读器会逐 token 播报。
const liveMode = computed(() => (isAgentTurnPending(props.entries) ? 'off' : 'polite'))

function scrollToBottom(): void {
  const scroller = scrollerRef.value
  if (!scroller) return
  scroller.scrollTop = scroller.scrollHeight
  stuckToBottom.value = true
  unreadCount.value = 0
}

/** StatusBar 等入口：把 LiveBlock 滚进视野（feed 顶）。 */
function scrollToLiveBlock(): void {
  const scroller = scrollerRef.value
  if (!scroller) return
  scroller.scrollTop = 0
}

function onScroll(): void {
  const scroller = scrollerRef.value
  if (!scroller) return
  stuckToBottom.value = shouldStickToBottom(
    scroller.scrollTop,
    scroller.clientHeight,
    scroller.scrollHeight,
  )
  if (stuckToBottom.value) unreadCount.value = 0
}

watch(
  () => items.value.length,
  async (length, previousLength) => {
    if (!props.scrollable) return
    await nextTick()
    // 用户上翻看历史时不要把他拽回底部，只记一个未读数。
    if (stuckToBottom.value) scrollToBottom()
    else if (length > previousLength) unreadCount.value += length - previousLength
  },
)

// 流式回复会持续改写最后一条，条目数不变也要跟随。
watch(
  () => props.entries,
  async () => {
    if (!props.scrollable || !stuckToBottom.value) return
    await nextTick()
    scrollToBottom()
  },
  { deep: true },
)

defineExpose({ scrollToBottom, scrollToLiveBlock })
</script>

<template>
  <div class="agent-feed-shell" :class="{ 'is-static': !scrollable }">
    <div
      ref="scrollerRef"
      class="agent-feed"
      role="log"
      :aria-live="liveMode"
      aria-relevant="additions"
      @scroll="onScroll"
    >
      <FlowRunLiveBlock
        v-if="activeRun"
        class="agent-feed-live"
        :run="activeRun"
        :log-text="activeRunLogText"
        :assistant-ready="assistantReady"
        @open-flow-log="emit('openFlowLog', $event)"
        @ask-assistant="(step, lines) => emit('askAssistant', step, lines)"
      />

      <p v-if="!items.length && !activeRun && !hideEmpty" class="agent-feed-empty">
        {{
          emptyHint ??
          'No runs yet. Run Flow and every step lands here with its timing and log.'
        }}
      </p>

      <template v-for="item in items" :key="item.id">
        <AgentMessage
          v-if="item.kind === 'message'"
          :entry="item.entry"
          @retry="emit('retry')"
        />

        <FlowRunReportCard
          v-else-if="item.kind === 'run'"
          :report="flowRunReportView(item.run)"
          :assistant-ready="assistantReady"
          @open-flow-log="emit('openFlowLog', $event)"
          @ask-assistant="(step, lines) => emit('askAssistant', step, lines)"
        />

        <FlowRunReportCard
          v-else
          :report="flowRunSnapshotReportView(item.snapshot)"
          :assistant-ready="assistantReady"
          @open-flow-log="emit('openFlowLog', $event)"
          @ask-assistant="(step, lines) => emit('askAssistant', step, lines)"
        />
      </template>
    </div>

    <button
      v-if="scrollable && !stuckToBottom"
      type="button"
      class="agent-feed-jump"
      @click="scrollToBottom"
    >
      <i class="ri-arrow-down-line" aria-hidden="true"></i>
      <span v-if="unreadCount">{{ unreadCount }} new</span>
      <span v-else>Jump to latest</span>
    </button>
  </div>
</template>

<style scoped>
.agent-feed-shell {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}

.agent-feed-shell.is-static {
  flex: 0 0 auto;
}

.agent-feed {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 14px;
  overflow-y: auto;
}

/*
 * Sticky so a multi-hour RTL2GDS run stays in view while the reader scrolls
 * history — Cursor's tool blocks don't need this because they finish in seconds.
 */
.agent-feed-live {
  position: sticky;
  top: 0;
  z-index: 1;
  flex: 0 0 auto;
}

.is-static .agent-feed {
  flex: 0 0 auto;
  overflow: visible;
  padding: 0;
}

.agent-feed-empty {
  margin: auto;
  max-width: 280px;
  text-align: center;
  font-size: 11px;
  line-height: 1.55;
  color: var(--text-secondary);
  opacity: 0.75;
}

.agent-feed-jump {
  position: absolute;
  right: 14px;
  bottom: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 10px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.24);
}

.agent-feed-jump:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}
</style>
