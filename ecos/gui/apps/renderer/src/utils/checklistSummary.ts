import type { ChecklistItem } from '@/composables/useHomeData'
import { normalizeChecklistState } from '@/utils/checklistState'

export interface ChecklistSummaryGroup {
  step: string
  items: ChecklistItem[]
  blockingCount: number
}

export interface ChecklistSummary {
  total: number
  passed: number
  failed: number
  warning: number
  /** Items that have not produced a verdict yet (unavailable / pending / ongoing). */
  outstanding: number
  /** 0-100, share of items that passed. Null when the checklist is empty. */
  completionRate: number | null
  /**
   * Failing items that carry a `block` policy, i.e. real sign-off stoppers. Kept as
   * the items rather than only their count so a caller can name them; the count is
   * derived from this list so the two can never disagree.
   */
  blockingItems: ChecklistItem[]
  blockingCount: number
  /** Failures and warnings grouped by step, worst step first. */
  attentionGroups: ChecklistSummaryGroup[]
}

const EMPTY_SUMMARY: Omit<ChecklistSummary, 'blockingItems' | 'attentionGroups'> = {
  total: 0,
  passed: 0,
  failed: 0,
  warning: 0,
  outstanding: 0,
  completionRate: null,
  blockingCount: 0,
}

function emptySummary(): ChecklistSummary {
  return { ...EMPTY_SUMMARY, blockingItems: [], attentionGroups: [] }
}

function isBlocking(item: ChecklistItem): boolean {
  return item.blocked || item.policy === 'block'
}

export function buildChecklistSummary(
  items: readonly ChecklistItem[] | null | undefined,
): ChecklistSummary {
  if (!items?.length) return emptySummary()

  let passed = 0
  let failed = 0
  let warning = 0
  const byStep = new Map<string, ChecklistItem[]>()
  const blockingItems: ChecklistItem[] = []

  for (const item of items) {
    const state = normalizeChecklistState(item.state)
    if (state === 'success') {
      passed += 1
      continue
    }
    if (state === 'failed') {
      failed += 1
      if (isBlocking(item)) blockingItems.push(item)
    } else if (state === 'warning') warning += 1

    if (state !== 'failed' && state !== 'warning') continue
    const step = item.step || 'Unassigned'
    const group = byStep.get(step)
    if (group) group.push(item)
    else byStep.set(step, [item])
  }

  const attentionGroups = [...byStep.entries()]
    .map(([step, groupItems]) => ({
      step,
      items: groupItems,
      blockingCount: groupItems.filter(isBlocking).length,
    }))
    // Steps that can stop sign-off come first; ties break on how much is wrong.
    .sort((a, b) => b.blockingCount - a.blockingCount || b.items.length - a.items.length)

  return {
    total: items.length,
    passed,
    failed,
    warning,
    outstanding: items.length - passed - failed - warning,
    completionRate: Math.round((passed / items.length) * 100),
    blockingItems,
    blockingCount: blockingItems.length,
    attentionGroups,
  }
}
