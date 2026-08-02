import { describe, expect, it } from 'vitest'
import type { ChecklistItem } from '@/composables/useHomeData'
import { buildChecklistSummary } from './checklistSummary'

function item(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: 'id',
    step: 'Floorplan',
    category: 'quality_gate',
    owner: 'qor',
    policy: 'warn',
    state: 'pass',
    blocked: false,
    title: 'title',
    summary: 'summary',
    source: {},
    evidence: [],
    ...overrides,
  }
}

describe('buildChecklistSummary', () => {
  it('reports an empty summary without dividing by zero', () => {
    const summary = buildChecklistSummary([])

    expect(summary.total).toBe(0)
    expect(summary.completionRate).toBeNull()
    expect(summary.attentionGroups).toEqual([])
  })

  it('treats a null checklist the same as an empty one', () => {
    expect(buildChecklistSummary(null).completionRate).toBeNull()
  })

  it('counts each verdict and derives a completion rate', () => {
    const summary = buildChecklistSummary([
      item({ id: 'a', state: 'pass' }),
      item({ id: 'b', state: 'pass' }),
      item({ id: 'c', state: 'failed' }),
      item({ id: 'd', state: 'warning' }),
    ])

    expect(summary.total).toBe(4)
    expect(summary.passed).toBe(2)
    expect(summary.failed).toBe(1)
    expect(summary.warning).toBe(1)
    expect(summary.completionRate).toBe(50)
  })

  it('counts items without a verdict as outstanding rather than failed', () => {
    const summary = buildChecklistSummary([
      item({ id: 'a', state: 'pass' }),
      item({ id: 'b', state: 'unavailable' }),
    ])

    expect(summary.outstanding).toBe(1)
    expect(summary.failed).toBe(0)
    expect(summary.attentionGroups).toEqual([])
  })

  it('only counts blocking failures, not blocking warnings', () => {
    const summary = buildChecklistSummary([
      item({ id: 'a', state: 'failed', policy: 'block' }),
      item({ id: 'b', state: 'warning', policy: 'block' }),
      item({ id: 'c', state: 'failed', policy: 'warn' }),
    ])

    expect(summary.blockingCount).toBe(1)
  })

  /* The card names the stoppers, so it needs the items themselves; deriving the count
     from that same list is what stops a name from appearing without being counted. */
  it('keeps the blocking items alongside their count', () => {
    const summary = buildChecklistSummary([
      item({ id: 'a', title: 'Timing sign-off', state: 'failed', policy: 'block' }),
      item({ id: 'b', title: 'Passing check', state: 'pass', policy: 'block' }),
      item({ id: 'c', title: 'Non-blocking failure', state: 'failed', policy: 'warn' }),
    ])

    expect(summary.blockingItems.map((entry) => entry.title)).toEqual(['Timing sign-off'])
    expect(summary.blockingCount).toBe(summary.blockingItems.length)
  })

  it('treats an explicitly blocked item as blocking regardless of policy', () => {
    const summary = buildChecklistSummary([
      item({ id: 'a', state: 'failed', policy: 'warn', blocked: true }),
    ])

    expect(summary.blockingCount).toBe(1)
  })

  it('groups failures and warnings by step, worst step first', () => {
    const summary = buildChecklistSummary([
      item({ id: 'a', step: 'Routing', state: 'warning' }),
      item({ id: 'b', step: 'Routing', state: 'warning' }),
      item({ id: 'c', step: 'Placement', state: 'failed', policy: 'block' }),
      item({ id: 'd', step: 'Synthesis', state: 'pass' }),
    ])

    expect(summary.attentionGroups.map((group) => group.step)).toEqual([
      'Placement',
      'Routing',
    ])
    expect(summary.attentionGroups[0]?.blockingCount).toBe(1)
    expect(summary.attentionGroups[1]?.items).toHaveLength(2)
  })

  it('keeps step-less items out of the named step groups', () => {
    const summary = buildChecklistSummary([item({ id: 'a', step: '', state: 'failed' })])

    expect(summary.attentionGroups[0]?.step).toBe('Unassigned')
  })
})
