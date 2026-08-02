import { describe, expect, it } from 'vitest'
import { mergeAgentFeed } from './agentFeed'
import type { AgentTimelineEntry } from './agentTimeline'
import type { FlowRunRecord } from './flowRunStore'
import type { FlowRunSnapshot } from './flowRunReport'

function message(id: string, createdAt: number): AgentTimelineEntry {
  return { kind: 'user', id, text: id, createdAt }
}

function run(
  id: string,
  startedAt: number,
  state: FlowRunRecord['state'] = 'success',
): FlowRunRecord {
  return {
    id,
    trigger: 'user',
    scope: 'full',
    rerun: false,
    startedAt,
    finishedAt: startedAt + 1_000,
    state,
    steps: [],
  }
}

const snapshot: FlowRunSnapshot = {
  steps: [],
  state: 'success',
  stepRuntimeSeconds: 120,
}

describe('buildAgentFeed', () => {
  it('interleaves conversation and run reports by time', () => {
    const items = mergeAgentFeed(
      [message('m1', 100), message('m2', 300)],
      [run('r1', 200)],
      null,
    )

    expect(items.map((item) => item.id)).toEqual(['m1', 'r1', 'm2'])
  })

  it('leaves the run in flight out so it only shows in the deck', () => {
    const items = mergeAgentFeed([], [run('r1', 100, 'running')], null)

    expect(items).toEqual([])
  })

  it('still reports earlier runs while a new one is in flight', () => {
    const items = mergeAgentFeed(
      [],
      [run('r1', 100), run('r2', 500, 'running')],
      null,
    )

    expect(items.map((item) => item.id)).toEqual(['r1'])
  })

  it('shows the disk snapshot first when nothing has run this session', () => {
    const items = mergeAgentFeed([message('m1', 100)], [], snapshot)

    expect(items.map((item) => item.kind)).toEqual(['snapshot', 'message'])
  })

  it('drops the disk snapshot once a real run has something to report', () => {
    const items = mergeAgentFeed([], [run('r1', 100)], snapshot)

    expect(items.map((item) => item.kind)).toEqual(['run'])
  })

  it('hides the disk snapshot while the first run of the session is still going', () => {
    const items = mergeAgentFeed([], [run('r1', 100, 'running')], snapshot)

    expect(items).toEqual([])
  })

  it('shows the disk snapshot when nothing is running and no settled runs yet', () => {
    const items = mergeAgentFeed([], [], snapshot)

    expect(items.map((item) => item.kind)).toEqual(['snapshot'])
  })

  it('still shows an incomplete disk snapshot as failed when nothing is running', () => {
    const partialSnapshot: FlowRunSnapshot = {
      steps: [],
      state: 'failed',
      stepRuntimeSeconds: 60,
    }
    const items = mergeAgentFeed([], [], partialSnapshot)

    expect(items[0]?.kind).toBe('snapshot')
    if (items[0]?.kind === 'snapshot') {
      expect(items[0].snapshot.state).toBe('failed')
    }
  })

  it('orders a message ahead of the run it kicked off in the same millisecond', () => {
    const items = mergeAgentFeed([message('m1', 100)], [run('r1', 100)], null)

    expect(items.map((item) => item.id)).toEqual(['m1', 'r1'])
  })

  it('shows only one run card for a completed run instead of also replaying the disk snapshot', () => {
    const items = mergeAgentFeed([], [run('r1', 100)], snapshot)

    expect(items.filter((item) => item.kind === 'run')).toHaveLength(1)
    expect(items.some((item) => item.kind === 'snapshot')).toBe(false)
  })

  it('is empty with nothing to show', () => {
    expect(mergeAgentFeed([], [], null)).toEqual([])
  })
})
