import { describe, expect, it } from 'vitest'
import {
  BOTTOM_PANEL_TOP_MARGIN_PX,
  DEFAULT_BOTTOM_PANEL_HEIGHT,
  MIN_BOTTOM_PANEL_HEIGHT_PX,
  clampBottomPanelHeightPx,
  createBottomPanelState,
  useBottomPanel,
} from './useBottomPanel'

describe('clampBottomPanelHeightPx', () => {
  it('keeps a comfortable drag within the minimum and the available area', () => {
    expect(clampBottomPanelHeightPx(320, 800)).toBe(320)
  })

  it('never shrinks below the minimum panel height', () => {
    expect(clampBottomPanelHeightPx(10, 800)).toBe(MIN_BOTTOM_PANEL_HEIGHT_PX)
  })

  it('leaves a strip of the page visible when dragged to the top', () => {
    expect(clampBottomPanelHeightPx(5000, 800)).toBe(800 - BOTTOM_PANEL_TOP_MARGIN_PX)
  })

  it('still yields the minimum height when the available area is tiny', () => {
    expect(clampBottomPanelHeightPx(5000, 40)).toBe(MIN_BOTTOM_PANEL_HEIGHT_PX)
  })

  it('rounds fractional pointer positions', () => {
    expect(clampBottomPanelHeightPx(320.6, 800)).toBe(321)
  })
})

describe('createBottomPanelState', () => {
  it('starts closed on the terminal tab at the default height', () => {
    const panel = createBottomPanelState()

    expect(panel.isOpen.value).toBe(false)
    expect(panel.activeTab.value).toBe('terminal')
    expect(panel.height.value).toBe(DEFAULT_BOTTOM_PANEL_HEIGHT)
    expect(panel.isMaximized.value).toBe(false)
  })

  it('opens the requested tab', () => {
    const panel = createBottomPanelState()

    panel.openBottomPanel('flow-log')

    expect(panel.isOpen.value).toBe(true)
    expect(panel.activeTab.value).toBe('flow-log')
  })

  it('records the flow log step to reveal so the panel can scroll to it', () => {
    const panel = createBottomPanelState()

    panel.openBottomPanel('flow-log', { stepKey: 'route\u001fopenroad' })

    expect(panel.requestedFlowLogStepKey.value).toBe('route\u001fopenroad')
    expect(panel.consumeRequestedFlowLogStepKey()).toBe('route\u001fopenroad')
    expect(panel.requestedFlowLogStepKey.value).toBeNull()
  })

  it('ignores a step key aimed at a tab that cannot show it', () => {
    const panel = createBottomPanelState()

    panel.openBottomPanel('terminal', { stepKey: 'route\u001fopenroad' })

    expect(panel.requestedFlowLogStepKey.value).toBeNull()
  })

  it('switches tabs without closing an open panel', () => {
    const panel = createBottomPanelState()

    panel.openBottomPanel('terminal')
    panel.toggleBottomPanelTab('flow-log')

    expect(panel.isOpen.value).toBe(true)
    expect(panel.activeTab.value).toBe('flow-log')
  })

  it('closes when the already active tab is toggled again', () => {
    const panel = createBottomPanelState()

    panel.openBottomPanel('flow-log')
    panel.toggleBottomPanelTab('flow-log')

    expect(panel.isOpen.value).toBe(false)
  })

  it('reopens on the last active tab after being closed', () => {
    const panel = createBottomPanelState()

    panel.openBottomPanel('flow-log')
    panel.closeBottomPanel()
    panel.toggleBottomPanelTab('flow-log')

    expect(panel.isOpen.value).toBe(true)
    expect(panel.activeTab.value).toBe('flow-log')
  })

  it('restores the dragged height after maximizing and back', () => {
    const panel = createBottomPanelState()

    panel.openBottomPanel('terminal')
    panel.setBottomPanelHeight('420px')
    panel.toggleBottomPanelMaximized()

    expect(panel.isMaximized.value).toBe(true)
    expect(panel.height.value).toBe('100%')

    panel.toggleBottomPanelMaximized()

    expect(panel.isMaximized.value).toBe(false)
    expect(panel.height.value).toBe('420px')
  })

  it('treats a drag as leaving the maximized state', () => {
    const panel = createBottomPanelState()

    panel.toggleBottomPanelMaximized()
    panel.setBottomPanelHeight('300px')

    expect(panel.isMaximized.value).toBe(false)
    expect(panel.height.value).toBe('300px')
  })

  it('reopens at the dragged height rather than the maximized one', () => {
    const panel = createBottomPanelState()

    panel.openBottomPanel('terminal')
    panel.setBottomPanelHeight('420px')
    panel.toggleBottomPanelMaximized()
    panel.closeBottomPanel()

    expect(panel.isMaximized.value).toBe(false)
    expect(panel.height.value).toBe('420px')
  })
})

describe('useBottomPanel', () => {
  it('shares one state instance across callers', () => {
    expect(useBottomPanel()).toBe(useBottomPanel())
  })
})
