import { describe, expect, it } from 'vitest'
import type { FlowStage } from './useFlowStages'
import type { FlowRunRecord, FlowRunStep } from './flowRunStore'
import {
  deckFocusStep,
  failedFlowRunStep,
  flowRunCounts,
  flowRunElapsedMs,
  flowRunReportView,
  flowRunSnapshotReportView,
  flowRunStepElapsedMs,
  runningFlowRunStep,
  slowestFlowRunStep,
  toFlowRunSnapshot,
} from './flowRunReport'

function step(
  name: string,
  state: FlowRunStep['state'],
  overrides: Partial<FlowRunStep> = {},
): FlowRunStep {
  return {
    name,
    path: name.toLowerCase(),
    label: name,
    tool: 'ecc',
    state,
    runtime: '',
    peakMemoryMb: 0,
    ...overrides,
  }
}

function stage(overrides: Partial<FlowStage> = {}): FlowStage {
  return {
    label: 'Synthesis',
    path: 'synthesis',
    icon: 'ri-cpu-line',
    group: 'run',
    state: 'Success',
    runtime: '00:00:18',
    'peak memory (mb)': 412,
    name: 'Synthesis',
    tool: 'yosys',
    ...overrides,
  }
}

function record(overrides: Partial<FlowRunRecord> = {}): FlowRunRecord {
  return {
    id: 'run-1',
    trigger: 'user',
    scope: 'full',
    rerun: false,
    startedAt: 1_000,
    state: 'running',
    steps: [],
    ...overrides,
  }
}

describe('flowRunCounts', () => {
  it('counts only successful steps as done', () => {
    expect(
      flowRunCounts([
        step('a', 'success'),
        step('b', 'failed'),
        step('c', 'pending'),
      ]),
    ).toEqual({ done: 1, total: 3 })
  })

  it('does not divide by zero on an empty run', () => {
    expect(flowRunCounts([])).toEqual({ done: 0, total: 0 })
  })
})

describe('deckFocusStep', () => {
  it('prefers a running step over any failed step', () => {
    expect(
      deckFocusStep([step('Route', 'failed'), step('DRC', 'running')]),
    ).toMatchObject({ mode: 'running', step: { name: 'DRC' } })
  })

  it('falls back to failed only when nothing is still running', () => {
    expect(deckFocusStep([step('Route', 'failed')])).toMatchObject({
      mode: 'failed',
      step: { name: 'Route' },
    })
  })

  it('reports starting when the run has no focus step yet', () => {
    expect(deckFocusStep([])).toEqual({ step: null, mode: 'starting' })
  })
})

describe('runningFlowRunStep / failedFlowRunStep', () => {
  it('finds the first match or returns null', () => {
    const steps = [step('a', 'success'), step('b', 'running'), step('c', 'pending')]
    expect(runningFlowRunStep(steps)?.name).toBe('b')
    expect(failedFlowRunStep(steps)).toBeNull()
    expect(failedFlowRunStep([step('a', 'failed')])?.name).toBe('a')
  })
})

describe('slowestFlowRunStep', () => {
  it('picks the longest readable runtime', () => {
    const slowest = slowestFlowRunStep([
      step('a', 'success', { runtime: '00:00:18' }),
      step('b', 'success', { runtime: '00:01:02' }),
      step('c', 'success', { runtime: '00:00:04' }),
    ])
    expect(slowest?.name).toBe('b')
  })

  it('ignores steps whose runtime cannot be read', () => {
    const slowest = slowestFlowRunStep([
      step('a', 'success', { runtime: 'aa:bb:cc' }),
      step('b', 'success', { runtime: '00:00:04' }),
    ])
    expect(slowest?.name).toBe('b')
  })

  it('returns null when nothing has a runtime', () => {
    expect(slowestFlowRunStep([step('a', 'pending')])).toBeNull()
    expect(slowestFlowRunStep([])).toBeNull()
  })
})

describe('flowRunElapsedMs', () => {
  it('runs against the clock while in flight and freezes once finished', () => {
    expect(flowRunElapsedMs(record(), 4_000)).toBe(3_000)
    expect(flowRunElapsedMs(record({ finishedAt: 3_500 }), 9_000)).toBe(2_500)
  })

  it('clamps a backwards clock to zero', () => {
    expect(flowRunElapsedMs(record({ startedAt: 5_000 }), 1_000)).toBe(0)
  })
})

describe('flowRunStepElapsedMs', () => {
  it('returns null until the step has been observed running', () => {
    expect(flowRunStepElapsedMs(step('a', 'pending'), 5_000)).toBeNull()
    expect(flowRunStepElapsedMs(step('a', 'running', { startedAt: 2_000 }), 5_000)).toBe(
      3_000,
    )
  })
})

describe('toFlowRunSnapshot', () => {
  it('returns null when no step ever ran', () => {
    expect(toFlowRunSnapshot([])).toBeNull()
    expect(toFlowRunSnapshot([stage({ state: 'Unstart' })])).toBeNull()
  })

  it('sums step runtimes rather than claiming a wall clock duration', () => {
    const snapshot = toFlowRunSnapshot([
      stage({ name: 'Synthesis', runtime: '00:00:18' }),
      stage({ name: 'Route', runtime: '00:01:02' }),
    ])

    expect(snapshot?.stepRuntimeSeconds).toBe(80)
    expect(snapshot?.state).toBe('success')
    expect(snapshot?.steps).toHaveLength(2)
  })

  it('reports no total when every runtime is unreadable', () => {
    const snapshot = toFlowRunSnapshot([stage({ runtime: '' })])
    expect(snapshot?.stepRuntimeSeconds).toBeNull()
  })

  it('is failed while some steps are still unstarted', () => {
    const snapshot = toFlowRunSnapshot([
      stage({ name: 'Synthesis', state: 'Success' }),
      stage({ name: 'Route', state: 'Unstart' }),
    ])
    expect(snapshot?.state).toBe('failed')
  })

  it('is running while a step is Ongoing, not failed', () => {
    const snapshot = toFlowRunSnapshot([
      stage({ name: 'Synthesis', state: 'Success' }),
      stage({ name: 'Place', state: 'Ongoing', tool: 'dreamplace' }),
      stage({ name: 'Route', state: 'Unstart' }),
    ])
    expect(snapshot?.state).toBe('running')
  })
})

describe('flowRunReportView', () => {
  it('reports the wall clock duration of a finished run', () => {
    const view = flowRunReportView(
      record({ finishedAt: 253_500, startedAt: 1_000, state: 'success' }),
    )

    expect(view.durationSeconds).toBe(252)
    expect(view.durationIsStepSum).toBe(false)
    expect(view.fromDisk).toBe(false)
  })

  it('has no duration for a run that never finished', () => {
    expect(flowRunReportView(record()).durationSeconds).toBeNull()
  })

  it('titles a single step run after the step, not after the whole flow', () => {
    const view = flowRunReportView(
      record({ scope: 'step', stepPath: 'route', steps: [step('Route', 'success')] }),
    )

    expect(view.title).toBe('Route')
  })

  it('flags a run someone else started', () => {
    expect(flowRunReportView(record({ trigger: 'external' })).external).toBe(true)
    expect(flowRunReportView(record()).external).toBe(false)
  })

  it('carries the counts, the failed step and the slowest step', () => {
    const view = flowRunReportView(
      record({
        steps: [
          step('Synthesis', 'success', { runtime: '00:00:18' }),
          step('Route', 'failed', { runtime: '00:02:58' }),
          step('DRC', 'pending'),
        ],
      }),
    )

    expect({ done: view.done, total: view.total }).toEqual({ done: 1, total: 3 })
    expect(view.failedStep?.name).toBe('Route')
    expect(view.slowestStep?.name).toBe('Route')
  })
})

describe('flowRunSnapshotReportView', () => {
  it('marks its duration as a sum of step runtimes rather than a wall clock', () => {
    const view = flowRunSnapshotReportView({
      steps: [step('Synthesis', 'success', { runtime: '00:00:18' })],
      state: 'success',
      stepRuntimeSeconds: 18,
    })

    expect(view.durationSeconds).toBe(18)
    expect(view.durationIsStepSum).toBe(true)
    expect(view.fromDisk).toBe(true)
  })

  it('never claims a trigger it cannot know', () => {
    const view = flowRunSnapshotReportView({
      steps: [],
      state: 'failed',
      stepRuntimeSeconds: null,
    })

    expect(view.external).toBe(false)
    expect(view.rerun).toBe(false)
  })
})
