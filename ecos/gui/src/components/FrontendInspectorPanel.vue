<template>
  <div class="frontend-inspector-panel flex flex-col h-full w-full min-w-0 max-w-full bg-(--bg-primary) overflow-hidden">
    <div class="h-10 shrink-0 flex items-center gap-2 px-3 border-b border-(--border-color)">
      <button
        type="button"
        @click="activeTab = 'chat'"
        :class="tabClass(activeTab === 'chat')"
        title="AI Chat"
      >
        <i class="ri-chat-3-line text-base"></i>
      </button>
      <button
        type="button"
        @click="activeTab = 'source'"
        :class="tabClass(activeTab === 'source')"
        :disabled="!hasSourceSelection"
        title="Source Preview"
      >
        <i class="ri-file-code-line text-base"></i>
      </button>
    </div>

    <div class="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
      <KeepAlive>
        <AIChatPanel
          v-if="activeTab === 'chat'"
          class="flex-1 min-h-0 h-full min-w-0 w-full max-w-full overflow-hidden"
        />
      </KeepAlive>

      <div v-if="activeTab === 'source'" class="source-panel flex-1 min-h-0 min-w-0 flex flex-col">
        <div class="source-toolbar">
          <div class="source-meta">
            <strong :title="currentSource?.path || ''">{{ sourceTitle }}</strong>
            <span :title="currentSource?.path || ''">{{ currentSource?.path || '' }}</span>
          </div>
          <button
            type="button"
            class="source-reload-btn"
            :disabled="!currentSource?.path || sourceLoading"
            @click="void loadSourceContent()"
          >
            <i :class="sourceLoading ? 'ri-loader-4-line spin' : 'ri-refresh-line'"></i>
          </button>
        </div>

        <div v-if="!currentSource?.path" class="source-empty">
          <i class="ri-file-code-line"></i>
          <span>Select a source artifact from Prepare step</span>
        </div>
        <div v-else-if="sourceError" class="source-error">
          <i class="ri-error-warning-line"></i>
          <span>{{ sourceError }}</span>
        </div>
        <pre v-else class="source-content">{{ sourceLoading ? 'Loading source...' : sourceContent }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { readTextFile } from '@tauri-apps/plugin-fs'
import AIChatPanel from './AIChatPanel.vue'
import { useFrontendSourceViewerStore } from '@/stores/frontendSourceViewerStore'
import { resolveProjectOrExternalFileAccess } from '@/utils/projectFs'
import { useTauri } from '@/composables/useTauri'

const SOURCE_PREVIEW_CHAR_LIMIT = 400000

const { isInTauri } = useTauri()
const sourceStore = useFrontendSourceViewerStore()
const { currentSource, openRequestedAt } = storeToRefs(sourceStore)

const activeTab = ref<'chat' | 'source'>('chat')
const sourceLoading = ref(false)
const sourceError = ref('')
const sourceContent = ref('')
let sourceLoadToken = 0

const hasSourceSelection = computed(() => !!currentSource.value?.path)
const sourceTitle = computed(() => currentSource.value?.label || fileName(currentSource.value?.path || '') || 'Source')

watch(
  () => openRequestedAt.value,
  () => {
    if (!currentSource.value?.path) return
    activeTab.value = 'source'
    void loadSourceContent()
  },
)

async function loadSourceContent(): Promise<void> {
  const path = currentSource.value?.path || ''
  if (!path) return
  const token = ++sourceLoadToken
  sourceLoading.value = true
  sourceError.value = ''
  sourceContent.value = ''

  try {
    if (!isInTauri) {
      sourceError.value = 'Source preview is available in ECOS Studio desktop.'
      return
    }
    const resolvedPath = await resolveProjectOrExternalFileAccess(path)
    if (!resolvedPath) {
      sourceError.value = `No file-system access to ${path}`
      return
    }
    const text = await readTextFile(resolvedPath)
    if (token !== sourceLoadToken) return
    if (text.length <= SOURCE_PREVIEW_CHAR_LIMIT) {
      sourceContent.value = text
    } else {
      sourceContent.value = `${text.slice(0, SOURCE_PREVIEW_CHAR_LIMIT)}\n\n... (truncated, ${text.length} chars total)`
    }
  } catch (err) {
    if (token !== sourceLoadToken) return
    sourceError.value = err instanceof Error ? err.message : String(err)
  } finally {
    if (token === sourceLoadToken) {
      sourceLoading.value = false
    }
  }
}

function fileName(path: string): string {
  return path.split('/').filter(Boolean).pop() || path
}

function tabClass(active: boolean) {
  return [
    'h-8 w-9 rounded flex items-center justify-center transition-all cursor-pointer border',
    active
      ? 'text-(--accent-color) bg-(--accent-color)/20 border-(--accent-color)/50'
      : 'text-(--text-secondary) border-transparent hover:bg-(--bg-hover)',
  ]
}
</script>

<style scoped>
.frontend-inspector-panel {
  box-sizing: border-box;
}

.source-panel {
  background: var(--bg-primary);
}

.source-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.source-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.source-meta strong {
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-meta span {
  color: var(--text-secondary);
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-reload-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
}

.source-reload-btn:hover:not(:disabled) {
  color: var(--accent-color);
  border-color: var(--accent-color);
}

.source-reload-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.source-content {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 10px;
  overflow: auto;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre;
}

.source-empty,
.source-error {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 11px;
}

.source-error {
  color: #ef4444;
}

.source-empty i,
.source-error i {
  font-size: 20px;
  opacity: 0.75;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
