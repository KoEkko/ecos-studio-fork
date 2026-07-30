// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProjectStepAnalysisPanel from './ProjectStepAnalysisPanel.vue'
import {
  compareSummaryFixture,
  evidenceFixture,
  metricRecordFixture,
  stepSnapshotFixture,
  trendSummaryFixture,
  workspaceSummaryFixture,
} from './projectStepAnalysis.fixture'
import type { ProjectWorkspaceSummary } from '@/utils/projectManagement'

function routeWorkspace(workspaceId: string): ProjectWorkspaceSummary {
  return workspaceSummaryFixture(workspaceId, {
    Route: stepSnapshotFixture({
      summaryStatus: 'blocked',
      hotspotArtifactStatus: 'missing',
      metrics: [
        metricRecordFixture({
          metricName: 'route_drc_count',
          displayName: 'Routing DRC violations',
          value: 12,
          unit: 'count',
        }),
        metricRecordFixture({
          metricName: 'route_wirelength',
          displayName: 'Total wirelength',
          value: 1000,
          unit: 'um',
        }),
      ],
      blockingIssues: [
        {
          step: 'Route',
          metric: 'route_drc_count',
          displayName: 'Routing DRC violations',
          value: 12,
          reason: 'DRC violations remain after detail routing.',
          evidence: evidenceFixture({
            sourceFile: 'analysis/qor_summary.json',
            sourceSelector: 'gates[0]',
            expectedOperator: '<=',
            expectedValue: 0,
            diagnosis: 'Detail routing left 12 shorts on M3.',
          }),
        },
      ],
    }),
  })
}

const routeCompareStep = compareSummaryFixture('Route', [
  {
    id: 'route_wirelength',
    label: 'Total wirelength',
    hint: 'shorter is better',
    points: [
      {
        workspaceId: 'ws_a',
        workspaceName: 'ws_a',
        label: '1000 um',
        value: 1000,
        state: 'good',
      },
      {
        workspaceId: 'ws_b',
        workspaceName: 'ws_b',
        label: '1100 um',
        value: 1100,
        state: 'warn',
      },
    ],
  },
])

function mountPanel(overrides: Record<string, unknown> = {}) {
  const workspaceSummaries = [routeWorkspace('ws_a'), routeWorkspace('ws_b')]
  return mount(ProjectStepAnalysisPanel, {
    props: {
      steps: [routeCompareStep, compareSummaryFixture('DRC')],
      workspaceSummaries,
      qorTrendSummary: trendSummaryFixture(
        [{ workspaceId: 'ws_a' }, { workspaceId: 'ws_b' }],
        'ws_b',
      ),
      projectName: 'demo',
      projectObjective: 'QoR comparison',
      bestWorkspaceId: 'ws_b',
      selectedStep: 'Route' as const,
      selectedWorkspaceId: 'ws_a',
      ...overrides,
    },
  })
}

/** An STA timing path: the artifact reports a severity and an evidence selector. */
function mountStaPanel() {
  return mountPanel({
    steps: [compareSummaryFixture('STA')],
    selectedStep: 'STA' as const,
    workspaceSummaries: [
      workspaceSummaryFixture('ws_a', {
        STA: stepSnapshotFixture({
          step: 'STA',
          timingIssues: [
            {
              issueId: 'setup_0',
              workspaceId: 'ws_a',
              workspaceName: 'ws_a',
              severity: 'critical',
              analysisType: 'setup',
              corner: 'ss_0p72v_125c',
              pathGroup: 'clk',
              checkType: 'max',
              slackNs: -0.42,
              launchClockNetworkDelayNs: 1.2,
              captureClockNetworkDelayNs: 1.35,
              clockNetworkDelayDeltaNs: 0.15,
            },
          ],
        }),
      }),
    ],
  })
}

describe('ProjectStepAnalysisPanel', () => {
  it('badges every flow step with the selected workspace issue count and switches step', async () => {
    const wrapper = mountPanel()

    const rail = wrapper.findAll('.step-rail-item')
    expect(rail).toHaveLength(2)
    expect(rail[0].text()).toContain('Route')
    expect(rail[0].find('.step-rail-mark').classes()).toContain('bad')
    expect(rail[1].find('.step-rail-mark').classes()).toContain('none')

    await rail[1].trigger('click')
    expect(wrapper.emitted('select-step')).toEqual([['DRC']])
  })

  it('leads with a verdict for the selected workspace and step', () => {
    const wrapper = mountPanel()

    const badge = wrapper.get('.verdict-badge')
    expect(badge.text()).toBe('Blocked')
    expect(wrapper.get('.verdict-summary').text()).toBe(
      '2 findings · 1 listed as blocking',
    )
    expect(wrapper.get('.verdict').text()).toContain('2/3')
  })

  it('shows no verdict badge when the artifact reported no status', () => {
    const workspace = workspaceSummaryFixture('ws_a', {
      Route: stepSnapshotFixture({ summaryStatus: null }),
    })
    const wrapper = mountPanel({ workspaceSummaries: [workspace] })

    expect(wrapper.find('.verdict-badge').exists()).toBe(false)
    expect(wrapper.get('.verdict').text()).toContain('Artifacts')
  })

  it('auto-selects the first queued issue and shows all evidence without expanding anything', () => {
    const wrapper = mountPanel()

    expect(wrapper.find('details').exists()).toBe(false)

    const card = wrapper.get('.evidence-card')
    expect(card.classes()).toContain('blocking')
    expect(wrapper.get('.issue-item.selected .issue-title').text()).toBe(
      'Routing DRC violations',
    )

    const facts = card.get('.evidence-facts').text()
    expect(facts).toContain('12 count')
    expect(facts).toContain('0 count')
    expect(facts).toContain('route_drc_count <= 0 count')
    expect(facts).toContain('analysis/qor_summary.json#gates[0]')
    expect(facts).toContain('Detail routing left 12 shorts on M3.')
  })

  it('leads the evidence card with the finding channel, not a severity word', () => {
    const header = mountPanel().get('.evidence-card > header')

    expect(header.get('.evidence-kind').text()).toBe('Blocking issue')
    // The title is the bold line of the selected queue row, so the card does not repeat it.
    expect(header.text()).not.toContain('Routing DRC violations')
    // qor_summary.json lists the finding as blocking but reports no severity for it.
    expect(header.get('.evidence-flag').text()).toBe('blocking')
    expect(header.find('.evidence-severity').exists()).toBe(false)
  })

  it('trails the metric id on the source path instead of giving it its own slot', () => {
    const facts = mountPanel().get('.evidence-facts')

    expect(facts.text()).not.toContain('Metric')
    expect(facts.get('.evidence-metric-id').text()).toBe('route_drc_count')
    expect(facts.text()).toContain('analysis/qor_summary.json#gates[0]')
  })

  it('drops the metric id when the evidence path already names it', () => {
    // The selector spells out issue_id=setup_0, which is also the metric id.
    const facts = mountStaPanel().get('.evidence-facts')

    expect(facts.text()).toContain('analysis/sta_timing_issues.json#issue_id=setup_0')
    expect(facts.find('.evidence-metric-id').exists()).toBe(false)
  })

  it('quotes a severity only for the channels that report one', () => {
    const header = mountStaPanel().get('.evidence-card > header')

    expect(header.get('.evidence-severity').text()).toBe('critical')
    expect(header.find('.evidence-flag').exists()).toBe(false)
  })

  it('omits the threshold rows for findings whose artifact reports none', () => {
    const facts = mountStaPanel().get('.evidence-facts').text()

    expect(facts).not.toContain('Expected')
    expect(facts).not.toContain('Pass condition')
    // The diagnosis still carries what the artifact did report about the path.
    expect(facts).toContain('clock-delay delta 0.15 ns')
  })

  it('renders no evidence card for channels whose artifact adds nothing past the row', async () => {
    const wrapper = mountPanel()

    await wrapper.findAll('.issue-item')[1].trigger('click')

    expect(wrapper.find('.evidence-card').exists()).toBe(false)
    expect(wrapper.find('.pane-empty').exists()).toBe(false)
    // The artifact path stays reachable on the row itself.
    expect(wrapper.findAll('.issue-item')[1].attributes('title')).toContain(
      'analysis/qor_hotspots.json',
    )
  })

  it('highlights the metric row that the selected issue points at', () => {
    const wrapper = mountPanel()

    const highlighted = wrapper.findAll('.metric-row.highlighted')
    expect(highlighted).toHaveLength(1)
    expect(highlighted[0].text()).toContain('Routing DRC violations')
  })

  it('narrows the queue by finding channel and retargets the evidence pane', async () => {
    const wrapper = mountPanel()
    expect(wrapper.findAll('.issue-item')).toHaveLength(2)

    expect(
      wrapper.findAll('.severity-filters button').map((button) => button.text()),
    ).toEqual(['All 2', 'Blocking issue 1', 'Artifact 1'])

    const artifactFilter = wrapper
      .findAll('.severity-filters button')
      .find((button) => button.text().startsWith('Artifact'))
    await artifactFilter?.trigger('click')

    const issues = wrapper.findAll('.issue-item')
    expect(issues).toHaveLength(1)
    expect(issues[0].classes()).toContain('selected')
    expect(issues[0].classes()).not.toContain('blocking')
  })

  it('resets a stale issue filter when the selected step changes', async () => {
    const wrapper = mountPanel()
    const artifactFilter = wrapper
      .findAll('.severity-filters button')
      .find((button) => button.text().startsWith('Artifact'))

    await artifactFilter?.trigger('click')
    await wrapper.setProps({ selectedStep: 'DRC' as const })

    const filters = wrapper.findAll('.severity-filters button')
    expect(filters).toHaveLength(1)
    expect(filters[0].classes()).toContain('selected')
    expect(wrapper.get('.issue-pane .pane-empty').text()).toContain(
      'No findings reported',
    )
    expect(wrapper.get('.evidence-pane > .pane-empty').text()).toContain(
      'No findings reported',
    )
  })

  it('selects the requested issue metric when Dashboard supplies one', () => {
    const wrapper = mountPanel({ selectedIssueMetric: 'analysis/qor_hotspots.json' })

    expect(wrapper.get('.issue-item.selected .issue-title').text()).toBe(
      'QoR hotspots artifact',
    )
  })

  it('switches the evidence card when another issue is picked', async () => {
    const wrapper = mountStaPanel()
    expect(wrapper.get('.evidence-card').text()).toContain('ss_0p72v_125c')

    await wrapper.findAll('.severity-filters button')[0].trigger('click')

    expect(wrapper.get('.issue-item').classes()).toContain('selected')
    expect(wrapper.findAll('.metric-row.highlighted')).toHaveLength(0)
  })

  it('offers workspace switching with per-workspace issue counts', async () => {
    const wrapper = mountPanel()

    const chips = wrapper.findAll('.workspace-chip')
    expect(chips).toHaveLength(2)
    expect(chips[0].classes()).toContain('selected')
    expect(chips[0].get('.chip-count').text()).toBe('2')
    expect(chips[0].get('.chip-count').classes()).toContain('bad')
    expect(chips[1].text()).toContain('base')
    expect(chips[1].text()).toContain('best')

    await chips[1].trigger('click')
    expect(wrapper.emitted('select-workspace')).toEqual([['ws_b']])
  })

  it('keeps cross-workspace comparison collapsed until it is asked for', async () => {
    const wrapper = mountPanel()

    const toggle = wrapper.get('.compare-toggle')
    expect(toggle.text()).toContain('Compare 2 workspaces on Route')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('#step-compare-region').exists()).toBe(false)

    await toggle.trigger('click')

    expect(toggle.attributes('aria-expanded')).toBe('true')
    const region = wrapper.get('#step-compare-region')
    expect(region.findAll('.compare-head')).toHaveLength(2)
    expect(region.get('.compare-metric').text()).toContain('Total wirelength')

    const cells = region.findAll('.compare-cell')
    expect(cells[0].get('strong').text()).toBe('1000 um')
    expect(cells[0].get('small').text()).toBe('-100')
    expect(cells[1].get('small').text()).toBe('base')
  })

  it('exposes the comparison matrix as a semantic grid', async () => {
    const wrapper = mountPanel()
    await wrapper.get('.compare-toggle').trigger('click')

    const grid = wrapper.get('[role="grid"]')
    expect(grid.attributes('aria-colcount')).toBe('3')
    expect(grid.attributes('aria-rowcount')).toBe('2')
    expect(grid.findAll('[role="row"]')).toHaveLength(2)
    expect(grid.findAll('[role="columnheader"]')).toHaveLength(3)
    expect(grid.findAll('[role="rowheader"]')).toHaveLength(1)
    expect(grid.findAll('[role="gridcell"]')).toHaveLength(2)
  })

  it('explains an unanalyzed step instead of rendering an empty workbench', () => {
    const wrapper = mountPanel({ selectedStep: 'DRC' })

    expect(wrapper.get('.verdict-badge').text()).toBe('No analysis')
    expect(wrapper.get('.issue-pane').text()).toContain('No findings reported for DRC')
    expect(wrapper.find('.evidence-card').exists()).toBe(false)
    expect(wrapper.text()).toContain('No V3 metrics were reported for DRC')
  })

  it('renders DRC result and detail availability as separate facts', () => {
    const workspace = workspaceSummaryFixture('ws_a', {
      DRC: stepSnapshotFixture({
        step: 'DRC',
        metrics: [
          metricRecordFixture({
            step: 'DRC',
            metricName: 'drc_count',
            value: 0,
            unit: 'count',
          }),
        ],
      }),
    })
    const wrapper = mountPanel({
      steps: [compareSummaryFixture('DRC')],
      selectedStep: 'DRC' as const,
      workspaceSummaries: [workspace],
    })

    const detail = wrapper.get('[aria-label="DRC rules by layer"] .pane-empty-detail')
    expect(detail.text()).toContain('No rule/layer breakdown')
    expect(detail.text()).toContain('DRC count: 0 · Summary: pass')
    expect(detail.text()).not.toContain('No DRC violations')
  })

  it('marks a missing DRC metrics artifact instead of presenting its path as available', () => {
    const workspace = workspaceSummaryFixture('ws_a', {
      DRC: stepSnapshotFixture({
        step: 'DRC',
        artifactStatus: 'missing',
        summaryArtifactStatus: 'missing',
        hotspotArtifactStatus: 'missing',
        summaryStatus: null,
      }),
    })
    const wrapper = mountPanel({
      steps: [compareSummaryFixture('DRC')],
      selectedStep: 'DRC' as const,
      workspaceSummaries: [workspace],
    })

    const source = wrapper.get('[aria-label="DRC rules by layer"] .pane-header small')
    expect(source.text()).toBe('QoR metrics: missing')
    expect(source.attributes('title')).toBe('analysis/qor_metrics.json: missing')
  })
})
