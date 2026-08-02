<script setup lang="ts">
import ChecklistTable from '@/components/ChecklistTable.vue'
import { useSharedChecklistItems } from '@/composables/useHomeData'

const items = useSharedChecklistItems()
</script>

<template>
  <div class="checklist-details-panel">
    <ChecklistTable
      :items="items"
      empty-title="No checklist items"
      empty-hint="After running the flow, the checklist will be displayed."
    />
  </div>
</template>

<style scoped>
.checklist-details-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
}

.checklist-details-panel > * {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
</style>
