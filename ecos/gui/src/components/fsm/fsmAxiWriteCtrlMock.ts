/**
 * axi_write_ctrl.state FSM mock — 后续可替换为引擎/API 返回的 JSON。
 */
export type FsmStateStatus = 'current' | 'visited' | 'unvisited' | 'error'

export type FsmEdgeSemantic = 'active' | 'visited' | 'pending'

export type FsmStateDef = {
  id: string
  name: string
  /** 显示用，如 3'b011 */
  encoding: string
}

export type FsmEdgeDef = {
  id: string
  source: string
  target: string
  label: string
  semantic: FsmEdgeSemantic
}

export const FSM_AXI_HIERARCHY = 'axi_write_ctrl.state'

/** 固定节点外接矩形（圆形节点用相同宽高），供 ELK 与 Vue Flow 共用 */
export const FSM_NODE_SIZE = { w: 92, h: 92 }

export const FSM_AXI_STATES: FsmStateDef[] = [
  { id: 'IDLE', name: 'IDLE', encoding: "3'b000" },
  { id: 'WR_ADDR', name: 'WR_ADDR', encoding: "3'b001" },
  { id: 'WR_DATA', name: 'WR_DATA', encoding: "3'b010" },
  { id: 'WR_DONE', name: 'WR_DONE', encoding: "3'b011" },
  { id: 'ERROR', name: 'ERROR', encoding: "3'b111" },
]

/** 当前态（绿色高亮）；参考图示例为 WR_DONE / 3'b011 */
export const FSM_AXI_CURRENT_ID = 'WR_DONE'

/** 已访问状态（蓝色）；ERROR 未进入时保持 unvisited/error 样式 */
export const FSM_AXI_VISITED_IDS = new Set(['IDLE', 'WR_ADDR', 'WR_DATA', 'WR_DONE'])

export const FSM_AXI_SIM_TIME_NS = 270

export const FSM_AXI_EDGES: FsmEdgeDef[] = [
  { id: 'e0', source: 'IDLE', target: 'WR_ADDR', label: 'start', semantic: 'visited' },
  { id: 'e1', source: 'WR_ADDR', target: 'WR_DATA', label: 'awvalid && awready', semantic: 'visited' },
  {
    id: 'e2',
    source: 'WR_DATA',
    target: 'WR_DONE',
    label: 'wvalid && wready && wlast',
    semantic: 'active',
  },
  { id: 'e3', source: 'WR_DONE', target: 'IDLE', label: 'bvalid && bready', semantic: 'pending' },
  { id: 'e4', source: 'WR_ADDR', target: 'ERROR', label: 'illegal', semantic: 'pending' },
]

export function resolveStateStatus(stateId: string): FsmStateStatus {
  if (stateId === 'ERROR') return 'error'
  if (stateId === FSM_AXI_CURRENT_ID) return 'current'
  if (FSM_AXI_VISITED_IDS.has(stateId)) return 'visited'
  return 'unvisited'
}
