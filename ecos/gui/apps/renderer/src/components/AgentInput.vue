<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  filterSlashSuggestions,
  type SlashSuggestion,
} from '@/utils/agentSlashCommands'

const props = defineProps<{
  busy?: boolean
  disabled?: boolean
  placeholder?: string
  /** Shown above the box, e.g. why the assistant is unavailable. */
  notice?: string
}>()

const emit = defineEmits<{
  submit: [text: string]
  interrupt: []
}>()

const MAX_TEXTAREA_HEIGHT_PX = 160

const text = ref('')
const textareaRef = ref<HTMLTextAreaElement>()
const selectedSuggestion = ref(0)

const canSubmit = computed(
  () => !props.disabled && !props.busy && text.value.trim().length > 0,
)

const suggestions = computed(() => filterSlashSuggestions(text.value))
const showSuggestions = computed(() => suggestions.value.length > 0)

function resize(): void {
  const textarea = textareaRef.value
  if (!textarea) return
  textarea.style.height = 'auto'
  textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`
}

function submit(): void {
  if (!canSubmit.value) return
  emit('submit', text.value)
  text.value = ''
  selectedSuggestion.value = 0
  void nextTick(resize)
}

function applySuggestion(item: SlashSuggestion): void {
  // `<step>` 是占位符，落进输入框时改成尾随空格，让用户接着填。
  text.value = item.command.includes('<')
    ? `${item.command.split('<')[0]}`
    : `${item.command} `
  selectedSuggestion.value = 0
  void nextTick(() => {
    resize()
    textareaRef.value?.focus()
  })
}

function onKeydown(event: KeyboardEvent): void {
  if (showSuggestions.value) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      selectedSuggestion.value = (selectedSuggestion.value + 1) % suggestions.value.length
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectedSuggestion.value =
        (selectedSuggestion.value - 1 + suggestions.value.length) %
        suggestions.value.length
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      const item = suggestions.value[selectedSuggestion.value]
      if (item) applySuggestion(item)
      return
    }
  }

  // Enter sends; Shift+Enter keeps the newline, matching every other chat box.
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  if (showSuggestions.value && suggestions.value[selectedSuggestion.value]) {
    // 完整命令（无占位符）直接发送；带占位符的先补全再让用户改。
    const item = suggestions.value[selectedSuggestion.value]
    if (item.command.includes('<')) {
      applySuggestion(item)
      return
    }
  }
  submit()
}

function setDraft(value: string): void {
  text.value = value
  void nextTick(() => {
    resize()
    textareaRef.value?.focus()
  })
}

watch(text, () => {
  resize()
  selectedSuggestion.value = 0
})

defineExpose({ setDraft })
</script>

<template>
  <div class="agent-input">
    <p v-if="notice" class="agent-input-notice">
      <i class="ri-information-line"></i>
      {{ notice }}
    </p>

    <div class="agent-input-box" :class="{ 'is-disabled': disabled }">
      <ul v-if="showSuggestions" class="agent-slash-menu" role="listbox">
        <li
          v-for="(item, index) in suggestions"
          :key="item.command"
          class="agent-slash-item"
          :class="{ 'is-active': index === selectedSuggestion }"
          role="option"
          :aria-selected="index === selectedSuggestion ? 'true' : 'false'"
          @mousedown.prevent="applySuggestion(item)"
        >
          <code>{{ item.command }}</code>
          <span>{{ item.description }}</span>
        </li>
      </ul>

      <textarea
        ref="textareaRef"
        v-model="text"
        class="agent-input-field"
        rows="1"
        :disabled="disabled"
        :placeholder="placeholder ?? 'Ask about this design, or type / for commands…'"
        @keydown="onKeydown"
      ></textarea>

      <button
        v-if="busy"
        type="button"
        class="agent-input-btn agent-input-btn--stop"
        title="Stop the current turn"
        aria-label="Stop the current turn"
        @click="emit('interrupt')"
      >
        <i class="ri-stop-fill"></i>
      </button>
      <button
        v-else
        type="button"
        class="agent-input-btn"
        :disabled="!canSubmit"
        title="Send"
        aria-label="Send"
        @click="submit"
      >
        <i class="ri-arrow-up-line"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.agent-input {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px 12px;
  border-top: 1px solid color-mix(in srgb, var(--border-color) 60%, transparent);
}

.agent-input-notice {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  padding: 6px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-secondary) 7%, transparent);
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-secondary);
}

.agent-input-notice i {
  flex: 0 0 auto;
  margin-top: 1px;
}

.agent-input-box {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 8px 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-primary);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--text-primary) 4%, transparent);
  transition:
    border-color 0.12s ease,
    box-shadow 0.12s ease;
}

.agent-input-box:focus-within {
  border-color: color-mix(in srgb, var(--accent-color) 50%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color) 12%, transparent);
}

.agent-input-box.is-disabled {
  opacity: 0.6;
}

.agent-slash-menu {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 6px);
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  z-index: 2;
}

.agent-slash-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
  color: var(--text-secondary);
}

.agent-slash-item.is-active,
.agent-slash-item:hover {
  background: color-mix(in srgb, var(--text-secondary) 10%, transparent);
  color: var(--text-primary);
}

.agent-slash-item code {
  flex: 0 0 auto;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 11px;
  color: var(--text-primary);
}

.agent-slash-item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-input-field {
  flex: 1;
  min-width: 0;
  max-height: 160px;
  border: none;
  background: none;
  outline: none;
  resize: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.5;
}

.agent-input-field::placeholder {
  color: var(--text-secondary);
  opacity: 0.7;
}

.agent-input-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border: none;
  border-radius: 999px;
  background: var(--accent-color);
  color: var(--accent-text);
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.12s ease;
}

/* Idle send button recedes: with an empty box it is not an available action. */
.agent-input-btn:disabled {
  cursor: default;
  background: color-mix(in srgb, var(--text-secondary) 16%, transparent);
  color: var(--text-secondary);
}

.agent-input-btn--stop {
  background: var(--danger-color);
}
</style>
