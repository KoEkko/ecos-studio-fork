<template>
  <div class="frontend-inspector-panel flex flex-col h-full w-full min-w-0 max-w-full bg-(--bg-primary) overflow-hidden">
    <div class="h-10 shrink-0 flex items-center gap-2 px-3 border-b border-(--border-color)">
      <button type="button" :class="tabClass(true)" title="AI Chat">
        <i class="ri-chat-3-line text-base"></i>
      </button>
    </div>

    <div class="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
      <KeepAlive>
        <AIChatPanel class="flex-1 min-h-0 h-full min-w-0 w-full max-w-full overflow-hidden" />
      </KeepAlive>
    </div>
  </div>
</template>

<script setup lang="ts">
import AIChatPanel from './AIChatPanel.vue'

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
