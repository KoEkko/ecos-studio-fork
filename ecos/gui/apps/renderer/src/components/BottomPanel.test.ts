import { describe, expect, it } from 'vitest'
import appSource from '../App.vue?raw'
import bottomPanelSource from './BottomPanel.vue?raw'
import flowLogPanelSource from './FlowLogPanel.vue?raw'
import homeViewSource from '../views/HomeView.vue?raw'
import statusBarSource from './StatusBar.vue?raw'

describe('BottomPanel', () => {
  it('is mounted above the status bar and overlays the app content', () => {
    expect(appSource).toMatch(
      /<div\s+class="app-main"[\s\S]*>\s*<div\s+class="app-content"[\s\S]*>\s*<router-view\s*\/>\s*<\/div>\s*<BottomPanel>[\s\S]*<\/BottomPanel>\s*<\/div>\s*<StatusBar/,
    )
    expect(appSource).toMatch(/\.app-main\s*\{[\s\S]*position:\s*relative;/)
    expect(bottomPanelSource).toMatch(
      /\.ecos-bottom-panel\s*\{[\s\S]*position:\s*absolute;/,
    )
    expect(bottomPanelSource).toMatch(/\.ecos-bottom-panel\s*\{[\s\S]*bottom:\s*0;/)
    expect(bottomPanelSource).toMatch(/\.ecos-bottom-panel\s*\{[\s\S]*z-index:\s*\d+;/)
    expect(bottomPanelSource).toMatch(
      /\.ecos-bottom-panel\s*\{[\s\S]*height:\s*var\(--bottom-panel-height,\s*min\(300px,\s*42vh\)\);/,
    )
  })

  it('keeps covered app content reachable with a scroll spacer instead of resizing it', () => {
    expect(appSource).toContain("'--bottom-panel-height': bottomPanelHeight")
    expect(appSource).toContain(
      "'app-content--bottom-panel-safe-area': isBottomPanelOpen",
    )
    expect(appSource).toMatch(
      /\.app-content--bottom-panel-safe-area::after\s*\{[\s\S]*height:\s*var\(--bottom-panel-height\);/,
    )
    expect(appSource).toMatch(
      /\.app-content--bottom-panel-safe-area\s*\{[\s\S]*scroll-padding-bottom:\s*var\(--bottom-panel-height\);/,
    )
    expect(appSource).not.toMatch(/^\s*padding-bottom:\s*var\(--bottom-panel-height\);/m)
  })

  it('owns the drag handle, maximize, and close controls for every tab', () => {
    expect(bottomPanelSource).toContain('class="bottom-panel-resize-handle"')
    expect(bottomPanelSource).toContain('@pointerdown="handleResizePointerDown"')
    expect(bottomPanelSource).toContain(
      "document.body.classList.add('bottom-panel-resizing')",
    )
    expect(bottomPanelSource).toContain(
      "document.body.classList.remove('bottom-panel-resizing')",
    )
    expect(bottomPanelSource).toContain('@click="toggleBottomPanelMaximized"')
    expect(bottomPanelSource).toContain('@click="closeBottomPanel"')
    expect(bottomPanelSource).toContain('clampBottomPanelHeightPx')
  })

  it('exposes a terminal tab and a flow log tab', () => {
    expect(bottomPanelSource).toMatch(/id: 'terminal', label: 'Terminal'/)
    expect(bottomPanelSource).toMatch(/id: 'flow-log', label: 'Flow Log'/)
    expect(bottomPanelSource).toContain('@click="selectBottomPanelTab(tab.id)"')
  })

  it('offers a header slot so each tab can add its own toolbar', () => {
    expect(bottomPanelSource).toContain('id="bottom-panel-actions"')
  })

  it('drives panel state from the shared composable rather than App-local refs', () => {
    expect(appSource).toContain("from '@/composables/useBottomPanel'")
    expect(appSource).not.toContain('const terminalExpanded = ref(false)')
    expect(appSource).not.toContain('function toggleTerminalMaximized()')
    expect(appSource).not.toContain('function handleTerminalHeightChange(')
    expect(bottomPanelSource).toContain("from '@/composables/useBottomPanel'")
  })
})

describe('StatusBar bottom panel entries', () => {
  it('toggles both panel tabs straight from the shared state', () => {
    expect(statusBarSource).toContain("from '@/composables/useBottomPanel'")
    expect(statusBarSource).toContain('@click="toggleBottomPanelTab(entry.tab)"')
    expect(statusBarSource).toMatch(/tab: 'flow-log', label: 'Flow Log'/)
    expect(statusBarSource).toMatch(/tab: 'terminal', label: 'Terminal'/)
    expect(statusBarSource).not.toContain("'toggle-terminal': []")
  })
})

describe('FlowLogPanel', () => {
  it('pairs the persistent step list with the shared code viewer', () => {
    expect(flowLogPanelSource).toContain('FlowLogStepList')
    expect(flowLogPanelSource).toContain('FlowLogCodeViewer')
    expect(flowLogPanelSource).toContain("from '@/utils/flowLogSelection'")
  })

  it('only reads logs from disk once the tab is actually visible', () => {
    expect(flowLogPanelSource).toMatch(
      /const isVisible = computed\(\s*\(\) => isOpen\.value && activeTab\.value === 'flow-log',?\s*\)/,
    )
    expect(flowLogPanelSource).toMatch(
      /watch\(\s*isVisible,[\s\S]*if \(visible\) void ensureFlowLogsLoaded\(\)/,
    )
  })

  it('reveals the step requested by callers outside the panel', () => {
    expect(flowLogPanelSource).toContain('consumeRequestedFlowLogStepKey')
    expect(flowLogPanelSource).toMatch(
      /watch\(\s*\[isVisible, requestedFlowLogStepKey\][\s\S]*onSelectStep\(key\)/,
    )
  })

  it('stops auto-following the live step once a step is pinned', () => {
    expect(flowLogPanelSource).toContain('const hasPinnedStep = ref(false)')
    expect(flowLogPanelSource).toContain(
      'preferLive: Boolean(isFlowRunning) && !hasPinnedStep.value',
    )
    expect(flowLogPanelSource).toMatch(
      /function onJumpLive\(\)[\s\S]*hasPinnedStep\.value = false/,
    )
  })

  // Home used to embed its own step-log viewer. Two viewers reading the same
  // segments drifted apart, so the panel is now the only place logs are read.
  it('is the only owner of the flow step log viewer', () => {
    expect(homeViewSource).not.toContain('FlowLogCodeViewer')
    expect(homeViewSource).not.toContain('flowLogSegments')
    expect(homeViewSource).not.toContain('Flow Step Log')
  })
})
