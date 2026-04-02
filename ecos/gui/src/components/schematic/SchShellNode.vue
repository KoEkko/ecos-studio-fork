<template>
  <div
    class="sch-shell relative box-border rounded-sm border border-dashed border-sky-400/45 bg-[#0a1018] shadow-[inset_0_0_0_1px_rgba(56,189,248,0.08)]"
    :style="{ width: '100%', height: '100%', minWidth: '100%', minHeight: '100%' }">
    <div
      class="pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-center border-b border-slate-700/60 bg-[#0d1520]/90 py-1.5 font-mono text-[11px] font-semibold tracking-tight text-sky-300/95">
      {{ data.title }}
    </div>

    <!-- 左侧端口：自上而下均匀分布（对齐参考图） -->
    <div
      class="pointer-events-none absolute bottom-2 left-0 top-9 flex w-[9rem] flex-col justify-between py-2 pl-1.5 pr-0.5">
      <div
        v-for="(p, i) in data.leftPorts"
        :key="'L' + i"
        class="flex items-center justify-end gap-1 text-[9px] leading-tight">
        <span v-if="p.badge" class="rounded-sm bg-emerald-600 px-1 py-px font-mono text-[8px] font-bold leading-none text-emerald-50 shadow-sm">
          {{ p.badge }}
        </span>
        <span
          :class="portClass(p)"
          class="font-mono tracking-tight">{{ p.name }}</span>
      </div>
    </div>

    <!-- 右侧端口 -->
    <div
      class="pointer-events-none absolute bottom-2 right-0 top-9 flex w-[11rem] flex-col justify-between py-2 pl-0.5 pr-1.5">
      <div
        v-for="(p, i) in data.rightPorts"
        :key="'R' + i"
        class="flex items-center justify-start gap-1 text-[9px] leading-tight">
        <span v-if="p.prefix" class="text-[9px] font-bold text-rose-400">{{ p.prefix }}</span>
        <span
          :class="portClass(p)"
          class="font-mono tracking-tight">{{ p.name }}</span>
        <span v-if="p.badge" class="rounded-sm bg-emerald-600 px-1 py-px font-mono text-[8px] font-bold leading-none text-emerald-50 shadow-sm">
          {{ p.badge }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NodeProps } from '@vue-flow/core'
import type { SchPort } from './schPort'

defineProps<NodeProps<{ title: string; leftPorts: SchPort[]; rightPorts: SchPort[] }>>()

function portClass(p: SchPort) {
  if (p.tone === 'error') return 'text-rose-400'
  if (p.tone === 'muted') return 'text-slate-500'
  if (p.tone === 'violet') return 'text-violet-300'
  return 'text-slate-200'
}
</script>
