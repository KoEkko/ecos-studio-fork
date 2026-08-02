<script setup lang="ts">
import { ref } from 'vue'
import {
  clampBottomPanelHeightPx,
  useBottomPanel,
  type BottomPanelTab,
} from '@/composables/useBottomPanel'

interface BottomPanelTabDescriptor {
  id: BottomPanelTab
  label: string
  icon: string
}

const BOTTOM_PANEL_TABS: BottomPanelTabDescriptor[] = [
  { id: 'terminal', label: 'Terminal', icon: 'ri-terminal-box-line' },
  { id: 'flow-log', label: 'Flow Log', icon: 'ri-file-list-3-line' },
  { id: 'checklist', label: 'Checklist', icon: 'ri-list-check-2' },
  { id: 'qor', label: 'QoR', icon: 'ri-bar-chart-box-line' },
]

const {
  isOpen,
  activeTab,
  isMaximized,
  selectBottomPanelTab,
  closeBottomPanel,
  setBottomPanelHeight,
  toggleBottomPanelMaximized,
} = useBottomPanel()

const bottomPanel = ref<HTMLElement | null>(null)

let resizePointerTarget: HTMLElement | null = null
let resizePointerId: number | null = null

function handleResizePointerDown(event: PointerEvent) {
  if (event.button !== 0 || isMaximized.value) return
  event.preventDefault()

  resizePointerTarget = event.currentTarget as HTMLElement
  resizePointerId = event.pointerId
  resizePointerTarget.setPointerCapture?.(resizePointerId)
  document.body.classList.add('bottom-panel-resizing')
  window.addEventListener('pointermove', handleResizePointerMove)
  window.addEventListener('pointerup', stopBottomPanelResize)
  window.addEventListener('pointercancel', stopBottomPanelResize)
  window.addEventListener('blur', stopBottomPanelResize)
  handleResizePointerMove(event)
}

function handleResizePointerMove(event: PointerEvent) {
  const parent = bottomPanel.value?.parentElement
  if (!parent) return

  const parentRect = parent.getBoundingClientRect()
  const height = clampBottomPanelHeightPx(
    parentRect.bottom - event.clientY,
    parentRect.height,
  )
  setBottomPanelHeight(`${height}px`)
}

function stopBottomPanelResize() {
  if (resizePointerTarget && resizePointerId !== null) {
    try {
      resizePointerTarget.releasePointerCapture?.(resizePointerId)
    } catch {
      /* Pointer capture may already be released by the browser. */
    }
  }
  resizePointerTarget = null
  resizePointerId = null
  document.body.classList.remove('bottom-panel-resizing')
  window.removeEventListener('pointermove', handleResizePointerMove)
  window.removeEventListener('pointerup', stopBottomPanelResize)
  window.removeEventListener('pointercancel', stopBottomPanelResize)
  window.removeEventListener('blur', stopBottomPanelResize)
}
</script>

<template>
  <section
    v-show="isOpen"
    ref="bottomPanel"
    class="ecos-bottom-panel"
    aria-label="Bottom panel"
  >
    <div
      class="bottom-panel-resize-handle"
      aria-hidden="true"
      @pointerdown="handleResizePointerDown"
    ></div>
    <div class="bottom-panel-header">
      <div class="bottom-panel-tabs" role="tablist" aria-label="Bottom panel tabs">
        <button
          v-for="tab in BOTTOM_PANEL_TABS"
          :key="tab.id"
          class="bottom-panel-tab"
          :class="{ 'bottom-panel-tab--active': tab.id === activeTab }"
          type="button"
          role="tab"
          :aria-selected="tab.id === activeTab"
          @click="selectBottomPanelTab(tab.id)"
        >
          <i :class="tab.icon" aria-hidden="true"></i>
          <span>{{ tab.label }}</span>
        </button>
      </div>
      <!-- Tab contents teleport their own toolbars here so the header stays a single row. -->
      <div id="bottom-panel-actions" class="bottom-panel-actions"></div>
      <div class="bottom-panel-controls">
        <button
          class="bottom-panel-icon-button"
          type="button"
          :title="isMaximized ? 'Restore Panel' : 'Maximize Panel'"
          :aria-label="isMaximized ? 'Restore Panel' : 'Maximize Panel'"
          @click="toggleBottomPanelMaximized"
        >
          <i
            :class="isMaximized ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'"
            aria-hidden="true"
          ></i>
        </button>
        <button
          class="bottom-panel-icon-button"
          type="button"
          title="Close Panel"
          aria-label="Close Panel"
          @click="closeBottomPanel"
        >
          <i class="ri-close-line" aria-hidden="true"></i>
        </button>
      </div>
    </div>
    <div class="bottom-panel-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.ecos-bottom-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 80;
  height: var(--bottom-panel-height, min(300px, 42vh));
  min-height: 160px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color);
  box-shadow: 0 -12px 28px rgba(0, 0, 0, 0.16);
}

.bottom-panel-resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 5px;
  z-index: 2;
  cursor: row-resize;
  background: transparent;
}

.bottom-panel-resize-handle:hover {
  background: color-mix(in srgb, var(--accent-color) 58%, transparent);
}

.bottom-panel-header {
  height: 34px;
  flex: 0 0 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 0 6px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.bottom-panel-tabs {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
}

.bottom-panel-tab {
  height: 26px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: none;
  border-radius: 4px;
  color: var(--text-secondary);
  background: transparent;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.bottom-panel-tab:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.bottom-panel-tab--active {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-color) 16%, transparent);
  box-shadow: inset 0 -2px 0 0 var(--accent-color);
}

.bottom-panel-tab i {
  font-size: 14px;
}

.bottom-panel-actions {
  position: relative;
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.bottom-panel-controls {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.bottom-panel-icon-button {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  color: var(--text-primary);
  background: transparent;
  cursor: pointer;
}

.bottom-panel-icon-button:hover {
  background: color-mix(in srgb, var(--text-primary) 10%, transparent);
}

.bottom-panel-icon-button:focus-visible,
.bottom-panel-tab:focus-visible {
  outline: 1px solid var(--accent-color);
  outline-offset: -1px;
}

.bottom-panel-icon-button i {
  font-size: 16px;
}

.bottom-panel-body {
  flex: 1;
  min-height: 0;
  display: flex;
  background: var(--bg-primary);
}

:global(body.bottom-panel-resizing),
:global(body.bottom-panel-resizing *) {
  cursor: row-resize !important;
  user-select: none !important;
  -webkit-user-select: none !important;
}
</style>
