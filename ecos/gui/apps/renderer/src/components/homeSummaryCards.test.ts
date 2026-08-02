import { describe, expect, it } from 'vitest'
import appSource from '../App.vue?raw'
import bottomPanelSource from './BottomPanel.vue?raw'
import checklistCardSource from './HomeChecklistSummaryCard.vue?raw'
import qorCardSource from './HomeQorSummaryCard.vue?raw'
import snapshotCardSource from './HomeMetricsSnapshotCard.vue?raw'
import homeViewSource from '../views/HomeView.vue?raw'

describe('home left column fits one screen', () => {
  it('lays the cards out on a grid rather than a scrolling stack', () => {
    expect(homeViewSource).toContain('home-info-grid')
    expect(homeViewSource).toContain('grid-template-rows')
  })

  /* Fixed-length content (parameters, rings, metric values) is sized by its content so
     no card is stretched to match the tallest one beside it; the leftover height goes
     to the one row that can use it, which keeps the column free of both a trailing
     band of background and a scrollbar. */
  it('sizes the fixed rows by content and lets only the snapshot row take the slack', () => {
    expect(homeViewSource).toMatch(
      /\.home-info-grid[\s\S]*?grid-template-rows: min-content min-content minmax\(0, 1fr\)/,
    )
  })

  it('lets the chart tiles absorb snapshot height in equal rows', () => {
    expect(snapshotCardSource).toMatch(
      /\.snapshot-charts\s*\{[^}]*grid-auto-rows: minmax\(0, 1fr\)/,
    )
    expect(snapshotCardSource).toMatch(/\.snapshot-chart-visual\s*\{[^}]*place-items: center/)
    expect(snapshotCardSource).toMatch(/\.snapshot-chart-visual img\s*\{[^}]*max-height: 100%/)
  })

  it('spans the design and snapshot cards across both columns', () => {
    expect(homeViewSource).toContain('.home-info-grid > .design-area')
    expect(homeViewSource).toContain('.home-info-grid > .snapshot-card')
  })
})

describe('summary cards defer detail to the bottom panel', () => {
  it('sends the checklist card into the checklist tab', () => {
    expect(checklistCardSource).toContain("openBottomPanel('checklist')")
  })

  it('sends the QoR card into the qor tab', () => {
    expect(qorCardSource).toContain("openBottomPanel('qor')")
  })

  /* The snapshot lists every metric already, so a second link to the same tab would
     only duplicate the QoR card's. */
  it('leaves the snapshot without a details link of its own', () => {
    expect(snapshotCardSource).not.toContain('card-details-link')
  })

  it('no longer inlines the long lists the cards used to grow with', () => {
    expect(checklistCardSource).not.toContain('ChecklistTable')
    expect(checklistCardSource).not.toContain('attentionGroups')
    expect(qorCardSource).not.toContain('qor-issue-list')
  })

  /* Both cards carry a ring, but they encode different kinds of number: the checklist
     is a composition of twenty-four outcomes, the QoR is one score on a fixed scale.
     The QoR ring therefore needs a total, or it would close the circle at any score
     and contradict the figure printed inside it. */
  it('draws the checklist ring as a composition and the QoR ring as a gauge', () => {
    expect(checklistCardSource).toContain('SummaryDonut')
    expect(checklistCardSource).not.toContain(':total=')
    expect(qorCardSource).toContain(':total="100"')
  })

  it('keeps the QoR ring and its centre figure on the same quantity', () => {
    expect(qorCardSource).toContain("id: 'score'")
    expect(qorCardSource).not.toContain("label: 'Healthy'")
  })

  /* A count sends the reader to the details panel to find out which items it refers
     to; the cards answer that in place instead. */
  it('names what is blocking rather than only counting it', () => {
    expect(checklistCardSource).toContain('blockingItems')
    expect(qorCardSource).toContain('issue.displayName')
  })

  /* The QoR card counts its own gates. Counting the eight metric tiles instead, as it
     once did, told the snapshot's story a second time two cards apart — and put a
     denominator of 8 next to a card whose subject is 5 gates. */
  it('tallies the QoR gates rather than the snapshot metrics', () => {
    expect(qorCardSource).toContain('gateTally.blocked')
    expect(qorCardSource).toContain('gateTally.total')
    expect(qorCardSource).not.toContain('tiles.length')
    expect(qorCardSource).not.toContain('HomeQorMetricTile')
  })

  /* Both counts sit on a `dd` that `.card-fact dd` already colours, so a bare state
     class loses on specificity and the count stays grey however bad it gets. */
  it('qualifies the count state colours so they can win over the neutral rule', () => {
    expect(checklistCardSource).toContain('.checklist-fact dd.checklist-fact--bad')
    expect(qorCardSource).toContain('.qor-fact dd.qor-fact--bad')
  })

  /* Both headers used to repeat what the card already says larger: the checklist's
     22/24 restates the ring, and the QoR's bare 8 had no label at all. */
  it('drops the header counts that restate the card body', () => {
    for (const source of [checklistCardSource, qorCardSource]) {
      expect(source).not.toContain('header-count')
    }
  })

  it('lists every metric in the snapshot table rather than a ranked subset', () => {
    expect(snapshotCardSource).toContain('v-for="tile in tiles"')
    expect(snapshotCardSource).not.toContain('selectKeyMetricRows')
  })
})

describe('bottom panel detail tabs', () => {
  it('offers checklist and qor beside the terminal and flow log', () => {
    expect(bottomPanelSource).toContain("id: 'checklist'")
    expect(bottomPanelSource).toContain("id: 'qor'")
  })

  it('mounts the detail panels only once their tab is selected', () => {
    expect(appSource).toContain(
      '<ChecklistDetailsPanel v-if="bottomPanelTab === \'checklist\'"',
    )
    expect(appSource).toContain('<QorDetailsPanel v-if="bottomPanelTab === \'qor\'"')
  })
})
