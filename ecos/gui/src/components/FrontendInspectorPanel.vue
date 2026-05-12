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
        title="Source Editor"
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

      <FrontendSourceEditor
        v-if="activeTab === 'source'"
        class="flex-1 min-h-0 min-w-0"
        :source="currentSource"
        :open-requested-at="openRequestedAt"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AIChatPanel from './AIChatPanel.vue'
import FrontendSourceEditor from './FrontendSourceEditor.vue'
import { useFrontendSourceViewerStore } from '@/stores/frontendSourceViewerStore'

const sourceStore = useFrontendSourceViewerStore()
const { currentSource, focusRequestedAt, openRequestedAt } = storeToRefs(sourceStore)

const activeTab = ref<'chat' | 'source'>('chat')

const hasSourceSelection = computed(() => !!currentSource.value?.path)

watch(
  () => focusRequestedAt.value,
  () => {
    if (!currentSource.value?.path) return
    activeTab.value = 'source'
  },
)

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
</style>
