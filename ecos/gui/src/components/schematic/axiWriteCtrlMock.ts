/**
 * axi_write_ctrl 原理图 mock：端口名、连线语义与布局常量与参考 UI 对齐。
 * 后续可整段替换为后端 JSON。
 */
import type { SchPort } from './schPort'

export const AXI_SHELL = {
  w: 720,
  h: 460,
  title: 'axi_write_ctrl',
  /** 左侧输入（自上而下，与参考图一致） */
  leftPorts: [
    { name: 'clk', badge: '1', tone: 'default' },
    { name: 'rst_n', badge: '1', tone: 'default' },
    { name: 'awready', tone: 'muted' },
    { name: 'wready', badge: '1', tone: 'default' },
    { name: 'bvalid', badge: '1', tone: 'default' },
    { name: 'bresp[1:0]', badge: '1', tone: 'default' },
  ] as SchPort[],
  /** 右侧输出 */
  rightPorts: [
    { name: 'awvalid', tone: 'muted' },
    { name: 'awaddr[31:0]', prefix: 'X!', tone: 'error' },
    { name: 'wvalid', tone: 'violet' },
    { name: 'wdata[31:0]', badge: '1', tone: 'default' },
    { name: 'wstrb[3:0]', badge: '1', tone: 'default' },
    { name: 'bready', badge: '1', tone: 'default' },
  ] as SchPort[],
} as const

/** 内层单元尺寸（与 shell 内留白配合） */
export const BLK = { w: 138, h: 60 }

/**
 * 布局：左列 DFF/OUT_REG，COMB 置于内外框之间的水平中部（参考图「居中」）。
 * 坐标相对 shell 左上角；左约 148px、右约 178px 留给端口列。
 */
export const AXI_LAYOUT = {
  dff: { x: 132, y: 52 },
  /** 水平居中：(148 + (720-178-BLK.w)) / 2 ≈ 266 */
  comb: { x: 266, y: 124 },
  out_reg: { x: 132, y: 302 },
  ghost_r: { x: 648, y: 312 },
} as const

/** 连线语义 → 与参考图一致的配色 */
export type WireKind = 'trace' | 'feedback' | 'valid' | 'error'

export const WIRE_STYLES: Record<
  WireKind,
  { stroke: string; strokeWidth: number; strokeDasharray?: string; glow?: string }
> = {
  /** DFF→COMB：粗白「追踪高亮」主路径 */
  trace: {
    stroke: '#f1f5f9',
    strokeWidth: 2.6,
    glow: 'drop-shadow(0 0 5px rgba(255,255,255,0.45))',
  },
  /** COMB→DFF 反馈：紫 */
  feedback: { stroke: '#a78bfa', strokeWidth: 1.65 },
  /** COMB→OUT_REG：有效数据/绿线语义 */
  valid: { stroke: '#4ade80', strokeWidth: 1.45 },
  /** OUT_REG 外出：红虚线 + X */
  error: { stroke: '#f87171', strokeWidth: 1.5, strokeDasharray: '7 5' },
}

export const AXI_EDGES: {
  id: string
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
  kind: WireKind
  /** 主标签；trace 线另带绿色 X 徽标（在视图里用 VNode 渲染） */
  label?: string
  errorLabel?: string
}[] = [
  {
    id: 'e_dff_comb',
    source: 'dff',
    target: 'comb',
    sourceHandle: 'out-r',
    targetHandle: 'in-l',
    kind: 'trace',
    label: 'state[2:0]',
  },
  {
    id: 'e_comb_dff',
    source: 'comb',
    target: 'dff',
    sourceHandle: 'out-t',
    targetHandle: 'in-t',
    kind: 'feedback',
  },
  {
    id: 'e_comb_out',
    source: 'comb',
    target: 'out_reg',
    sourceHandle: 'out-b',
    targetHandle: 'in-t',
    kind: 'valid',
  },
  {
    id: 'e_out_ghost',
    source: 'out_reg',
    target: 'ghost_r',
    sourceHandle: 'out-r',
    targetHandle: 'in-l',
    kind: 'error',
    errorLabel: 'X  X  X',
  },
]
