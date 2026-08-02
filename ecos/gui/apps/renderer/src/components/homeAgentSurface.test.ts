import { describe, expect, it } from 'vitest'
import agentFeedSource from './AgentFeed.vue?raw'
import agentInputSource from './AgentInput.vue?raw'
import agentPanelSource from './AgentPanel.vue?raw'
import aiChatPanelSource from './AIChatPanel.vue?raw'
import statusBarSource from './StatusBar.vue?raw'
import homeViewSource from '../views/HomeView.vue?raw'

describe('agent surface wiring', () => {
  it('drives the step page chat from the real agent instead of a local mock', () => {
    expect(aiChatPanelSource).toContain('useAgent')
    expect(aiChatPanelSource).not.toContain('messageStore.addMessage')
    expect(aiChatPanelSource).not.toContain('TODO')
  })

  it('shares the feed and input between home and the step page', () => {
    for (const source of [agentPanelSource, aiChatPanelSource]) {
      expect(source).toContain('AgentFeed')
      expect(source).toContain('AgentInput')
    }
  })

  it('keeps the step page rendering workspace reports alongside the conversation', () => {
    expect(aiChatPanelSource).toContain('MessageItem')
  })

  /*
   * A run report belongs to the workspace, not to a step page. Passing runs into the
   * step-page feed would replay the same run in two places at once.
   */
  it('keeps flow run reports out of the step page chat', () => {
    expect(aiChatPanelSource).not.toContain(':runs=')
    expect(aiChatPanelSource).not.toContain('flowRunStore')
  })

  it('pins the feed above the input and mounts the live block inside the feed', () => {
    const feed = agentPanelSource.indexOf('<AgentFeed')
    const input = agentPanelSource.indexOf('<AgentInput')

    expect(feed).toBeGreaterThanOrEqual(0)
    expect(feed).toBeLessThan(input)
    expect(agentPanelSource).not.toContain('AgentRunDeck')
    expect(agentFeedSource).toContain('FlowRunLiveBlock')
    expect(agentFeedSource).toContain('agent-feed-live')
    expect(agentFeedSource).toContain('position: sticky')
  })

  it('renders the live block only while a run is in flight', () => {
    expect(agentPanelSource).toContain(':active-run="activeRun"')
    expect(agentFeedSource).toContain('v-if="activeRun"')
  })

  it('lets a step in a run report deep-link into the bottom log panel', () => {
    expect(agentFeedSource).toContain('openFlowLog')
    expect(agentPanelSource).toContain("openBottomPanel('flow-log'")
  })

  it('follows new content only when the reader is already at the bottom', () => {
    expect(agentFeedSource).toContain('shouldStickToBottom')
    expect(agentFeedSource).toContain('stuckToBottom')
    expect(agentPanelSource).toContain('feedRef.value?.scrollToBottom()')
  })

  it('sends on Enter and keeps Shift+Enter for a newline', () => {
    expect(agentInputSource).toContain("event.key !== 'Enter' || event.shiftKey")
  })

  it('keeps slash-command suggestions above the input box', () => {
    expect(agentInputSource).toContain('filterSlashSuggestions')
    expect(agentInputSource).toContain('agent-slash-menu')
  })

  it('routes slash commands from the home assistant without requiring a provider', () => {
    expect(agentPanelSource).toContain('parseSlashCommand')
    expect(agentPanelSource).toContain('runAllFlow')
    expect(agentPanelSource).toContain('handleSlash')
  })

  it('feeds the live block log text from home data', () => {
    expect(agentPanelSource).toContain('activeRunLogText')
    expect(agentPanelSource).toContain('flowLogContentByKey')
  })

  it('surfaces the active run on the status bar as a jump into Assistant', () => {
    expect(statusBarSource).toContain('activeRun')
    expect(statusBarSource).toContain('requestAssistantFocus')
    expect(statusBarSource).toContain('status-live-run')
  })
})

describe('home layout', () => {
  it('keeps run controls in the assistant header instead of a separate progress bar', () => {
    expect(homeViewSource).not.toContain('<FlowPipelineBar')
    expect(agentPanelSource).toContain('handleRunFlow')
    expect(agentPanelSource).toContain('Run Flow')
  })

  it('gives the agent its own column beside the information column', () => {
    expect(homeViewSource).toContain('home-info-column')
    expect(homeViewSource).toContain('<AgentPanel />')
  })

  it('orders the left column as design, checklist, qor, then snapshot', () => {
    const order = [
      'design-area',
      'HomeChecklistSummaryCard',
      'HomeQorSummaryCard',
      'HomeMetricsSnapshotCard',
    ].map((marker) =>
      homeViewSource.indexOf(`<${marker}`) >= 0
        ? homeViewSource.indexOf(`<${marker}`)
        : homeViewSource.indexOf(marker),
    )

    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(order.every((index) => index >= 0)).toBe(true)
  })

  it('keeps the configuration and the layout thumbnail on one card', () => {
    expect(homeViewSource).toContain('design-body')
    expect(homeViewSource).not.toContain('layout-area')
    expect(homeViewSource.indexOf('info-grid')).toBeLessThan(
      homeViewSource.indexOf('design-layout'),
    )
  })

  it('no longer renders the removed runtime monitoring section', () => {
    expect(homeViewSource).not.toContain('Runtime Monitoring')
    expect(homeViewSource).not.toContain('monitorData')
  })
})
