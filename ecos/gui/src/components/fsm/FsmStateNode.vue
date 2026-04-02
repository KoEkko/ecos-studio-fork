<template>
  <div
    class="fsm-state relative flex h-full w-full flex-col items-center justify-center rounded-full border-2 font-mono shadow-md"
    :class="wrapperClass">
    <Handle id="l" class="!h-2 !w-2 !border-current !bg-[#0a0e14]" type="target" :position="Position.Left" />
    <Handle id="r" class="!h-2 !w-2 !border-current !bg-[#0a0e14]" type="source" :position="Position.Right" />
    <Handle id="t" class="!h-2 !w-2 !border-current !bg-[#0a0e14]" type="target" :position="Position.Top" />
    <Handle id="b" class="!h-2 !w-2 !border-current !bg-[#0a0e14]" type="source" :position="Position.Bottom" />
    <span class="px-1 text-center text-[10px] font-bold leading-tight text-white">{{ data.name }}</span>
    <span class="mt-0.5 text-[8px] leading-none text-slate-300/90">{{ data.encoding }}</span>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@vue-flow/core'
import { computed } from 'vue'
import type { FsmStateStatus } from './fsmAxiWriteCtrlMock'

const props = defineProps<NodeProps<{ name: string; encoding: string; status: FsmStateStatus }>>()

const wrapperClass = computed(() => {
  switch (props.data.status) {
    case 'current':
      return 'border-emerald-400 bg-emerald-400/95 ring-2 ring-dashed ring-white/90 ring-offset-2 ring-offset-[#05080e]'
    case 'visited':
      return 'border-sky-500 bg-sky-600/95'
    case 'error':
      return 'border-rose-600 bg-rose-950/95'
    default:
      return 'border-slate-600 bg-slate-800/70'
  }
})
</script>
