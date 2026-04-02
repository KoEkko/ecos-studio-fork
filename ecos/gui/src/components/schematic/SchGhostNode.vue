<template>
  <div class="h-1 w-1 opacity-0">
    <Handle id="in-l" class="!h-1 !w-1 !border-0 !bg-transparent" type="target" :position="Position.Left" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@vue-flow/core'

defineProps<NodeProps<Record<string, never>>>()
</script>
