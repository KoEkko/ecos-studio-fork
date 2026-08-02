<template>
  <div class="flex h-full min-w-0 flex-col">
    <!-- 消息列表：工作区报告 + Agent 对话共用一个滚动区 -->
    <div
      ref="scrollContainerRef"
      class="custom-scrollbar min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4"
    >
      <div
        v-if="isEmpty"
        class="flex h-full flex-col items-center justify-center py-12 text-center"
      >
        <div
          class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--bg-secondary)"
        >
          <i class="ri-robot-2-line text-4xl text-(--text-secondary) opacity-50"></i>
        </div>
        <p class="text-[13px] leading-relaxed text-(--text-secondary)">
          No messages, please enter instructions to start chatting.
        </p>
      </div>

      <div
        v-else
        class="messages-container w-full max-w-full min-w-0 space-y-4 overflow-hidden py-4"
      >
        <MessageItem
          v-for="msg in messages"
          :key="msg.id"
          :message="msg"
          @img-load="onImageLoad"
          @close="messageStore.removeMessage(msg.id)"
          class="message-item w-full max-w-full min-w-0"
        />

        <!-- runs 不传：flow 的运行报告属于 Home 的 Assistant，这里只有对话。 -->
        <AgentFeed
          v-if="agentEntries.length"
          :entries="agentEntries"
          :scrollable="false"
          hide-empty
        />
      </div>
    </div>

    <AgentInput
      :busy="isBusy"
      :disabled="!isAvailable"
      :notice="notice"
      @submit="send"
      @interrupt="interrupt"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AgentFeed from './AgentFeed.vue'
import AgentInput from './AgentInput.vue'
import MessageItem from './MessageItem.vue'
import { useMessageStore } from '../stores/messageStore'
import { AGENT_UNAVAILABLE_MESSAGE, useAgent } from '@/composables/useAgent'

const messageStore = useMessageStore()
const { messages } = storeToRefs(messageStore)
const {
  entries: agentEntries,
  statusMessage,
  isAvailable,
  isBusy,
  isReady,
  send,
  interrupt,
  refreshStatus,
} = useAgent()

const scrollContainerRef = ref<HTMLDivElement | null>(null)

const isEmpty = computed(
  () => messages.value.length === 0 && agentEntries.value.length === 0,
)

const notice = computed(() => {
  if (!isAvailable.value) return AGENT_UNAVAILABLE_MESSAGE
  if (!isReady.value && statusMessage.value) return statusMessage.value
  return ''
})

// Near-bottom 阈值（像素）
const NEAR_BOTTOM_THRESHOLD = 32

function isNearBottom(): boolean {
  const el = scrollContainerRef.value
  if (!el) return true
  return el.scrollHeight - (el.scrollTop + el.clientHeight) <= NEAR_BOTTOM_THRESHOLD
}

function scrollToBottom(smooth = true): void {
  const el = scrollContainerRef.value
  if (!el) return

  if (smooth) {
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  } else {
    el.scrollTop = el.scrollHeight
  }
}

/** 从 Inspector 切回 Chat 时：KeepAlive 激活，强制滚到底（避免停在中间位置） */
onActivated(() => {
  void nextTick(() => {
    requestAnimationFrame(() => {
      scrollToBottom(false)
    })
  })
})

onMounted(() => {
  void refreshStatus()
})

/** 图片加载后高度变化，需要重新滚动到底部 */
function onImageLoad(): void {
  requestAnimationFrame(() => {
    if (isNearBottom()) scrollToBottom()
  })
}

// 新消息到来时滚到底部；删除消息时保持用户当前浏览位置
watch(
  () => messages.value.length,
  (newLength, oldLength) => {
    if (newLength > oldLength) void nextTick(() => scrollToBottom())
  },
)

// Agent 的流式输出会持续改写最后一条，长度不变也要跟随，除非用户已向上翻阅
watch(
  agentEntries,
  () => {
    if (!isNearBottom()) return
    void nextTick(() => scrollToBottom(false))
  },
  { deep: true },
)
</script>

<style scoped>
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* 消息容器约束 - 防止内容撑开父容器 */
.messages-container {
  contain: layout style;
  box-sizing: border-box;
}

.message-item {
  contain: layout style paint;
  box-sizing: border-box;
}
</style>
