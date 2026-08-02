import { describe, expect, it } from 'vitest'
import { isFlowRunStepsTerminal } from './flowRunTracker'
import type { FlowRunStep } from './flowRunStore'

function step(
  name: string,
  state: FlowRunStep['state'],
): FlowRunStep {
  return {
    name,
    path: name.toLowerCase(),
    label: name,
    tool: 'ecc',
    state,
    runtime: '',
    peakMemoryMb: 0,
  }
}

describe('isFlowRunStepsTerminal', () => {
  it('is false while any step is still running or pending', () => {
    expect(
      isFlowRunStepsTerminal([
        step('Synthesis', 'success'),
        step('Route', 'running'),
        step('DRC', 'pending'),
      ]),
    ).toBe(false)
    expect(
      isFlowRunStepsTerminal([
        step('Synthesis', 'success'),
        step('Route', 'pending'),
      ]),
    ).toBe(false)
  })

  it('is true when every step succeeded or failed', () => {
    expect(
      isFlowRunStepsTerminal([
        step('Synthesis', 'success'),
        step('Route', 'success'),
      ]),
    ).toBe(true)
    expect(
      isFlowRunStepsTerminal([
        step('Synthesis', 'success'),
        step('Route', 'failed'),
      ]),
    ).toBe(true)
  })

  it('is false for an empty step list so a just-started run is not finished immediately', () => {
    expect(isFlowRunStepsTerminal([])).toBe(false)
  })
})
