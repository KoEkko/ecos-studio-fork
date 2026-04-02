<template>
  <div class="sd-fsm-root relative h-full min-h-[140px] w-full min-w-0 bg-[#05080e]">
    <div v-if="layoutError" class="absolute inset-0 z-20 flex items-center justify-center px-3 text-center text-[11px] text-rose-400">
      {{ layoutError }}
    </div>
    <VueFlow
      v-else
      :nodes="baseNodes"
      :edges="baseEdges"
      :node-types="nodeTypes"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :elements-selectable="true"
      :fit-view-on-init="true"
      :min-zoom="0.15"
      :max-zoom="2"
      :default-edge-options="{ type: 'smoothstep', markerEnd: undefined }"
      class="sd-fsm-flow"
    >
      <Background pattern-color="rgba(51,65,85,0.3)" :gap="24" :size="1" />
      <Panel position="top-right" class="sd-fsm-panel !m-2">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-slate-600/50 bg-[#0a1018]/92 px-2 py-1.5 text-[9px] text-slate-400">
          <span class="inline-flex items-center gap-1.5">
            <span class="h-0.5 w-4 rounded bg-emerald-400" aria-hidden="true" />
            Active
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="h-0.5 w-4 rounded bg-sky-500" aria-hidden="true" />
            Visited
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="h-0.5 w-4 rounded bg-slate-500" aria-hidden="true" />
            Unvisited
          </span>
        </div>
      </Panel>
      <Panel position="bottom-left" class="sd-fsm-panel !m-2">
        <div class="rounded border border-slate-600/50 bg-[#0a1018]/92 px-2.5 py-1.5 font-mono text-[10px] text-slate-400">
          Sim time: <span class="text-sky-300/95">{{ simTimeLabel }}</span>
        </div>
      </Panel>
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { Panel, VueFlow } from '@vue-flow/core'
import type { Edge, Node } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import ELK from 'elkjs/lib/elk.bundled.js'
import type { ElkExtendedEdge, ElkNode } from 'elkjs'
import { computed, markRaw, onMounted, ref } from 'vue'
import FsmStateNode from '@/components/fsm/FsmStateNode.vue'
import {
  FSM_AXI_EDGES,
  FSM_AXI_SIM_TIME_NS,
  FSM_AXI_STATES,
  FSM_NODE_SIZE,
  resolveStateStatus,
} from '@/components/fsm/fsmAxiWriteCtrlMock'
import type { FsmEdgeSemantic } from '@/components/fsm/fsmAxiWriteCtrlMock'

const props = withDefaults(
  defineProps<{
    /** 可选覆盖；默认与 mock 一致 */
    simTimeNs?: number
  }>(),
  { simTimeNs: undefined },
)

const nodeTypes = { fsmState: markRaw(FsmStateNode) }

const elk = new ELK()

const layoutError = ref<string | null>(null)
const baseNodes = ref<Node[]>([])
const baseEdges = ref<Edge[]>([])

const simTimeLabel = computed(() => {
  const ns = props.simTimeNs ?? FSM_AXI_SIM_TIME_NS
  return `${ns}ns`
})

function edgeSemanticStyle(semantic: FsmEdgeSemantic): Record<string, string | number> {
  switch (semantic) {
    case 'active':
      return { stroke: '#22c55e', strokeWidth: 2.5 }
    case 'visited':
      return { stroke: '#3b82f6', strokeWidth: 1.5 }
    case 'pending':
      return { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '6 4' }
  }
}

function buildElkRoot(): ElkNode {
  const children: ElkNode[] = FSM_AXI_STATES.map((s) => ({
    id: s.id,
    width: FSM_NODE_SIZE.w,
    height: FSM_NODE_SIZE.h,
  }))

  const edges: ElkExtendedEdge[] = FSM_AXI_EDGES.map((e) => ({
    id: e.id,
    sources: [e.source],
    targets: [e.target],
  }))

  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '44',
      'elk.layered.spacing.nodeNodeBetweenLayers': '72',
      'elk.layered.spacing.edgeNodeBetweenLayers': '28',
    },
    children,
    edges,
  }
}

function elkToVueFlow(elkRoot: ElkNode): { nodes: Node[]; edges: Edge[] } {
  const laid = elkRoot.children ?? []
  const byId = new Map(FSM_AXI_STATES.map((s) => [s.id, s]))

  const nodes: Node[] = laid.map((n) => {
    const def = byId.get(n.id)
    if (!def) {
      return {
        id: n.id,
        type: 'fsmState',
        position: { x: n.x ?? 0, y: n.y ?? 0 },
        data: { name: n.id, encoding: '', status: 'unvisited' as const },
        style: { width: `${FSM_NODE_SIZE.w}px`, height: `${FSM_NODE_SIZE.h}px` },
      }
    }
    return {
      id: n.id,
      type: 'fsmState',
      position: { x: n.x ?? 0, y: n.y ?? 0 },
      data: {
        name: def.name,
        encoding: def.encoding,
        status: resolveStateStatus(def.id),
      },
      style: { width: `${FSM_NODE_SIZE.w}px`, height: `${FSM_NODE_SIZE.h}px` },
    }
  })

  const edges: Edge[] = FSM_AXI_EDGES.map((e) => {
    const st = edgeSemanticStyle(e.semantic)
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: 'r',
      targetHandle: 'l',
      type: 'smoothstep',
      label: e.label,
      labelStyle: { fill: '#94a3b8', fontSize: 9 },
      labelShowBg: true,
      labelBgStyle: { fill: '#070d14', fillOpacity: 0.92 },
      labelBgPadding: [4, 2] as [number, number],
      style: st,
      markerEnd: undefined,
    }
  })

  return { nodes, edges }
}

async function runLayout() {
  layoutError.value = null
  try {
    const graph = buildElkRoot()
    const laid = await elk.layout(graph)
    const vf = elkToVueFlow(laid)
    baseNodes.value = vf.nodes
    baseEdges.value = vf.edges
  } catch (e) {
    console.error('[SimDebugFsmView] ELK layout failed:', e)
    layoutError.value = 'FSM 布局失败（ELK）'
  }
}

onMounted(() => {
  void runLayout()
})
</script>

<style scoped>
.sd-fsm-root :deep(.vue-flow__background) {
  opacity: 0.4;
}

.sd-fsm-flow {
  width: 100%;
  height: 100%;
}

.sd-fsm-root :deep(.sd-fsm-panel) {
  pointer-events: none;
}

.sd-fsm-root :deep(.vue-flow__edge-text) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
</style>
