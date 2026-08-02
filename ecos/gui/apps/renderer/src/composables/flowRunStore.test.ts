import { describe, expect, it } from 'vitest'
import {
  createFlowRunStore,
  resolveFlowRunState,
  type FlowRunStep,
} from './flowRunStore'

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

function fixedClock(start = 1_000): { now: () => number; advance: (ms: number) => void } {
  let value = start
  return {
    now: () => value,
    advance: (ms: number) => {
      value += ms
    },
  }
}

describe('resolveFlowRunState', () => {
  it('fails as soon as any step failed', () => {
    expect(
      resolveFlowRunState([step('a', 'success'), step('b', 'failed')]),
    ).toBe('failed')
  })

  it('reports running when a step is still in flight', () => {
    expect(
      resolveFlowRunState([
        step('a', 'success'),
        step('b', 'running'),
        step('c', 'pending'),
      ]),
    ).toBe('running')
  })

  it('succeeds only when every step succeeded', () => {
    expect(resolveFlowRunState([step('a', 'success'), step('b', 'success')])).toBe(
      'success',
    )
    expect(resolveFlowRunState([step('a', 'success'), step('b', 'pending')])).toBe(
      'failed',
    )
  })

  it('treats a run with no steps as failed rather than vacuously successful', () => {
    expect(resolveFlowRunState([])).toBe('failed')
  })
})

describe('flowRunStore', () => {
  it('seeds beginRun with initial steps so the live block can leave starting mode', () => {
    const store = createFlowRunStore({ now: () => 1_000 })
    store.beginRun({
      trigger: 'user',
      scope: 'full',
      rerun: false,
      steps: [step('Synthesis', 'running')],
    })
    expect(store.activeRun.value?.steps).toEqual([
      expect.objectContaining({ label: 'Synthesis', state: 'running', startedAt: 1_000 }),
    ])
  })

  it('appends one record per run so a rerun never overwrites the previous one', () => {
    const store = createFlowRunStore()

    store.beginRun({ trigger: 'user', scope: 'full', rerun: false })
    store.updateRun([step('Synthesis', 'success')])
    store.finishRun()

    store.beginRun({ trigger: 'user', scope: 'full', rerun: true })
    store.updateRun([step('Synthesis', 'running')])

    expect(store.runs.value).toHaveLength(2)
    expect(store.runs.value[0].state).toBe('success')
    expect(store.runs.value[0].rerun).toBe(false)
    expect(store.runs.value[1].state).toBe('running')
    expect(store.runs.value[1].rerun).toBe(true)
  })

  it('never creates a record from a step update alone', () => {
    const store = createFlowRunStore()

    store.updateRun([step('Synthesis', 'success')])
    store.finishRun()

    expect(store.runs.value).toEqual([])
  })

  it('leaves settled records alone once a later run started', () => {
    const store = createFlowRunStore()

    store.beginRun({ trigger: 'user', scope: 'full', rerun: false })
    store.updateRun([step('Synthesis', 'success')])
    store.finishRun()
    const settled = store.runs.value[0]

    store.beginRun({ trigger: 'external', scope: 'full', rerun: false })
    store.updateRun([step('Synthesis', 'failed')])
    store.finishRun()

    expect(store.runs.value[0]).toEqual(settled)
    expect(store.runs.value[1].state).toBe('failed')
  })

  it('exposes only the running record as active', () => {
    const store = createFlowRunStore()
    expect(store.activeRun.value).toBeNull()

    const id = store.beginRun({ trigger: 'user', scope: 'full', rerun: false })
    expect(store.activeRun.value?.id).toBe(id)

    store.updateRun([step('Synthesis', 'success')])
    store.finishRun()
    expect(store.activeRun.value).toBeNull()
  })

  it('does not import a stale failed step until this run has seen it running', () => {
    const store = createFlowRunStore()

    store.beginRun({ trigger: 'user', scope: 'full', rerun: true })
    store.updateRun([
      step('Route', 'failed'),
      step('DRC', 'running'),
    ])

    expect(store.runs.value[0].steps.map((item) => item.state)).toEqual([
      'pending',
      'running',
    ])
  })

  it('keeps a failure that this run actually observed enter running', () => {
    const store = createFlowRunStore()

    store.beginRun({ trigger: 'user', scope: 'full', rerun: false })
    store.updateRun([step('Route', 'running')])
    store.updateRun([step('Route', 'failed')])

    expect(store.runs.value[0].steps[0]).toMatchObject({
      state: 'failed',
      startedAt: expect.any(Number),
    })
  })

  it('stamps a step start time the first time it is seen running and keeps it', () => {
    const clock = fixedClock()
    const store = createFlowRunStore({ now: clock.now })

    store.beginRun({ trigger: 'user', scope: 'full', rerun: false })
    clock.advance(500)
    store.updateRun([step('Synthesis', 'running'), step('Floorplan', 'pending')])
    const stampedAt = store.runs.value[0].steps[0].startedAt

    clock.advance(500)
    store.updateRun([step('Synthesis', 'running'), step('Floorplan', 'pending')])

    expect(stampedAt).toBe(1_500)
    expect(store.runs.value[0].steps[0].startedAt).toBe(1_500)
    expect(store.runs.value[0].steps[1].startedAt).toBeUndefined()
  })

  it('keeps a step start time after the step finished', () => {
    const clock = fixedClock()
    const store = createFlowRunStore({ now: clock.now })

    store.beginRun({ trigger: 'user', scope: 'full', rerun: false })
    store.updateRun([step('Synthesis', 'running')])
    clock.advance(2_000)
    store.updateRun([step('Synthesis', 'success')])

    expect(store.runs.value[0].steps[0].startedAt).toBe(1_000)
  })

  it('records the finish time and an optional failure excerpt', () => {
    const clock = fixedClock()
    const store = createFlowRunStore({ now: clock.now })

    store.beginRun({ trigger: 'user', scope: 'full', rerun: false })
    store.updateRun([step('Route', 'failed')])
    clock.advance(3_000)
    store.finishRun({ stepName: 'Route', tool: 'ecc', lines: ['ERROR: nope'] })

    const run = store.runs.value[0]
    expect(run.finishedAt).toBe(4_000)
    expect(run.state).toBe('failed')
    expect(run.failure).toEqual({
      stepName: 'Route',
      tool: 'ecc',
      lines: ['ERROR: nope'],
    })
  })

  it('ignores a finish with no run in flight', () => {
    const store = createFlowRunStore()
    store.finishRun()
    expect(store.runs.value).toEqual([])
  })

  it('drops every record when the workspace changes', () => {
    const store = createFlowRunStore()
    store.beginRun({ trigger: 'user', scope: 'full', rerun: false })
    store.clearRuns()
    expect(store.runs.value).toEqual([])
    expect(store.activeRun.value).toBeNull()
  })
})
