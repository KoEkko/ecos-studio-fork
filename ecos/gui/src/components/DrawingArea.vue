<script setup lang="ts">
import { shallowRef, markRaw, watch } from 'vue'
import { useRoute } from 'vue-router'
import { EditorContainer, type Editor } from '@/applications/editor'
import {
  LayoutDataStore,
  LayoutRenderer,
  LayerStyleManager,
  SpatialIndex,
  InteractionManager,
} from '@/applications/editor/layout'
import {
  SelectPlugin,
  MeasurePlugin,
  LayerManagerPlugin,
  HighlightPlugin,
} from '@/applications/editor/plugins'
import type { RawHeaderJSON, RawDataJSON } from '@/applications/editor/layout'
import {
  TileManager,
  TileInteraction,
  ViewportAnimator,
  EditManager,
  PlacementTool,
} from '@/applications/editor/tile'
import DrawingToolbar from './DrawingToolbar.vue'
import { useWorkspace } from '@/composables/useWorkspace'
import { useEDA } from '@/composables/useEDA'
import { useLayoutState } from '@/composables/useLayoutState'
import { getInfoApi } from '@/api/flow'
import { CMDEnum, InfoEnum, StepEnum, ResponseEnum } from '@/api/type'

const route = useRoute()
const { currentProject, sseMessages, stepRefreshCounter } = useWorkspace()
const { getResourceUrl } = useEDA()
const layoutState = useLayoutState()

const editor = shallowRef<Editor | null>(null)

// Layout modules (not reactive — managed imperatively)
let dataStore: LayoutDataStore | null = null
let renderer: LayoutRenderer | null = null
let styleManager: LayerStyleManager | null = null
let spatialIndex: SpatialIndex | null = null
let interactionManager: InteractionManager | null = null
let styleStateUnlisten: (() => void) | null = null
// Tile rendering module
let tileManager: TileManager | null = null
let tileInteraction: TileInteraction | null = null
let viewportAnimator: ViewportAnimator | null = null
let editManager: EditManager | null = null
let placementTool: PlacementTool | null = null

// 记住最近选中的 instance cell 信息，用于 Place 工具
let lastSelectedCellId: number | null = null
let lastSelectedOrient = 0

const stepEnumValues = Object.values(StepEnum)

function getStepEnumFromPath(path: string): StepEnum | undefined {
  return stepEnumValues.find(step => step.toLowerCase() === path.toLowerCase())
}

const onEditorReady = (editorInstance: Editor) => {
  editor.value = editorInstance

  const layerMgrPlugin = editorInstance.getPlugin<LayerManagerPlugin>('layerManager')
  if (layerMgrPlugin) {
    layoutState.layerManager.value = markRaw(layerMgrPlugin)
  }

  const pathParts = route.path.split('/')
  const stage = pathParts[pathParts.length - 1] || 'home'
  handleStageChange(stage)
}

function cleanupLayout(): void {
  if (styleStateUnlisten) {
    styleStateUnlisten()
    styleStateUnlisten = null
  }

  interactionManager?.destroy()
  renderer?.destroy()
  spatialIndex?.clear()
  dataStore?.clear()
  styleManager?.clear()
  placementTool?.destroy()
  editManager?.destroy()
  tileInteraction?.destroy()
  viewportAnimator?.destroy()
  tileManager?.destroy()

  interactionManager = null
  renderer = null
  spatialIndex = null
  dataStore = null
  styleManager = null
  placementTool = null
  editManager = null
  tileInteraction = null
  viewportAnimator = null
  tileManager = null

  layoutState.selectedGroups.value = []
  layoutState.dataStore.value = null
  layoutState.tileSelection.value = null
  layoutState.tileActions.value = null
  layoutState.tileLayers.value = []
  layoutState.tileLayerActions.value = null
  layoutState.tileEditActions.value = null
  layoutState.hasUnsavedEdits.value = false
  layoutState.isPlacementMode.value = false
  layoutState.renderMode.value = 'image'
}

async function loadLayoutData(headerJson: RawHeaderJSON, dataJson: RawDataJSON): Promise<void> {
  const ed = editor.value
  if (!ed?.view) return

  cleanupLayout()

  layoutState.loadingState.value = 'loading'
  layoutState.loadingMessage.value = 'Parsing header...'

  try {
    const t0 = performance.now()

    // 1. Parse data
    dataStore = markRaw(new LayoutDataStore())
    dataStore.loadHeader(headerJson)
    layoutState.dataStore.value = dataStore

    layoutState.loadingMessage.value = 'Parsing layout data...'
    dataStore.loadData(dataJson)

    // 2. Build style manager
    styleManager = markRaw(new LayerStyleManager())
    styleManager.buildFromLayerDefs(dataStore.header!.layerList)
    styleManager.applySnapshot(layoutState.layerStyleSnapshot.value)
    styleStateUnlisten = styleManager.onChange(() => {
      if (styleManager) {
        layoutState.layerStyleSnapshot.value = styleManager.serialize()
      }
    })

    // 3. Build spatial index
    layoutState.loadingMessage.value = 'Building spatial index...'
    spatialIndex = markRaw(new SpatialIndex())
    const allBoxes = Array.from({ length: dataStore.totalGroups }, (_, i) => dataStore!.groups[i].children).flat()
    spatialIndex.buildFromBoxes(allBoxes)

    // 4. Render
    layoutState.loadingMessage.value = 'Rendering layout...'
    renderer = markRaw(new LayoutRenderer())
    renderer.init(ed.view, dataStore, styleManager)

    // 5. Interaction manager
    interactionManager = markRaw(new InteractionManager())
    interactionManager.init(ed.view, dataStore, renderer, spatialIndex)

    interactionManager.onSelectionChange((e) => {
      layoutState.selectedGroups.value = e.selectedGroups
    })

    // 6. Configure plugins
    const selectPlugin = ed.getPlugin<SelectPlugin>('select')
    if (selectPlugin) {
      selectPlugin.configure(interactionManager, renderer)
    }
    const highlightPlugin = ed.getPlugin<HighlightPlugin>('highlight')
    if (highlightPlugin) {
      highlightPlugin.configure(dataStore, renderer)
    }
    const measurePlugin = ed.getPlugin<MeasurePlugin>('measure')
    if (measurePlugin) {
      measurePlugin.setDbuPerMicron(dataStore.dbuPerMicron)
    }
    const layerMgrPlugin = ed.getPlugin<LayerManagerPlugin>('layerManager')
    if (layerMgrPlugin) {
      layerMgrPlugin.configure(dataStore, renderer, styleManager)
      layoutState.layerManager.value = markRaw(layerMgrPlugin)
    }

    // 7. Update world bounds and fit to die area
    const dieArea = dataStore.dieArea
    if (dieArea && dieArea.width > 0) {
      ed.setWorldBounds(dieArea.width, dieArea.height)

      const vp = ed.view!
      const padding = 40
      const sw = ed.size.width - padding * 2
      const sh = ed.size.height - padding * 2
      const scale = Math.min(sw / dieArea.width, sh / dieArea.height)
      vp.scale.set(scale)
      vp.moveCenter(dieArea.x + dieArea.width / 2, dieArea.y + dieArea.height / 2)
    }

    const elapsed = performance.now() - t0
    console.log(`Layout loaded in ${elapsed.toFixed(0)}ms: ${dataStore.totalGroups} groups, ${dataStore.totalBoxes} boxes`)

    layoutState.renderMode.value = 'layout'
    layoutState.loadingState.value = 'ready'
    layoutState.loadingMessage.value = ''
  } catch (err) {
    console.error('Failed to load layout data:', err)
    layoutState.loadingState.value = 'error'
    layoutState.loadingMessage.value = String(err)
    cleanupLayout()
  }
}

async function loadTileLayout(baseUrl: string): Promise<void> {
  const ed = editor.value
  if (!ed?.view) return

  cleanupLayout()

  layoutState.loadingState.value = 'loading'
  layoutState.loadingMessage.value = 'Loading tile manifest...'

  try {
    tileManager = markRaw(new TileManager(ed.view, baseUrl))
    await tileManager.init()

    // ViewportAnimator
    viewportAnimator = markRaw(new ViewportAnimator(ed.view))
    if (tileManager.manifest) {
      viewportAnimator.setManifest(tileManager.manifest)
    }

    // TileInteraction (RBush + hit-test + selection overlay)
    tileInteraction = markRaw(new TileInteraction(
      ed.view,
      tileManager,
      tileManager.cellStore,
      tileManager.globalStore,
    ))

    // EditManager
    editManager = markRaw(new EditManager(tileManager, tileManager.cellStore))
    ed.view.addChild(editManager.editOverlay)

    tileManager.setEditDirtyGetter(() => editManager!.hasUnsavedChanges)

    // 绑定 EditManager → TileInteraction
    tileInteraction.setEditManager(editManager)

    // 挂载 overlays 到 viewport（渲染顺序：edit → ghost → highlight → selection）
    ed.view.addChild(tileInteraction.ghostOverlay)
    ed.view.addChild(tileInteraction.highlightOverlay)
    ed.view.addChild(tileInteraction.selectionOverlay)

    // PlacementTool
    placementTool = markRaw(new PlacementTool(
      ed.view,
      editManager,
      tileManager,
      tileManager.cellStore,
    ))
    ed.view.addChild(placementTool.ghostOverlay)

    // EditManager 变更 → 更新 hasUnsavedEdits
    editManager.onChange(() => {
      layoutState.hasUnsavedEdits.value = editManager?.hasUnsavedChanges ?? false
    })

    // 选中回调 → 更新 Vue 响应式状态 + 记住 cellId 供 Place 使用
    tileInteraction.onSelectionChange((info) => {
      layoutState.tileSelection.value = info
      if (info?.type === 'instance' && info.cellId != null) {
        lastSelectedCellId = info.cellId
        lastSelectedOrient = info.orient ?? 0
      }
    })

    // C 键 → 进入放置模式
    tileInteraction.onRequestPlacement((cellId, orient) => {
      _enterPlacement(cellId, orient)
    })

    // PlacementTool 停用 → 回到 select 模式
    placementTool.onDeactivate(() => {
      layoutState.isPlacementMode.value = false
      tileInteraction?.enable()
    })

    // viewport 缩放时刷新选中框线宽
    ed.view.on('zoomed', () => tileInteraction?.refreshSelectionStroke())

    // 注册 tile 操作回调给 PropertiesPanel 使用
    const mf = tileManager.manifest!
    layoutState.tileDbuPerMicron.value = mf.dbuPerMicron
    layoutState.tileActions.value = {
      clearSelection: () => tileInteraction?.clearSelection(),
      fitToView: () => handleFitToView(),
    }

    // 注册编辑操作
    layoutState.tileEditActions.value = {
      deleteSelected: () => {
        const sel = tileInteraction?.currentSelection
        if (sel?.type === 'instance' && sel.instanceId != null && editManager) {
          editManager.deleteInstance(sel.instanceId)
          tileInteraction?.clearSelection()
        }
      },
      undo: () => editManager?.undo(),
      redo: () => editManager?.redo(),
      startPlacement: (cellId: number, orient?: number) => {
        _enterPlacement(cellId, orient ?? 0)
      },
      cancelPlacement: () => {
        placementTool?.deactivate()
      },
    }

    // 注册图层列表和操作给 LayerPanel 使用
    layoutState.tileLayers.value = mf.layers.map(l => ({
      id: l.id, name: l.name, color: l.color,
      alpha: l.alpha, zOrder: l.zOrder, visible: true,
    }))
    layoutState.tileLayerActions.value = {
      toggleLayer: (id: number) => {
        const vis = !tileManager!.isLayerVisible(id)
        tileManager!.setLayerVisible(id, vis)
        layoutState.tileLayers.value = layoutState.tileLayers.value.map(l =>
          l.id === id ? { ...l, visible: vis } : l,
        )
      },
      showAll: () => {
        for (const l of mf.layers) tileManager!.setLayerVisible(l.id, true)
        layoutState.tileLayers.value = layoutState.tileLayers.value.map(l => ({ ...l, visible: true }))
      },
      hideAll: () => {
        for (const l of mf.layers) tileManager!.setLayerVisible(l.id, false)
        layoutState.tileLayers.value = layoutState.tileLayers.value.map(l => ({ ...l, visible: false }))
      },
    }

    layoutState.renderMode.value = 'layout'
    layoutState.loadingState.value = 'ready'
    layoutState.loadingMessage.value = ''
  } catch (err) {
    console.error('Failed to load tile layout:', err)
    layoutState.loadingState.value = 'error'
    layoutState.loadingMessage.value = String(err)
    cleanupLayout()
  }
}

function _enterPlacement(cellId: number, orient: number): void {
  if (!placementTool || !tileInteraction) return
  tileInteraction.disable()
  tileInteraction.clearSelection()
  tileInteraction.highlightOverlay.clear()
  placementTool.activate(cellId, orient)
  layoutState.isPlacementMode.value = true
}

const handleStageChange = async (stage: string) => {
  if (!editor.value || !stage) return

  const stepEnum = getStepEnumFromPath(stage)
  if (!stepEnum) {
    editor.value.clearBackground()
    cleanupLayout()
    return
  }

  try {
    // Try to load structured layout JSON first
    const layoutResponse = await getInfoApi({
      cmd: CMDEnum.get_info,
      data: { step: stepEnum, id: InfoEnum.layout }
    })

    if (layoutResponse.response === ResponseEnum.success && layoutResponse.data?.info) {
      const info = layoutResponse.data.info

      // Tile-based rendering (highest priority)
      if (info.manifest_url) {
        await loadTileLayout(info.manifest_url)
        return
      }

      // Dev fallback: load mock tile data when no backend data is available
      if (import.meta.env.DEV) {
        console.log('load mock tile data')
        await loadTileLayout('/mock-design')
        return
      }

      // Fallback to image mode
      const imagePath = info.image
      if (imagePath) {
        cleanupLayout()
        const imageUrl = await getResourceUrl(imagePath, currentProject.value?.path || '')
        await editor.value?.setBackgroundImage(imageUrl)
        layoutState.renderMode.value = 'image'
        return
      }
    }

    editor.value?.clearBackground()
    cleanupLayout()
  } catch (error) {
    console.error('Failed to load stage results:', error)
    editor.value?.clearBackground()
    cleanupLayout()
  }
}

watch(() => route.path, (newPath) => {
  const pathParts = newPath.split('/')
  const stage = pathParts[pathParts.length - 1] || 'home'
  handleStageChange(stage)
})

// SSE 通知驱动：subflow/step 通知到达时刷新当前 step 的版图
watch(
  () => sseMessages.value.length,
  async (newLen, oldLen) => {
    if (newLen <= (oldLen ?? 0)) return
    const latest = sseMessages.value[newLen - 1]
    if (!latest || latest.cmd !== 'notify') return

    const notifyId = latest.data?.id as string | undefined
    const sseStep = latest.data?.step as string | undefined
    if (notifyId !== 'subflow' && notifyId !== 'step') return

    const pathParts = route.path.split('/')
    const currentStage = pathParts[pathParts.length - 1] || ''
    if (sseStep && currentStage.toLowerCase() === sseStep.toLowerCase()) {
      await handleStageChange(currentStage)
    }
  }
)

// runFlow 完成后的手动刷新信号（兜底：SSE 通知未就绪时使用）
watch(stepRefreshCounter, () => {
  const pathParts = route.path.split('/')
  const stage = pathParts[pathParts.length - 1] || 'home'
  handleStageChange(stage)
})

// ─── 工具切换 → Tile 交互模式管理 ─────────────────────────────────────────────

function onToolChange(toolId: string): void {
  if (!tileInteraction) return

  // 退出放置模式（如果在）
  placementTool?.deactivate()

  if (toolId === 'select') {
    tileInteraction.enable()
  } else if (toolId === 'place') {
    // 进入放置模式：使用最近选中的 cellId
    if (lastSelectedCellId != null) {
      _enterPlacement(lastSelectedCellId, lastSelectedOrient)
    } else {
      // 没有选过 instance → 回退到 select 模式
      tileInteraction.enable()
    }
  } else {
    tileInteraction.disable()
    tileInteraction.clearSelection()
    tileInteraction.highlightOverlay.clear()
  }
}

// ─── Tile 交互操作 ──────────────────────────────────────────────────────────

function handleFitToView(): void {
  const sel = layoutState.tileSelection.value
  if (!sel || !viewportAnimator) return
  viewportAnimator.fitToBbox({ x: sel.bboxX, y: sel.bboxY, w: sel.bboxW, h: sel.bboxH })
}

// 保留 loadLayoutData 供未来切换回 JSON 模式使用
void loadLayoutData
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <DrawingToolbar :editor="editor" @toolChange="onToolChange" />

    <div class="relative flex-1 overflow-hidden">
      <EditorContainer @ready="onEditorReady" />

      <!-- Loading overlay -->
      <div
        v-if="layoutState.loadingState.value === 'loading'"
        class="absolute inset-0 flex items-center justify-center bg-black/40 z-10"
      >
        <div class="flex flex-col items-center gap-2 text-white/80 text-sm">
          <div class="w-6 h-6 border-2 border-white/30 border-t-white/80 rounded-full animate-spin"></div>
          <span>{{ layoutState.loadingMessage.value || 'Loading...' }}</span>
        </div>
      </div>

      <!-- Error state -->
      <div
        v-if="layoutState.loadingState.value === 'error'"
        class="absolute bottom-4 left-4 px-3 py-2 bg-red-900/80 text-red-200 text-xs rounded z-10"
      >
        Load error: {{ layoutState.loadingMessage.value }}
      </div>

      <!-- Mode indicator -->
      <div
        v-if="layoutState.renderMode.value === 'layout'"
        class="absolute top-2 right-2 px-2 py-1 bg-green-900/60 text-green-300 text-[10px] rounded z-10"
      >
        Layout Mode
      </div>

      <!-- Placement mode indicator -->
      <div
        v-if="layoutState.isPlacementMode.value"
        class="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-emerald-900/80 text-emerald-300 text-xs rounded z-10 flex items-center gap-2"
      >
        <i class="ri-add-circle-line"></i>
        <span>Placement Mode</span>
        <span class="text-emerald-400/60 text-[10px]">Click to place | R rotate | Esc exit</span>
      </div>

      <!-- Selection hint -->
      <div
        v-if="layoutState.tileSelection.value && !layoutState.isPlacementMode.value"
        class="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-800/90 text-slate-200 text-xs rounded z-10 flex items-center gap-3 backdrop-blur-sm pointer-events-none select-none"
      >
        <template v-if="layoutState.tileSelection.value.type === 'instance'">
          <span class="text-slate-400">Del</span><span>Delete instance</span>
          <span class="text-slate-500">|</span>
          <span class="text-slate-400">C</span><span>Copy and place</span>
          <span class="text-slate-500">|</span>
          <span class="text-slate-400">Drag</span><span>Move</span>
        </template>
        <template v-else-if="layoutState.tileSelection.value.type === 'segment'">
          <span class="text-slate-400">Del</span><span>Delete segment</span>
        </template>
        <template v-else>
          <span class="text-slate-400">Esc</span><span>Cancel selection</span>
        </template>
      </div>

      <!-- Unsaved edits indicator -->
      <div
        v-if="layoutState.hasUnsavedEdits.value"
        class="absolute bottom-2 right-2 px-2 py-1 bg-amber-900/60 text-amber-300 text-[10px] rounded z-10"
      >
        Unsaved edits
      </div>
    </div>
  </div>
</template>
