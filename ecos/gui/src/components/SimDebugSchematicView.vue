<template>
  <div class="sd-sch-root relative h-full min-h-[120px] w-full min-w-0 bg-[#05080e]">
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :elements-selectable="true"
      :fit-view-on-init="true"
      :min-zoom="0.2"
      :max-zoom="2.2"
      :default-edge-options="{ type: 'smoothstep', markerEnd: undefined }"
      class="sd-sch-flow"
      @node-click="onNodeClick"
      @pane-click="closeContextMenu"
      @node-context-menu="onNodeContextMenu"
    >
      <Background pattern-color="rgba(51,65,85,0.28)" :gap="24" :size="1" />
    </VueFlow>

    <Teleport to="body">
      <div
        v-if="ctxMenu"
        class="fixed z-[100] min-w-[12.5rem] rounded-md border border-sky-500/40 bg-[#0a1018]/98 py-1 text-[11px] shadow-[0_10px_40px_rgba(0,0,0,0.65)] backdrop-blur-sm"
        :style="{ left: `${ctxMenu.x}px`, top: `${ctxMenu.y}px` }"
        role="menu"
        @click.stop
      >
        <div class="px-2.5 py-1.5 text-[10px] text-slate-400 border-b border-slate-700/80">
          {{ ctxMenu.nodeLabel }}
        </div>
        <button
          v-for="item in ctxItems"
          :key="item.id"
          type="button"
          disabled
          class="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-slate-400 cursor-not-allowed opacity-80"
          :title="item.hint"
        >
          <span class="text-sky-400/90" aria-hidden="true">→</span>
          {{ item.label }}
        </button>
        <p class="px-2.5 pb-2 pt-0.5 text-[9px] text-slate-500 leading-snug">
          后续接入仿真后端后启用
        </p>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { VueFlow } from '@vue-flow/core'
import type { Edge, Node, NodeMouseEvent } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import { h, computed, markRaw, nextTick, onMounted, ref } from 'vue'
import {
  AXI_EDGES,
  AXI_LAYOUT,
  AXI_SHELL,
  BLK,
  WIRE_STYLES,
  type WireKind,
} from '@/components/schematic/axiWriteCtrlMock'
import SchBlockNode from '@/components/schematic/SchBlockNode.vue'
import SchGhostNode from '@/components/schematic/SchGhostNode.vue'
import SchShellNode from '@/components/schematic/SchShellNode.vue'

const nodeTypes = {
  schShell: markRaw(SchShellNode),
  schBlock: markRaw(SchBlockNode),
  schGhost: markRaw(SchGhostNode),
}

function buildTraceLabel(bus: string) {
  return h('span', { class: 'inline-flex items-center gap-1.5' }, [
    h('span', { class: 'font-mono text-[10px] text-slate-200' }, bus),
    h(
      'span',
      {
        class:
          'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-sm bg-emerald-600 px-1 font-mono text-[9px] font-bold leading-none text-white shadow-sm',
      },
      '✕',
    ),
  ])
}

function buildBaseGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: 'shell',
      type: 'schShell',
      position: { x: 24, y: 28 },
      zIndex: 0,
      style: { width: `${AXI_SHELL.w}px`, height: `${AXI_SHELL.h}px` },
      data: {
        title: AXI_SHELL.title,
        leftPorts: [...AXI_SHELL.leftPorts],
        rightPorts: [...AXI_SHELL.rightPorts],
      },
    },
    {
      id: 'dff',
      type: 'schBlock',
      parentNode: 'shell',
      extent: 'parent',
      position: { x: AXI_LAYOUT.dff.x, y: AXI_LAYOUT.dff.y },
      zIndex: 1,
      style: { width: `${BLK.w}px`, height: `${BLK.h}px` },
      data: { kind: 'DFF', instance: 'state_reg' },
    },
    {
      id: 'comb',
      type: 'schBlock',
      parentNode: 'shell',
      extent: 'parent',
      position: { x: AXI_LAYOUT.comb.x, y: AXI_LAYOUT.comb.y },
      zIndex: 1,
      style: { width: `${BLK.w}px`, height: `${BLK.h}px` },
      data: { kind: 'COMB', instance: 'ns_logic' },
    },
    {
      id: 'out_reg',
      type: 'schBlock',
      parentNode: 'shell',
      extent: 'parent',
      position: { x: AXI_LAYOUT.out_reg.x, y: AXI_LAYOUT.out_reg.y },
      zIndex: 1,
      style: { width: `${BLK.w}px`, height: `${BLK.h}px` },
      data: { kind: 'OUT_REG', instance: 'out_logic' },
    },
    {
      id: 'ghost_r',
      type: 'schGhost',
      parentNode: 'shell',
      extent: 'parent',
      position: { x: AXI_LAYOUT.ghost_r.x, y: AXI_LAYOUT.ghost_r.y },
      zIndex: 2,
      selectable: false,
      style: { width: '4px', height: '4px' },
      data: {},
    },
  ]

  const edges: Edge[] = AXI_EDGES.map((def) => {
    const ws = WIRE_STYLES[def.kind]
    const edge: Edge = {
      id: def.id,
      source: def.source,
      target: def.target,
      sourceHandle: def.sourceHandle,
      targetHandle: def.targetHandle,
      type: 'smoothstep',
      style: {
        stroke: ws.stroke,
        strokeWidth: ws.strokeWidth,
        ...(ws.strokeDasharray ? { strokeDasharray: ws.strokeDasharray } : {}),
      },
      markerEnd: undefined,
      data: { kind: def.kind as WireKind },
      class: `sd-edge sd-edge--${def.kind}`,
      zIndex: def.kind === 'trace' ? 3 : def.kind === 'feedback' ? 2 : 1,
    }

    if (def.kind === 'trace' && def.label) {
      edge.label = buildTraceLabel(def.label) as Edge['label']
      edge.labelShowBg = true
      edge.labelBgStyle = { fill: '#070d14', fillOpacity: 0.95 }
      edge.labelBgPadding = [6, 4] as [number, number]
    }
    if (def.kind === 'error' && def.errorLabel) {
      edge.label = def.errorLabel
      edge.labelStyle = { fill: '#f87171', fontSize: 9 }
      edge.labelShowBg = true
      edge.labelBgStyle = { fill: '#070d14', fillOpacity: 0.9 }
      edge.labelBgPadding = [4, 2] as [number, number]
    }

    return edge
  })

  return { nodes, edges }
}

const baseNodes = ref<Node[]>([])
const baseEdges = ref<Edge[]>([])
const selectedId = ref<string | null>(null)

const ctxMenu = ref<{ x: number; y: number; nodeId: string; nodeLabel: string } | null>(null)

const ctxItems = [
  { id: 'trace', label: 'Trace Driver / Load', hint: '占位' },
  { id: 'path', label: 'Point-to-Point Path', hint: '占位' },
] as const

const connectedIds = computed(() => {
  const id = selectedId.value
  if (!id) return new Set<string>()
  const s = new Set<string>([id])
  for (const e of baseEdges.value) {
    if (e.source === id || e.target === id) {
      s.add(e.source)
      s.add(e.target)
    }
  }
  return s
})

const nodes = computed<Node[]>(() => {
  const sel = selectedId.value
  const conn = connectedIds.value
  return baseNodes.value.map((n) => {
    if (n.id === 'ghost_r') {
      return { ...n, class: undefined, style: { ...n.style, opacity: 1 } }
    }
    if (!sel) {
      return { ...n, class: undefined, style: { ...n.style, opacity: 1 } }
    }
    const on = conn.has(n.id)
    const opacity = on ? 1 : 0.34
    const cls = n.id === sel ? 'sd-sch-node--selected' : on ? 'sd-sch-node--related' : 'sd-sch-node--dim'
    return {
      ...n,
      class: cls,
      style: { ...n.style, opacity },
    }
  })
})

const edges = computed<Edge[]>(() => {
  const sel = selectedId.value
  return baseEdges.value.map((e) => {
    const baseStyle = (e.style ?? {}) as Record<string, string | number | undefined>
    const sw = typeof baseStyle.strokeWidth === 'number' ? baseStyle.strokeWidth : 1.5
    if (!sel) {
      return {
        ...e,
        class: `${e.class ?? ''} sd-edge--idle`.trim(),
        style: { ...baseStyle, opacity: 0.97 },
      }
    }
    const hit = e.source === sel || e.target === sel
    return {
      ...e,
      class: `${e.class ?? ''} ${hit ? 'sd-sch-edge--hot' : 'sd-sch-edge--dim'}`.trim(),
      style: {
        ...baseStyle,
        opacity: hit ? 1 : 0.22,
        strokeWidth: hit ? sw + 0.35 : sw * 0.92,
      },
    }
  })
})

function onNodeClick({ node }: NodeMouseEvent) {
  if (node.id === 'ghost_r') return
  selectedId.value = selectedId.value === node.id ? null : node.id
  closeContextMenu()
}

function contextMenuPosition(ev: MouseEvent | TouchEvent) {
  if (ev instanceof MouseEvent) {
    return { x: ev.clientX, y: ev.clientY }
  }
  const t = ev.touches[0] ?? ev.changedTouches[0]
  return { x: t?.clientX ?? 0, y: t?.clientY ?? 0 }
}

function onNodeContextMenu(ev: NodeMouseEvent) {
  if (ev.node.id === 'ghost_r') return
  ev.event.preventDefault()
  const { x: clientX, y: clientY } = contextMenuPosition(ev.event)
  const label = String(
    (ev.node.data as { kind?: string; instance?: string })?.kind
      ? `${(ev.node.data as { kind: string }).kind} (${(ev.node.data as { instance: string }).instance})`
      : (ev.node.data as { title?: string })?.title ?? ev.node.id,
  )
  ctxMenu.value = {
    x: clientX,
    y: clientY,
    nodeId: ev.node.id,
    nodeLabel: label,
  }
  selectedId.value = ev.node.id
  void nextTick(() => {
    window.addEventListener('click', closeContextMenuOnce, { capture: true, once: true })
  })
}

function closeContextMenuOnce() {
  ctxMenu.value = null
}

function closeContextMenu() {
  ctxMenu.value = null
}

onMounted(() => {
  const g = buildBaseGraph()
  baseNodes.value = g.nodes
  baseEdges.value = g.edges
})
</script>

<style scoped>
.sd-sch-root :deep(.vue-flow__background) {
  opacity: 0.45;
}

.sd-sch-flow {
  width: 100%;
  height: 100%;
}

/* 主追踪边默认略发光（与参考图「高亮白线」一致，不依赖选中） */
.sd-sch-root :deep(.sd-edge--trace path) {
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.4));
}

.sd-sch-root :deep(.sd-edge--trace.sd-sch-edge--dim path) {
  filter: none;
}

.sd-sch-root :deep(.sd-sch-node--selected) {
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.75), 0 0 22px rgba(56, 189, 248, 0.25);
  border-radius: 6px;
}

.sd-sch-root :deep(.sd-sch-node--related) {
  filter: brightness(1.08);
}

.sd-sch-root :deep(.sd-sch-edge--hot path) {
  filter: drop-shadow(0 0 4px rgba(56, 189, 248, 0.65));
}

.sd-sch-root :deep(.sd-sch-edge--dim path) {
  filter: none !important;
}

.sd-sch-root :deep(.vue-flow__edge-text) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
</style>
