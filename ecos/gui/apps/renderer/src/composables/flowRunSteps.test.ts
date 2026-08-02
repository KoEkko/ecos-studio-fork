import { describe, expect, it } from 'vitest'
import type { FlowStage } from './useFlowStages'
import { toFlowRunSteps } from './flowRunSteps'

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

describe('toFlowRunSteps', () => {
  it('keeps only the run group', () => {
    const steps = toFlowRunSteps([
      stage({ group: 'setup', name: 'Home', label: 'Home' }),
      stage({ group: 'run', name: 'Synthesis' }),
    ])

    expect(steps.map((step) => step.name)).toEqual(['Synthesis'])
  })

  it('keeps pending steps so the report can show a total', () => {
    const steps = toFlowRunSteps([
      stage({ name: 'Synthesis', state: 'Success' }),
      stage({ name: 'Route', state: 'Unstart' }),
    ])

    expect(steps.map((step) => step.state)).toEqual(['success', 'pending'])
  })

  it('normalises every spelling flow.json uses for a broken step', () => {
    const steps = toFlowRunSteps([
      stage({ name: 'a', state: 'Invalid' }),
      stage({ name: 'b', state: 'Incomplete' }),
      stage({ name: 'c', state: 'Imcomplete' }),
      stage({ name: 'd', state: 'Ongoing' }),
    ])

    expect(steps.map((step) => step.state)).toEqual([
      'failed',
      'failed',
      'failed',
      'running',
    ])
  })

  it('carries runtime and peak memory through, defaulting memory to zero', () => {
    const [withMemory, withoutMemory] = toFlowRunSteps([
      stage({ name: 'a' }),
      stage({ name: 'b', 'peak memory (mb)': undefined as unknown as number }),
    ])

    expect(withMemory.runtime).toBe('00:00:18')
    expect(withMemory.peakMemoryMb).toBe(412)
    expect(withoutMemory.peakMemoryMb).toBe(0)
  })
})
