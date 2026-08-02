<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import type { AgentTimelineEntry } from '@/composables/agentTimeline'
import { sanitizeHtml } from '@/utils/sanitizeHtml'

const props = defineProps<{ entry: AgentTimelineEntry }>()

const emit = defineEmits<{
  retry: []
}>()

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
})

const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx]?.attrSet('target', '_blank')
  tokens[idx]?.attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

const contentRef = ref<HTMLElement>()

const renderedHtml = computed(() => {
  if (props.entry.kind !== 'assistant' && props.entry.kind !== 'user') return ''
  return sanitizeHtml(md.render(props.entry.text || ''))
})

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

async function copyValue(value: string): Promise<void> {
  if (!value || !navigator.clipboard?.writeText) return
  await navigator.clipboard.writeText(value)
  copied.value = true
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = false
  }, 1200)
}

async function onCopy(): Promise<void> {
  await copyValue(props.entry.text)
}

function onRetry(): void {
  if (props.entry.kind !== 'assistant' || props.entry.status !== 'error') return
  // 重试发的是上一条用户话，由父级从 entries 里找；这里只发出信号。
  emit('retry')
}

/**
 * sanitizeHtml 不允许 button，所以代码块复制按钮在渲染后挂到 DOM 上。
 * 每次 HTML 重写都会丢掉旧按钮，watch 负责补回去。
 */
function attachCodeCopyButtons(): void {
  const root = contentRef.value
  if (!root) return
  for (const pre of root.querySelectorAll('pre')) {
    if (pre.parentElement?.classList.contains('agent-code-block')) continue
    const wrap = document.createElement('div')
    wrap.className = 'agent-code-block'
    pre.parentNode?.insertBefore(wrap, pre)
    wrap.appendChild(pre)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'agent-code-copy'
    button.textContent = 'Copy'
    button.addEventListener('click', (event) => {
      event.preventDefault()
      void copyValue(pre.textContent ?? '')
    })
    wrap.appendChild(button)
  }
}

watch(
  renderedHtml,
  async () => {
    await nextTick()
    attachCodeCopyButtons()
  },
  { flush: 'post' },
)
</script>

<template>
  <div v-if="entry.kind === 'user'" class="agent-entry agent-entry--user">
    <div class="agent-bubble-wrap">
      <div ref="contentRef" class="agent-bubble" v-html="renderedHtml"></div>
      <div class="agent-toolbar">
        <button type="button" class="agent-toolbar-btn" title="Copy" @click="onCopy">
          <i :class="copied ? 'ri-check-line' : 'ri-file-copy-line'"></i>
        </button>
      </div>
    </div>
  </div>

  <div
    v-else-if="entry.kind === 'assistant'"
    class="agent-entry agent-entry--assistant"
    :class="{ 'is-error': entry.status === 'error' }"
  >
    <div class="agent-assistant-wrap">
      <div
        v-if="entry.text"
        ref="contentRef"
        class="agent-assistant-text"
        v-html="renderedHtml"
      ></div>
      <p v-else class="agent-assistant-text"></p>
      <span v-if="entry.status === 'streaming'" class="agent-caret"></span>

      <div v-if="entry.status !== 'streaming'" class="agent-toolbar">
        <button type="button" class="agent-toolbar-btn" title="Copy" @click="onCopy">
          <i :class="copied ? 'ri-check-line' : 'ri-file-copy-line'"></i>
        </button>
        <button
          v-if="entry.status === 'error'"
          type="button"
          class="agent-toolbar-btn"
          title="Retry"
          @click="onRetry"
        >
          <i class="ri-refresh-line"></i>
        </button>
      </div>
    </div>
  </div>

  <div v-else class="agent-entry agent-entry--tool">
    <i class="ri-terminal-box-line"></i>
    <span>{{ entry.text }}</span>
  </div>
</template>

<style scoped>
.agent-entry {
  display: flex;
  min-width: 0;
}

.agent-entry--user {
  justify-content: flex-end;
}

.agent-bubble-wrap,
.agent-assistant-wrap {
  position: relative;
  max-width: 88%;
  min-width: 0;
}

.agent-assistant-wrap {
  max-width: 100%;
  width: 100%;
}

.agent-bubble {
  margin: 0;
  padding: 8px 12px;
  border-radius: 14px 14px 4px 14px;
  background: color-mix(in srgb, var(--text-secondary) 10%, transparent);
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.agent-assistant-text {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.agent-entry--assistant.is-error .agent-assistant-text {
  color: var(--danger-color);
}

.agent-bubble :deep(p),
.agent-assistant-text :deep(p) {
  margin: 0 0 0.55em;
}

.agent-bubble :deep(p:last-child),
.agent-assistant-text :deep(p:last-child) {
  margin-bottom: 0;
}

.agent-bubble :deep(pre),
.agent-assistant-text :deep(pre) {
  margin: 0;
  padding: 9px 11px;
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--border-color) 80%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 90%, transparent);
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.45;
}

.agent-bubble :deep(code),
.agent-assistant-text :deep(code) {
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 0.92em;
}

.agent-bubble :deep(pre code),
.agent-assistant-text :deep(pre code) {
  font-size: inherit;
}

.agent-bubble :deep(.agent-code-block),
.agent-assistant-text :deep(.agent-code-block) {
  position: relative;
  margin: 0.45em 0;
}

.agent-bubble :deep(.agent-code-copy),
.agent-assistant-text :deep(.agent-code-copy) {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 2px 6px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 10px;
  cursor: pointer;
  opacity: 0;
}

.agent-bubble :deep(.agent-code-block:hover .agent-code-copy),
.agent-assistant-text :deep(.agent-code-block:hover .agent-code-copy) {
  opacity: 1;
}

.agent-caret {
  display: inline-block;
  width: 6px;
  height: 12px;
  margin-left: 2px;
  vertical-align: text-bottom;
  background: var(--accent-color);
  animation: agent-blink 1s steps(2) infinite;
}

.agent-toolbar {
  display: flex;
  gap: 2px;
  margin-top: 3px;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.agent-bubble-wrap:hover .agent-toolbar,
.agent-assistant-wrap:hover .agent-toolbar,
.agent-toolbar:focus-within {
  opacity: 1;
}

.agent-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 5px;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
}

.agent-toolbar-btn:hover {
  background: color-mix(in srgb, var(--text-secondary) 12%, transparent);
  color: var(--text-primary);
}

.agent-entry--tool {
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--text-secondary) 6%, transparent);
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 10px;
  color: var(--text-secondary);
}

.agent-entry--tool i {
  flex: 0 0 auto;
  font-size: 12px;
  opacity: 0.7;
}

.agent-entry--tool span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes agent-blink {
  0%,
  50% {
    opacity: 1;
  }

  51%,
  100% {
    opacity: 0;
  }
}
</style>
