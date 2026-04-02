<template>
  <div
    class="sch-block relative box-border flex h-full w-full flex-col justify-center rounded-sm border border-sky-500/50 bg-[#132337] px-2 py-1.5 font-mono shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
    <Handle id="in-l" class="!h-2 !w-2 !border-sky-500/60 !bg-slate-900" type="target" :position="Position.Left" />
    <Handle id="in-t" class="!h-2 !w-2 !border-sky-500/60 !bg-slate-900" type="target" :position="Position.Top" />
    <Handle id="out-r" class="!h-2 !w-2 !border-sky-500/60 !bg-slate-900" type="source" :position="Position.Right" />
    <Handle id="out-b" class="!h-2 !w-2 !border-sky-500/60 !bg-slate-900" type="source" :position="Position.Bottom" />
    <div class="text-[10px] font-bold uppercase tracking-wide text-sky-200">{{ data.kind }}</div>
    <div class="truncate text-[9px] text-slate-400/95">({{ data.instance }})</div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@vue-flow/core'

defineProps<NodeProps<{ kind: string; instance: string }>>()
</script>
