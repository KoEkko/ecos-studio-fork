#!/usr/bin/env tsx
/**
 * gen-mock-tiles.ts
 *
 * 将 GCD 布局 JSON 源数据转换为文档规范的瓦片金字塔格式:
 *   public/mock-design/
 *     manifest.json
 *     cells.bin
 *     global.bin
 *     tiles/raster/{z}/{x}/{y}.png
 *     tiles/vector/{z}/{x}/{y}.bin
 *
 * 运行方式: cd ecos/gui && npx tsx scripts/gen-mock-tiles.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'

// ─── 路径配置 ────────────────────────────────────────────────────────────────
const ROOT = process.cwd()
const SOURCE_DIR    = path.join(ROOT, 'public/layout_source')
const SOURCE_PREFIX = '20_layout_json_top_layout_json'
const SOURCE_HEADER = path.join(SOURCE_DIR, `${SOURCE_PREFIX}-header.json`)
const OUT_DIR       = path.join(ROOT, 'public/mock-design')

/** 扫描 SOURCE_DIR，收集所有 `${SOURCE_PREFIX}-N.json` 分片文件，按 N 升序排列 */
function discoverSourceDataFiles(): string[] {
  const pattern = new RegExp(`^${SOURCE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)\\.json$`)
  const entries = fs.readdirSync(SOURCE_DIR)
  const matched: { idx: number; file: string }[] = []
  for (const name of entries) {
    const m = name.match(pattern)
    if (m) matched.push({ idx: parseInt(m[1]!, 10), file: path.join(SOURCE_DIR, name) })
  }
  matched.sort((a, b) => a.idx - b.idx)
  return matched.map(m => m.file)
}

// ─── 配置常量 ────────────────────────────────────────────────────────────────
const TILE_PIXEL_SIZE      = 256
const VECTOR_THRESHOLD     = 3000    // 超过此展开矩形数则用栅格瓦片
const MIN_FEATURE_FLOOR    = 50      // 过滤退化形状（<50 DBU），避免 maxZ 爆炸
const MAX_Z_HARD_CAP       = 10      // 硬上限：防止小设计因计算偏差生成过多瓦片


// ─── 图层定义 ────────────────────────────────────────────────────────────────
// GDS layerId → { name, rgb, alpha(0-255), zOrder }
const LAYER_STYLES: Record<number, { name: string; rgb: [number, number, number]; alpha: number; zOrder: number }> = {
  0:  { name: 'overlap', rgb: [120, 120, 120], alpha: 76,  zOrder: 0  },
  7:  { name: 'met1',    rgb: [ 65, 105, 225], alpha: 153, zOrder: 10 },
  8:  { name: 'via1',    rgb: [  0, 206, 209], alpha: 200, zOrder: 15 },
  9:  { name: 'met2',    rgb: [ 50, 205,  50], alpha: 153, zOrder: 20 },
  10: { name: 'via2',    rgb: [127, 255,   0], alpha: 200, zOrder: 25 },
  11: { name: 'met3',    rgb: [255, 215,   0], alpha: 153, zOrder: 30 },
  12: { name: 'via3',    rgb: [255, 140,   0], alpha: 200, zOrder: 35 },
  13: { name: 'met4',    rgb: [232,  69,  60], alpha: 153, zOrder: 40 },
  14: { name: 'via4',    rgb: [255, 105, 180], alpha: 200, zOrder: 45 },
  15: { name: 'met5',    rgb: [147, 112, 219], alpha: 153, zOrder: 50 },
}

const USED_LAYER_IDS = [0, 7, 8, 9, 10, 11, 12, 13, 14, 15]

// layerId → 0-based index into manifest.layers (用于 bin 文件中的 layerIdx 字段)
const LAYER_ID_TO_IDX: Record<number, number> = {}
USED_LAYER_IDS.forEach((id, idx) => { LAYER_ID_TO_IDX[id] = idx })

// ─── 类型定义 ────────────────────────────────────────────────────────────────
interface ScreenRect {
  minX: number; minY: number; maxX: number; maxY: number
  layerIdx: number
}

interface CellDef {
  cellId:    number
  bboxW:     number
  bboxH:     number
  coordBits: 0 | 1  // 0=i16, 1=i32
  // 按层分组的本地坐标矩形: per layer → Int16Array|Int32Array [lx,ly,lw,lh, ...]
  layers:    Array<{ layerIdx: number; rects: Int16Array | Int32Array }>
}

interface CellInst {
  instanceId: number   // instance name 的 hash 低 32 位
  cellId:     number
  originX:    number   // 世界坐标 (screen space, Y 向下)
  originY:    number
  orient:     number   // 源数据全为 0 (N)
  bboxW:      number   // 用于快速 tile 相交检测
  bboxH:      number
}

// ─── PNG 编码器 (无外部依赖) ──────────────────────────────────────────────────
const CRC32_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = CRC32_TABLE[(c ^ buf[i]) & 0xFF]! ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf  = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

function encodePNG(pixels: Buffer, w: number, h: number): Buffer {
  // pixels: RGBA row-major top-to-bottom (4 bytes/pixel)
  const rows: Buffer[] = []
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 4)
    row[0] = 0  // filter: None
    pixels.copy(row, 1, y * w * 4, (y + 1) * w * 4)
    rows.push(row)
  }
  const compressed = zlib.deflateSync(Buffer.concat(rows), { level: 6 })
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6  // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),  // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ─── 解析源数据 ───────────────────────────────────────────────────────────────
function parseSource(dieH: number): { rawInsts: Array<{ name: string; rects: ScreenRect[] }>; totalBoxes: number } {
  const sourceFiles = discoverSourceDataFiles()
  if (sourceFiles.length === 0) throw new Error(`未找到源数据文件 (前缀: ${SOURCE_PREFIX}-*.json)`)
  console.log(`  发现 ${sourceFiles.length} 个源数据分片`)

  const rawInsts: Array<{ name: string; rects: ScreenRect[] }> = []
  let totalBoxes = 0

  for (const filePath of sourceFiles) {
    const fileName = path.basename(filePath)
    console.log(`  读取 ${fileName}...`)
    const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    for (const group of rawData.data) {
      if (group.type !== 'group') continue
      const rects: ScreenRect[] = []
      for (const child of group.children) {
        if (child.type !== 'box') continue
        const layerIdx = LAYER_ID_TO_IDX[child.layer as number]
        if (layerIdx === undefined) continue

        const pts = child.path as [number, number][]
        let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity
        for (const [x, y] of pts) {
          if (x < xMin) xMin = x; if (x > xMax) xMax = x
          if (y < yMin) yMin = y; if (y > yMax) yMax = y
        }
        // GDS Y 向上 → screen Y 向下: screenY = dieH - gdsY
        rects.push({
          minX: xMin,
          maxX: xMax,
          minY: dieH - yMax,
          maxY: dieH - yMin,
          layerIdx,
        })
      }
      if (rects.length > 0) {
        rawInsts.push({ name: group['struct name'] as string, rects })
        totalBoxes += rects.length
      }
    }
  }
  return { rawInsts, totalBoxes }
}

// ─── 层次结构提取 ─────────────────────────────────────────────────────────────
// 通过归一化形状 + MD5 hash 识别相同的 cell 类型
function extractHierarchy(rawInsts: Array<{ name: string; rects: ScreenRect[] }>) {
  const hashToCellId = new Map<string, number>()
  const cellDefs     = new Map<number, CellDef>()
  const cellInsts:   CellInst[] = []
  let nextCellId = 1

  for (const inst of rawInsts) {
    // 计算 instance world bbox (screen coords)
    let wMinX = Infinity, wMinY = Infinity, wMaxX = -Infinity, wMaxY = -Infinity
    for (const r of inst.rects) {
      if (r.minX < wMinX) wMinX = r.minX; if (r.maxX > wMaxX) wMaxX = r.maxX
      if (r.minY < wMinY) wMinY = r.minY; if (r.maxY > wMaxY) wMaxY = r.maxY
    }
    const originX = wMinX, originY = wMinY
    const bboxW = wMaxX - wMinX, bboxH = wMaxY - wMinY

    // 本地坐标 (相对 origin)
    const localRects = inst.rects.map(r => ({
      layerIdx: r.layerIdx,
      lx: r.minX - originX,
      ly: r.minY - originY,
      lw: r.maxX - r.minX,
      lh: r.maxY - r.minY,
    }))

    // 排序 + hash 识别相同 cell 类型
    const sorted = [...localRects].sort(
      (a, b) => a.layerIdx - b.layerIdx || a.lx - b.lx || a.ly - b.ly || a.lw - b.lw || a.lh - b.lh
    )
    const hash = crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex')

    let cellId = hashToCellId.get(hash)
    if (cellId === undefined) {
      cellId = nextCellId++
      hashToCellId.set(hash, cellId)

      // 判断坐标范围是否需要 i32
      let maxCoord = 0
      for (const r of localRects) {
        const m = Math.max(Math.abs(r.lx), Math.abs(r.ly), r.lx + r.lw, r.ly + r.lh)
        if (m > maxCoord) maxCoord = m
      }
      const coordBits: 0 | 1 = maxCoord > 32767 ? 1 : 0

      // 按 layer 分组
      const byLayer = new Map<number, typeof localRects>()
      for (const r of localRects) {
        if (!byLayer.has(r.layerIdx)) byLayer.set(r.layerIdx, [])
        byLayer.get(r.layerIdx)!.push(r)
      }

      const defLayers: CellDef['layers'] = []
      for (const [layerIdx, rects] of byLayer) {
        const TypedArray = coordBits === 0 ? Int16Array : Int32Array
        const arr = new TypedArray(rects.length * 4)
        rects.forEach((r, i) => {
          arr[i * 4]     = r.lx
          arr[i * 4 + 1] = r.ly
          arr[i * 4 + 2] = r.lw
          arr[i * 4 + 3] = r.lh
        })
        defLayers.push({ layerIdx, rects: arr })
      }

      cellDefs.set(cellId, { cellId, bboxW, bboxH, coordBits, layers: defLayers })
    }

    // instance ID: instance name hash 的低 32 位
    const instanceId = parseInt(
      crypto.createHash('md5').update(inst.name).digest('hex').slice(0, 8), 16
    )
    cellInsts.push({ instanceId, cellId, originX, originY, orient: 0, bboxW, bboxH })
  }

  return { cellDefs, cellInsts }
}

// ─── cells.bin ────────────────────────────────────────────────────────────────
/**
 * 格式:
 *   [File Header: 16 bytes]
 *     u32 magic=0x4543454C  u16 version=1  u16 reserved
 *     u32 cellCount          u32 indexOffset
 *   [Cell Index Table]
 *     cellCount × { u32 cellId, u32 offset, u32 byteLen }
 *   [Cell Data, per cell]
 *     u32 cellId  i32 bboxW  i32 bboxH  u8 layerCount  u8 flags(bit0=coordBits)
 *     per layer: u8 layerIdx  u16 rectCount  rectCount×[lx,ly,lw,lh]
 */
function buildCellsBin(cellDefs: Map<number, CellDef>): Buffer {
  const cells = [...cellDefs.values()]
  const cellCount = cells.length

  const FILE_HDR_SIZE  = 16
  const INDEX_ENTRY    = 12  // u32×3

  // Pass 1: 序列化每个 cell 数据
  const cellBufs: Buffer[] = []
  for (const cell of cells) {
    const parts: Buffer[] = []

    const hdr = Buffer.alloc(4 + 4 + 4 + 1 + 1)
    hdr.writeUInt32LE(cell.cellId, 0)
    hdr.writeInt32LE(cell.bboxW, 4)
    hdr.writeInt32LE(cell.bboxH, 8)
    hdr[12] = cell.layers.length
    hdr[13] = cell.coordBits
    parts.push(hdr)

    for (const layer of cell.layers) {
      const lhdr = Buffer.alloc(3)
      lhdr[0] = layer.layerIdx
      lhdr.writeUInt16LE(layer.rects.length / 4, 1)
      parts.push(lhdr)
      parts.push(Buffer.from(layer.rects.buffer))
    }

    cellBufs.push(Buffer.concat(parts))
  }

  // File header
  const fileHdr = Buffer.alloc(FILE_HDR_SIZE)
  fileHdr.writeUInt32LE(0x4543454C, 0)  // "ECEL"
  fileHdr.writeUInt16LE(1, 4)           // version
  fileHdr.writeUInt16LE(0, 6)           // reserved
  fileHdr.writeUInt32LE(cellCount, 8)
  fileHdr.writeUInt32LE(FILE_HDR_SIZE, 12)  // indexOffset: immediately after header

  // Index table
  const idxBuf = Buffer.alloc(cellCount * INDEX_ENTRY)
  let dataOff = FILE_HDR_SIZE + cellCount * INDEX_ENTRY
  for (let i = 0; i < cells.length; i++) {
    idxBuf.writeUInt32LE(cells[i]!.cellId, i * INDEX_ENTRY)
    idxBuf.writeUInt32LE(dataOff, i * INDEX_ENTRY + 4)
    idxBuf.writeUInt32LE(cellBufs[i]!.length, i * INDEX_ENTRY + 8)
    dataOff += cellBufs[i]!.length
  }

  return Buffer.concat([fileHdr, idxBuf, ...cellBufs])
}

// ─── global.bin ───────────────────────────────────────────────────────────────
/**
 * 格式:
 *   [File Header: 12 bytes]
 *     u32 magic=0x45434756  u16 version=1  u16 reserved  u32 shapeCount
 *   [Shape Table, per shape: 24 bytes]
 *     u32 shapeId  u8 layerIdx  u8 type  u16 nameIdx  i32 x  i32 y  i32 w  i32 h
 *   [String Pool]
 *     u32 stringCount  per string: u16 len + utf8 bytes
 *
 * 为测试用途合成几条假电源条和垂直 rail
 */
function buildGlobalBin(dieW: number, dieH: number): Buffer {
  // type: 0=power_stripe(VDD), 1=ground_stripe(VSS), 2=io_pin, 3=blockage
  const shapes = [
    { id: 1, layerIdx: LAYER_ID_TO_IDX[15]!, type: 0, nameIdx: 0, x: 0,                          y: Math.floor(dieH * 0.25), w: dieW, h: 600 },  // MET5 H VDD
    { id: 2, layerIdx: LAYER_ID_TO_IDX[15]!, type: 1, nameIdx: 1, x: 0,                          y: Math.floor(dieH * 0.50), w: dieW, h: 600 },  // MET5 H VSS
    { id: 3, layerIdx: LAYER_ID_TO_IDX[15]!, type: 0, nameIdx: 0, x: 0,                          y: Math.floor(dieH * 0.75), w: dieW, h: 600 },  // MET5 H VDD
    { id: 4, layerIdx: LAYER_ID_TO_IDX[13]!, type: 0, nameIdx: 0, x: Math.floor(dieW * 0.25), y: 0, w: 500, h: dieH },  // MET4 V VDD
    { id: 5, layerIdx: LAYER_ID_TO_IDX[13]!, type: 1, nameIdx: 1, x: Math.floor(dieW * 0.50), y: 0, w: 500, h: dieH },  // MET4 V VSS
    { id: 6, layerIdx: LAYER_ID_TO_IDX[13]!, type: 0, nameIdx: 0, x: Math.floor(dieW * 0.75), y: 0, w: 500, h: dieH },  // MET4 V VDD
  ]
  const names = ['VDD', 'VSS']

  // File header (12 bytes)
  const fileHdr = Buffer.alloc(12)
  fileHdr.writeUInt32LE(0x45434756, 0)  // "ECGV"
  fileHdr.writeUInt16LE(1, 4)           // version
  fileHdr.writeUInt16LE(0, 6)           // reserved
  fileHdr.writeUInt32LE(shapes.length, 8)

  // Shape table (24 bytes × n)
  const shapeBuf = Buffer.alloc(shapes.length * 24)
  shapes.forEach((s, i) => {
    const o = i * 24
    shapeBuf.writeUInt32LE(s.id, o)
    shapeBuf[o + 4] = s.layerIdx
    shapeBuf[o + 5] = s.type
    shapeBuf.writeUInt16LE(s.nameIdx, o + 6)
    shapeBuf.writeInt32LE(s.x, o + 8)
    shapeBuf.writeInt32LE(s.y, o + 12)
    shapeBuf.writeInt32LE(s.w, o + 16)
    shapeBuf.writeInt32LE(s.h, o + 20)
  })

  // String pool
  const strParts: Buffer[] = []
  const strCount = Buffer.alloc(4)
  strCount.writeUInt32LE(names.length, 0)
  strParts.push(strCount)
  for (const name of names) {
    const nb = Buffer.from(name, 'utf8')
    const lenBuf = Buffer.alloc(2)
    lenBuf.writeUInt16LE(nb.length, 0)
    strParts.push(lenBuf, nb)
  }

  return Buffer.concat([fileHdr, shapeBuf, ...strParts])
}

// ─── 模拟 routing 生成 ────────────────────────────────────────────────────────
interface FlatSeg { x: number; y: number; w: number; h: number }
interface FlatGroup { layerIdx: number; direction: number; wireWidth: number; rects: FlatSeg[] }

interface RoutingWire {
  layerIdx: number; direction: number; wireWidth: number
  x: number; y: number; w: number; h: number
}

/**
 * 全局生成 mock routing，基于所有 instance 的位置，
 * 保证所有 Z 级别看到的走线完全一致。
 */
function generateGlobalRouting(cellInsts: CellInst[]): RoutingWire[] {
  if (cellInsts.length < 2) return []

  const met1Idx = LAYER_ID_TO_IDX[7]!
  const met2Idx = LAYER_ID_TO_IDX[9]!
  const WIRE_W  = 140

  const wires: RoutingWire[] = []
  const sorted = [...cellInsts].sort((a, b) => a.originY - b.originY || a.originX - b.originX)

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!, b = sorted[i + 1]!
    const aCx = a.originX + Math.floor(a.bboxW / 2)
    const aCy = a.originY + Math.floor(a.bboxH / 2)
    const bCx = b.originX + Math.floor(b.bboxW / 2)
    const bCy = b.originY + Math.floor(b.bboxH / 2)

    if (Math.abs(aCy - bCy) < a.bboxH * 2) {
      const x0 = Math.min(aCx, bCx), x1 = Math.max(aCx, bCx)
      if (x1 - x0 > WIRE_W * 2) {
        wires.push({ layerIdx: met1Idx, direction: 0, wireWidth: WIRE_W,
          x: x0, y: aCy - Math.floor(WIRE_W / 2), w: x1 - x0, h: WIRE_W })
      }
    } else {
      const y0 = Math.min(aCy, bCy), y1 = Math.max(aCy, bCy)
      if (y1 - y0 > WIRE_W * 2) {
        wires.push({ layerIdx: met2Idx, direction: 1, wireWidth: WIRE_W,
          x: aCx - Math.floor(WIRE_W / 2), y: y0, w: WIRE_W, h: y1 - y0 })
      }
    }
  }
  return wires
}

/** 从全局走线集合中提取与瓦片重叠的走线（存储原始完整坐标，渲染时由前端裁剪） */
function getRoutingForTile(
  wires: RoutingWire[],
  tileBounds: { x: number; y: number; x2: number; y2: number },
): FlatGroup[] {
  const groups = new Map<string, FlatGroup>()

  for (const w of wires) {
    if (w.x >= tileBounds.x2 || w.x + w.w <= tileBounds.x ||
        w.y >= tileBounds.y2 || w.y + w.h <= tileBounds.y) continue

    const key = `${w.layerIdx}:${w.direction}:${w.wireWidth}`
    let group = groups.get(key)
    if (!group) {
      group = { layerIdx: w.layerIdx, direction: w.direction, wireWidth: w.wireWidth, rects: [] }
      groups.set(key, group)
    }
    group.rects.push({ x: w.x, y: w.y, w: w.w, h: w.h })
  }

  return [...groups.values()]
}

// ─── 矢量瓦片 ─────────────────────────────────────────────────────────────────
/**
 * 格式:
 *   [Header: 16 bytes]
 *     u32 magic=0x45434F53  u16 version=2  u8 flags  u8 reserved
 *     u32 instanceCount  u32 flatRectCount
 *   [Section B: Instance Table]
 *     per inst: u32 instanceId  u32 cellId  i32 originX  i32 originY  u8 orient  [17 bytes]
 *   [Section C: Flat Geometry]
 *     per group: u8 layerIdx  u8 direction  u16 wireWidth  u32 segCount
 *                segCount × [i32 x, i32 y, i32 w, i32 h]
 */
function buildVectorTile(instances: CellInst[], flatGroups?: FlatGroup[]): Buffer {
  const INST_SIZE = 17

  let flatRectCount = 0
  if (flatGroups) {
    for (const g of flatGroups) flatRectCount += g.rects.length
  }

  let flags = 0
  if (instances.length > 0) flags |= 1  // bit0: has_instances
  if (flatRectCount > 0)    flags |= 2  // bit1: has_flat_geometry

  const header = Buffer.alloc(16)
  header.writeUInt32LE(0x45434F53, 0)  // "ECOS"
  header.writeUInt16LE(2, 4)           // version
  header[6] = flags
  header[7] = 0
  header.writeUInt32LE(instances.length, 8)
  header.writeUInt32LE(flatRectCount, 12)

  const instBuf = Buffer.alloc(instances.length * INST_SIZE)
  instances.forEach((inst, i) => {
    const o = i * INST_SIZE
    instBuf.writeUInt32LE(inst.instanceId, o)
    instBuf.writeUInt32LE(inst.cellId, o + 4)
    instBuf.writeInt32LE(inst.originX, o + 8)
    instBuf.writeInt32LE(inst.originY, o + 12)
    instBuf[o + 16] = inst.orient
  })

  // Section C: flat geometry
  const flatParts: Buffer[] = []
  if (flatGroups && flatRectCount > 0) {
    for (const g of flatGroups) {
      const ghdr = Buffer.alloc(8)
      ghdr[0] = g.layerIdx
      ghdr[1] = g.direction
      ghdr.writeUInt16LE(g.wireWidth, 2)
      ghdr.writeUInt32LE(g.rects.length, 4)
      flatParts.push(ghdr)

      const rectBuf = Buffer.alloc(g.rects.length * 16)
      g.rects.forEach((r, i) => {
        const o = i * 16
        rectBuf.writeInt32LE(r.x, o)
        rectBuf.writeInt32LE(r.y, o + 4)
        rectBuf.writeInt32LE(r.w, o + 8)
        rectBuf.writeInt32LE(r.h, o + 12)
      })
      flatParts.push(rectBuf)
    }
  }

  return Buffer.concat([header, instBuf, ...flatParts])
}

// ─── 栅格瓦片渲染 ─────────────────────────────────────────────────────────────
function renderRasterTile(
  instances: CellInst[],
  cellDefs:  Map<number, CellDef>,
  tileBounds: { x: number; y: number; x2: number; y2: number },
  tileWorldSize: number,
): Buffer {
  const S = TILE_PIXEL_SIZE
  const pixels = Buffer.alloc(S * S * 4) // 全透明 (RGBA = 0,0,0,0)

  const scale = S / tileWorldSize

  // 按 zOrder 从低到高渲染各层
  const sortedLayers = USED_LAYER_IDS.slice().sort(
    (a, b) => LAYER_STYLES[a]!.zOrder - LAYER_STYLES[b]!.zOrder
  )

  for (const layerId of sortedLayers) {
    const layerIdx = LAYER_ID_TO_IDX[layerId]!
    const style    = LAYER_STYLES[layerId]!
    const [sr, sg, sb] = style.rgb
    const sa = style.alpha / 255

    for (const inst of instances) {
      const def = cellDefs.get(inst.cellId)
      if (!def) continue
      const ld = def.layers.find(l => l.layerIdx === layerIdx)
      if (!ld) continue

      const rects = ld.rects
      const rectCount = rects.length / 4

      for (let ri = 0; ri < rectCount; ri++) {
        const lx = rects[ri * 4]!
        const ly = rects[ri * 4 + 1]!
        const lw = rects[ri * 4 + 2]!
        const lh = rects[ri * 4 + 3]!

        // world bounds → tile-relative pixel coords
        const wx = inst.originX + lx
        const wy = inst.originY + ly

        const px0 = Math.floor((wx       - tileBounds.x) * scale)
        const py0 = Math.floor((wy       - tileBounds.y) * scale)
        const px1 = Math.ceil( (wx + lw  - tileBounds.x) * scale)
        const py1 = Math.ceil( (wy + lh  - tileBounds.y) * scale)

        const x0 = Math.max(0, px0), x1 = Math.min(S, px1)
        const y0 = Math.max(0, py0), y1 = Math.min(S, py1)
        if (x0 >= x1 || y0 >= y1) continue

        // Alpha composite (source over) onto potentially transparent dst
        for (let py = y0; py < y1; py++) {
          for (let px = x0; px < x1; px++) {
            const idx = (py * S + px) * 4
            const dstA = pixels[idx + 3]! / 255
            const outA = sa + dstA * (1 - sa)
            if (outA > 0) {
              const invOutA = 1 / outA
              pixels[idx]     = Math.round((sr! * sa + pixels[idx]!     * dstA * (1 - sa)) * invOutA)
              pixels[idx + 1] = Math.round((sg! * sa + pixels[idx + 1]! * dstA * (1 - sa)) * invOutA)
              pixels[idx + 2] = Math.round((sb! * sa + pixels[idx + 2]! * dstA * (1 - sa)) * invOutA)
              pixels[idx + 3] = Math.round(outA * 255)
            }
          }
        }
      }
    }
  }

  return pixels
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────
function main() {
  console.log('\n🚀 GCD Mock Tile Generator\n')

  // ── 读取 header ─────────────────────────────────────────────────────────────
  const header = JSON.parse(fs.readFileSync(SOURCE_HEADER, 'utf-8'))
  const diePts  = header.diearea.path as [number, number][]
  const dieMinX = Math.min(...diePts.map(p => p[0]))
  const dieMinY = Math.min(...diePts.map(p => p[1]))
  const dieW    = Math.max(...diePts.map(p => p[0])) - dieMinX  // 84710
  const dieH    = Math.max(...diePts.map(p => p[1])) - dieMinY  // 84710

  console.log(`📐 Die area: ${dieW} × ${dieH} DBU (${(dieW/1000).toFixed(1)} × ${(dieH/1000).toFixed(1)} μm)`)

  // ── 解析源数据 ───────────────────────────────────────────────────────────────
  const { rawInsts, totalBoxes } = parseSource(dieH)
  console.log(`📊 ${rawInsts.length} instances, ${totalBoxes} boxes`)

  // ── 最小特征尺寸 ─────────────────────────────────────────────────────────────
  let minFeature = Infinity
  for (const inst of rawInsts) {
    for (const r of inst.rects) {
      const w = r.maxX - r.minX, h = r.maxY - r.minY
      // 过滤退化形状（< MIN_FEATURE_FLOOR DBU），这类形状来自源数据噪点
      if (w >= MIN_FEATURE_FLOOR && w < minFeature) minFeature = w
      if (h >= MIN_FEATURE_FLOOR && h < minFeature) minFeature = h
    }
  }
  if (!isFinite(minFeature) || minFeature <= 0) minFeature = 130
  console.log(`📏 最小特征: ${minFeature} DBU = ${(minFeature/1000).toFixed(3)} μm`)

  // ── 计算 maxZ / rasterMaxZ (三约束公式) ──────────────────────────────────────
  const dieMaxSide = Math.max(dieW, dieH)
  const zByFeature = Math.ceil(Math.log2(dieMaxSide / minFeature))
  const zFloor     = Math.ceil(Math.log2(dieMaxSide / (minFeature * 20)))

  // z_by_density: 首个均匀分布 p95 矩形数 < 10 的 Z
  let zByDensity = zByFeature
  for (let z = 0; z <= zByFeature; z++) {
    const avgPerTile = totalBoxes / Math.pow(4, z)
    if (avgPerTile < 10) { zByDensity = z; break }
  }

  const maxZ = Math.min(Math.max(Math.min(zByFeature, zByDensity), zFloor), MAX_Z_HARD_CAP)

  // rasterMaxZ: 最后一个最重瓦片 > VECTOR_THRESHOLD 的 Z
  let rasterMaxZ = 0
  for (let z = 0; z <= maxZ; z++) {
    const worstTile = totalBoxes / Math.pow(4, z)
    if (worstTile > VECTOR_THRESHOLD) rasterMaxZ = z
    else break
  }

  console.log(`🗂  maxZ=${maxZ}, rasterMaxZ=${rasterMaxZ}`)
  console.log(`   (zByFeature=${zByFeature}, zByDensity=${zByDensity}, zFloor=${zFloor})`)

  // ── 层次结构提取 ──────────────────────────────────────────────────────────────
  console.log('\n🔍 提取 cell 类型 (MD5 shape hash)...')
  const { cellDefs, cellInsts } = extractHierarchy(rawInsts)
  console.log(`   ${cellDefs.size} 种 cell 类型，${cellInsts.length} 个实例`)

  // ── 准备输出目录 ─────────────────────────────────────────────────────────────
  fs.mkdirSync(OUT_DIR, { recursive: true })

  // ── cells.bin ────────────────────────────────────────────────────────────────
  console.log('\n📦 写入 cells.bin...')
  const cellsBuf  = buildCellsBin(cellDefs)
  fs.writeFileSync(path.join(OUT_DIR, 'cells.bin'), cellsBuf)
  const cellsHash = 'sha256:' + crypto.createHash('sha256').update(cellsBuf).digest('hex')
  console.log(`   ${(cellsBuf.length / 1024).toFixed(1)} KB`)

  // ── global.bin ───────────────────────────────────────────────────────────────
  console.log('📦 写入 global.bin...')
  const globalBuf  = buildGlobalBin(dieW, dieH)
  fs.writeFileSync(path.join(OUT_DIR, 'global.bin'), globalBuf)
  const globalHash = 'sha256:' + crypto.createHash('sha256').update(globalBuf).digest('hex')
  console.log(`   ${globalBuf.length} bytes`)

  // ── manifest.json ────────────────────────────────────────────────────────────
  const manifest = {
    version:     1,
    designName:  'gcd',
    dbuPerMicron: 1000,
    dieArea: { x: 0, y: 0, w: dieW, h: dieH },
    tileConfig: {
      tilePixelSize: TILE_PIXEL_SIZE,
      minZ:          0,
      maxZ,
      rasterMaxZ,
      rasterFormat:  'png',
      vectorFormat:  'bin',
    },
    layers: USED_LAYER_IDS.map((id, idx) => {
      const s = LAYER_STYLES[id]!
      const hex = '#' + s.rgb.map(v => v.toString(16).padStart(2, '0')).join('')
      return {
        id:             idx,
        name:           s.name,
        originalLayerId: id,
        zOrder:         s.zOrder,
        color:          hex,
        alpha:          +(s.alpha / 255).toFixed(2),
      }
    }),
    cellsFile:  { path: 'cells.bin',  size: cellsBuf.length,  hash: cellsHash  },
    globalFile: { path: 'global.bin', size: globalBuf.length, hash: globalHash },
    stats: {
      totalInstances:  cellInsts.length,
      uniqueCellTypes: cellDefs.size,
      totalBoxes,
      minFeatureDbu:   minFeature,
      generatedAt:     new Date().toISOString(),
    },
  }
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log('📦 写入 manifest.json')

  // ── 全局 routing 生成 ────────────────────────────────────────────────────────
  console.log('\n🔌 生成 mock routing...')
  const globalRouting = generateGlobalRouting(cellInsts)
  console.log(`   ${globalRouting.length} 条走线`)

  // ── 生成瓦片 ─────────────────────────────────────────────────────────────────
  console.log('\n🗺  生成瓦片...')
  let rasterCount = 0, vectorCount = 0, emptySkipped = 0

  for (let z = 0; z <= maxZ; z++) {
    const tilesPerSide  = Math.pow(2, z)
    const tileWorldSize = dieMaxSide / tilesPerSide
    const isLowZ        = z <= rasterMaxZ
    let tileCount = 0

    for (let tx = 0; tx < tilesPerSide; tx++) {
      for (let ty = 0; ty < tilesPerSide; ty++) {
        const tbX  =  tx      * tileWorldSize
        const tbY  =  ty      * tileWorldSize
        const tbX2 = (tx + 1) * tileWorldSize
        const tbY2 = (ty + 1) * tileWorldSize

        const tileBounds = { x: tbX, y: tbY, x2: tbX2, y2: tbY2 }

        // 找与此瓦片相交的 instances
        const visible = cellInsts.filter(inst =>
          inst.originX           < tbX2 &&
          inst.originX + inst.bboxW > tbX  &&
          inst.originY           < tbY2 &&
          inst.originY + inst.bboxH > tbY
        )

        const hasRouting = globalRouting.some(w =>
          w.x < tileBounds.x2 && w.x + w.w > tileBounds.x &&
          w.y < tileBounds.y2 && w.y + w.h > tileBounds.y
        )
        const hasVectorContent = visible.length > 0 || hasRouting

        // 高 Z：空矢量瓦片不生成文件
        if (!isLowZ && !hasVectorContent) {
          emptySkipped++
          continue
        }

        if (isLowZ) {
          const rasterDir = path.join(OUT_DIR, `tiles/raster/${z}/${tx}`)
          fs.mkdirSync(rasterDir, { recursive: true })
          const pixels = renderRasterTile(visible, cellDefs, tileBounds, tileWorldSize)
          const png    = encodePNG(pixels, TILE_PIXEL_SIZE, TILE_PIXEL_SIZE)
          fs.writeFileSync(path.join(rasterDir, `${ty}.png`), png)
          rasterCount++

          // 与前端「dirty 时低 Z 走矢量」对齐：同时输出 vector bin，便于本地验证
          if (hasVectorContent) {
            const vecDir = path.join(OUT_DIR, `tiles/vector/${z}/${tx}`)
            fs.mkdirSync(vecDir, { recursive: true })
            const flatGroups = getRoutingForTile(globalRouting, tileBounds)
            const bin = buildVectorTile(visible, flatGroups)
            fs.writeFileSync(path.join(vecDir, `${ty}.bin`), bin)
            vectorCount++
          }
        } else {
          const vecDir = path.join(OUT_DIR, `tiles/vector/${z}/${tx}`)
          fs.mkdirSync(vecDir, { recursive: true })
          const flatGroups = getRoutingForTile(globalRouting, tileBounds)
          const bin = buildVectorTile(visible, flatGroups)
          fs.writeFileSync(path.join(vecDir, `${ty}.bin`), bin)
          vectorCount++
        }
        tileCount++
      }
    }

    const total = tilesPerSide * tilesPerSide
    console.log(`   Z=${z} (${isLowZ ? '栅格(+矢量供 dirty)' : '矢量'}): ${tileCount}/${total} tiles`)
  }

  console.log(`\n✅ 完成!`)
  console.log(`   栅格: ${rasterCount} 块  矢量: ${vectorCount} 块  空瓦片跳过: ${emptySkipped}`)
  console.log(`   cell 类型复用率: ${(1 - cellDefs.size / cellInsts.length).toFixed(1)}%`)
  console.log(`   cells.bin vs 展开: ${(cellsBuf.length / 1024).toFixed(0)} KB vs ~${Math.round(totalBoxes * 16 / 1024)} KB`)
  console.log(`\n📁 输出目录: ${OUT_DIR}`)
}

main()
