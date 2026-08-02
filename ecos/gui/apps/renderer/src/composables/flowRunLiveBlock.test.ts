import { describe, expect, it } from 'vitest'
import type { FlowRunRecord, FlowRunStep } from './flowRunStore'
import {
  liveBlockHeadline,
  liveBlockPreviewHint,
  liveBlockTimeLabel,
  toFlowRunLiveView,
} from './flowRunLiveBlock'

const NOW = 1_000_000

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

function record(overrides: Partial<FlowRunRecord> = {}): FlowRunRecord {
  return {
    id: 'run-1',
    trigger: 'user',
    scope: 'full',
    rerun: false,
    startedAt: NOW - 206_000,
    state: 'running',
    steps: [],
    ...overrides,
  }
}

describe('liveBlockHeadline', () => {
  it('names a full run by scope, step, and tool while running', () => {
    expect(liveBlockHeadline({ scope: 'full' }, 'running', step('Route', 'running'))).toBe(
      'Flow · Route · ecc',
    )
  })

  it('marks failure on the step name', () => {
    expect(liveBlockHeadline({ scope: 'full' }, 'failed', step('Route', 'failed'))).toBe(
      'Flow · Route failed · ecc',
    )
  })

  it('drops the Flow prefix for a single-step run', () => {
    expect(liveBlockHeadline({ scope: 'step' }, 'running', step('Route', 'running'))).toBe(
      'Route · ecc',
    )
  })

  it('uses Initializing copy before any step is observed', () => {
    expect(liveBlockHeadline({ scope: 'full' }, 'starting', null)).toBe(
      'Initializing Flow',
    )
  })
})

describe('liveBlockTimeLabel', () => {
  it('pairs step and run clocks while a step is running', () => {
    expect(liveBlockTimeLabel('42s', '3m 26s', 'running')).toBe('Step 42s · Run 3m 26s')
  })

  it('omits the step clock while starting', () => {
    expect(liveBlockTimeLabel('', '0s', 'starting')).toBe('Run 0s')
  })
})

describe('liveBlockPreviewHint', () => {
  it('names the step and tool when waiting on live output', () => {
    expect(liveBlockPreviewHint('running', step('Route', 'running'))).toBe(
      'Waiting for Route output from ecc…',
    )
  })
})

describe('toFlowRunLiveView', () => {
  it('builds the collapsed running surface with a one-line preview', () => {
    const view = toFlowRunLiveView(
      record({
        steps: [step('Route', 'running', { startedAt: NOW - 42_000 })],
      }),
      'INFO: a\nINFO: b\nINFO: c\nINFO: d\nINFO: e\n',
      NOW,
    )

    expect(view.mode).toBe('running')
    expect(view.headline).toBe('Flow · Route · ecc')
    expect(view.timeLabel).toBe('Step 42s · Run 3m 26s')
    expect(view.logLines).toEqual(['INFO: b', 'INFO: c', 'INFO: d', 'INFO: e'])
    expect(view.previewLine).toBe('INFO: e')
    expect(view.canExpand).toBe(true)
  })

  it('forces failed mode onto the failed step and expands error lines', () => {
    const view = toFlowRunLiveView(
      record({
        steps: [step('Route', 'failed', { startedAt: NOW - 60_000 }), step('DRC', 'pending')],
      }),
      'INFO: noise\nERROR: boom\nERROR: again\nINFO: trailing\n',
      NOW,
    )

    expect(view.mode).toBe('failed')
    expect(view.focusStep?.name).toBe('Route')
    expect(view.logLines[0]).toContain('ERROR: boom')
    expect(view.canExpand).toBe(false)
  })

  it('tags rerun and external runs', () => {
    expect(toFlowRunLiveView(record({ rerun: true }), '', NOW).tag).toBe('rerun')
    expect(
      toFlowRunLiveView(record({ trigger: 'external' }), '', NOW).tag,
    ).toBe('elsewhere')
  })
})
