import { readonly, ref, type Ref } from 'vue'

export type BottomPanelTab = 'terminal' | 'flow-log' | 'checklist' | 'qor'

export const DEFAULT_BOTTOM_PANEL_HEIGHT = 'min(300px, 42vh)'
export const MIN_BOTTOM_PANEL_HEIGHT_PX = 160
/** Leaves a strip of the page visible so a drag to the top cannot hide the app content. */
export const BOTTOM_PANEL_TOP_MARGIN_PX = 56

export interface OpenBottomPanelOptions {
  /** Flow log step to reveal, as produced by `flowLogStepKey`. */
  stepKey?: string
}

export function clampBottomPanelHeightPx(
  requestedPx: number,
  availablePx: number,
): number {
  const maxHeight = Math.max(
    MIN_BOTTOM_PANEL_HEIGHT_PX,
    Math.floor(availablePx - BOTTOM_PANEL_TOP_MARGIN_PX),
  )
  return Math.max(
    MIN_BOTTOM_PANEL_HEIGHT_PX,
    Math.min(maxHeight, Math.round(requestedPx)),
  )
}

export interface BottomPanelState {
  isOpen: Readonly<Ref<boolean>>
  activeTab: Readonly<Ref<BottomPanelTab>>
  height: Readonly<Ref<string>>
  isMaximized: Readonly<Ref<boolean>>
  requestedFlowLogStepKey: Readonly<Ref<string | null>>
  openBottomPanel: (tab: BottomPanelTab, options?: OpenBottomPanelOptions) => void
  closeBottomPanel: () => void
  selectBottomPanelTab: (tab: BottomPanelTab) => void
  toggleBottomPanelTab: (tab: BottomPanelTab) => void
  setBottomPanelHeight: (height: string) => void
  toggleBottomPanelMaximized: () => void
  consumeRequestedFlowLogStepKey: () => string | null
}

export function createBottomPanelState(): BottomPanelState {
  const isOpen = ref(false)
  const activeTab = ref<BottomPanelTab>('terminal')
  const height = ref(DEFAULT_BOTTOM_PANEL_HEIGHT)
  const isMaximized = ref(false)
  const requestedFlowLogStepKey = ref<string | null>(null)
  // Height the panel returns to after un-maximizing, so maximize never destroys a drag.
  let restoredHeight = DEFAULT_BOTTOM_PANEL_HEIGHT

  function openBottomPanel(
    tab: BottomPanelTab,
    options: OpenBottomPanelOptions = {},
  ): void {
    isOpen.value = true
    activeTab.value = tab
    if (tab === 'flow-log' && options.stepKey) {
      requestedFlowLogStepKey.value = options.stepKey
    }
  }

  function closeBottomPanel(): void {
    isOpen.value = false
    isMaximized.value = false
    height.value = restoredHeight
  }

  function selectBottomPanelTab(tab: BottomPanelTab): void {
    activeTab.value = tab
  }

  function toggleBottomPanelTab(tab: BottomPanelTab): void {
    if (isOpen.value && activeTab.value === tab) {
      closeBottomPanel()
      return
    }
    openBottomPanel(tab)
  }

  function setBottomPanelHeight(next: string): void {
    height.value = next
    restoredHeight = next
    isMaximized.value = false
  }

  function toggleBottomPanelMaximized(): void {
    isMaximized.value = !isMaximized.value
    height.value = isMaximized.value ? '100%' : restoredHeight
  }

  function consumeRequestedFlowLogStepKey(): string | null {
    const stepKey = requestedFlowLogStepKey.value
    requestedFlowLogStepKey.value = null
    return stepKey
  }

  return {
    isOpen: readonly(isOpen),
    activeTab: readonly(activeTab),
    height: readonly(height),
    isMaximized: readonly(isMaximized),
    requestedFlowLogStepKey: readonly(requestedFlowLogStepKey),
    openBottomPanel,
    closeBottomPanel,
    selectBottomPanelTab,
    toggleBottomPanelTab,
    setBottomPanelHeight,
    toggleBottomPanelMaximized,
    consumeRequestedFlowLogStepKey,
  }
}

// The panel is a single app-level surface, so every caller shares one state instance.
const sharedBottomPanelState = createBottomPanelState()

export function useBottomPanel(): BottomPanelState {
  return sharedBottomPanelState
}
