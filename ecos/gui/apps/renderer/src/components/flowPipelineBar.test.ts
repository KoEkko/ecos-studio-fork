import { describe, expect, it } from 'vitest'
import type { FlowStage } from '@/composables/useFlowStages'
import {
  flowPipelineProgress,
  flowPipelineStepTone,
  toFlowPipelineSteps,
} from './flowPipelineBar'

function stage(overrides: Partial<FlowStage> = {}): FlowStage {
  return {
    label: 'Synthesis',
    path: 'Synthesis',
    icon: 'ri-cpu-line',
    group: 'run',
    state: 'Success',
    runtime: '00:01:02',
    'peak memory (mb)': 0,
    name: 'Synthesis',
    tool: 'yosys',
    ...overrides,
  }
}

describe('flowPipelineStepTone', () => {
  it('maps the backend state vocabulary onto four tones', () => {
    expect(flowPipelineStepTone('Success')).toBe('success')
    expect(flowPipelineStepTone('Ongoing')).toBe('running')
    expect(flowPipelineStepTone('Invalid')).toBe('failed')
    expect(flowPipelineStepTone('Incomplete')).toBe('failed')
    expect(flowPipelineStepTone('Unstart')).toBe('pending')
  })

  it('accepts the lowercase variants the runtime also emits', () => {
    expect(flowPipelineStepTone('running')).toBe('running')
    expect(flowPipelineStepTone('failed')).toBe('failed')
  })

  it('tolerates the backend typo for incomplete', () => {
    expect(flowPipelineStepTone('Imcomplete')).toBe('failed')
  })

  it('falls back to pending for unknown or empty states', () => {
    expect(flowPipelineStepTone('')).toBe('pending')
    expect(flowPipelineStepTone('something-else')).toBe('pending')
  })
})

describe('toFlowPipelineSteps', () => {
  it('keeps only run stages', () => {
    const steps = toFlowPipelineSteps([
      stage({ path: 'configure', group: 'setup', name: 'Configure', tool: '' }),
      stage({ path: 'Synthesis' }),
    ])

    expect(steps.map((step) => step.path)).toEqual(['Synthesis'])
  })

  it('carries the log identity through so the step can be deep-linked', () => {
    const [step] = toFlowPipelineSteps([stage({ name: 'Synthesis', tool: 'yosys' })])

    expect(step).toMatchObject({ name: 'Synthesis', tool: 'yosys', hasLog: true })
  })

  it('marks unstarted steps as having no log to open', () => {
    const [step] = toFlowPipelineSteps([stage({ state: 'Unstart' })])

    expect(step?.hasLog).toBe(false)
  })

  it('marks failed steps as having a log, since the failure is in it', () => {
    const [step] = toFlowPipelineSteps([stage({ state: 'Invalid' })])

    expect(step?.hasLog).toBe(true)
  })

  it('marks steps without a tool as having no log, since the key would be incomplete', () => {
    const [step] = toFlowPipelineSteps([stage({ tool: '', state: 'Success' })])

    expect(step?.hasLog).toBe(false)
  })
})

describe('flowPipelineProgress', () => {
  it('counts only successful steps as done', () => {
    const steps = toFlowPipelineSteps([
      stage({ path: 'a', state: 'Success' }),
      stage({ path: 'b', state: 'Ongoing' }),
      stage({ path: 'c', state: 'Invalid' }),
      stage({ path: 'd', state: 'Unstart' }),
    ])

    expect(flowPipelineProgress(steps)).toEqual({ total: 4, done: 1, percent: 25 })
  })

  it('returns zero percent for an empty flow instead of NaN', () => {
    expect(flowPipelineProgress([])).toEqual({ total: 0, done: 0, percent: 0 })
  })
})
