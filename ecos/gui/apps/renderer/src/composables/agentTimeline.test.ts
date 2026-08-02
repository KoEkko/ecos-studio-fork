import { describe, expect, it } from 'vitest'
import {
  applyAgentEvent,
  completeAgentTurn,
  failAgentTurn,
  isAgentTurnPending,
  type AgentAssistantEntry,
  type AgentTimelineEntry,
} from './agentTimeline'

function idFactory(): () => string {
  let counter = 0
  return () => `id-${(counter += 1)}`
}

const clock = () => 1_700_000_000_000

const openTurn: AgentAssistantEntry = {
  kind: 'assistant',
  id: 'a1',
  text: 'Hello',
  status: 'streaming',
  createdAt: 1,
}

describe('applyAgentEvent', () => {
  it('opens a turn when the first chunk arrives with nothing in flight', () => {
    const entries = applyAgentEvent(
      [],
      { type: 'message', text: 'Hi' },
      idFactory(),
      clock,
    )

    expect(entries).toEqual([
      {
        kind: 'assistant',
        id: 'id-1',
        text: 'Hi',
        status: 'streaming',
        createdAt: 1_700_000_000_000,
      },
    ])
  })

  it('appends later chunks to the open turn instead of starting a new bubble', () => {
    const entries = applyAgentEvent(
      [openTurn],
      { type: 'message', text: ' there' },
      idFactory(),
      clock,
    )

    expect(entries).toHaveLength(1)
    expect((entries[0] as AgentAssistantEntry).text).toBe('Hello there')
  })

  it('keeps the turn stamped at the moment it opened, not at the latest chunk', () => {
    const entries = applyAgentEvent(
      [openTurn],
      { type: 'message', text: ' there' },
      idFactory(),
      clock,
    )

    expect((entries[0] as AgentAssistantEntry).createdAt).toBe(1)
  })

  it('starts a new turn once the previous one is closed', () => {
    const closed: AgentTimelineEntry[] = [{ ...openTurn, status: 'done' }]

    const entries = applyAgentEvent(
      closed,
      { type: 'message', text: 'Next' },
      idFactory(),
      clock,
    )

    expect(entries).toHaveLength(2)
    expect((entries[1] as AgentAssistantEntry).status).toBe('streaming')
  })

  it('ignores an empty chunk rather than creating a blank bubble', () => {
    expect(applyAgentEvent([], { type: 'message', text: '' }, idFactory())).toEqual([])
  })

  it('records a tool event as its own entry', () => {
    const entries = applyAgentEvent(
      [openTurn],
      { type: 'tool', text: 'read qor_metrics.json' },
      idFactory(),
      clock,
    )

    expect(entries[1]).toEqual({
      kind: 'tool',
      id: 'id-1',
      text: 'read qor_metrics.json',
      createdAt: 1_700_000_000_000,
    })
  })

  it('marks the open turn as failed on an error event', () => {
    const entries = applyAgentEvent(
      [openTurn],
      { type: 'error', text: 'provider crashed' },
      idFactory(),
      clock,
    )

    expect(entries[0]).toMatchObject({
      status: 'error',
      text: 'Hello\nprovider crashed',
    })
  })

  it('surfaces an error even when no turn is open', () => {
    const entries = applyAgentEvent([], { type: 'error' }, idFactory(), clock)

    expect(entries[0]).toMatchObject({ status: 'error' })
  })

  it('leaves the transcript untouched for status and session events', () => {
    const entries: AgentTimelineEntry[] = [openTurn]

    expect(applyAgentEvent(entries, { type: 'status' }, idFactory())).toEqual(entries)
    expect(applyAgentEvent(entries, { type: 'session' }, idFactory())).toEqual(entries)
  })
})

describe('completeAgentTurn', () => {
  it('closes the open turn', () => {
    expect(completeAgentTurn([openTurn])[0]).toMatchObject({ status: 'done' })
  })

  it('uses the fallback text when nothing streamed', () => {
    const entries = completeAgentTurn([{ ...openTurn, text: '' }], 'done')

    expect(entries[0]).toMatchObject({ text: 'done', status: 'done' })
  })

  it('does nothing when no turn is open', () => {
    const closed: AgentTimelineEntry[] = [{ ...openTurn, status: 'done' }]

    expect(completeAgentTurn(closed)).toEqual(closed)
  })
})

describe('failAgentTurn', () => {
  it('appends a standalone error when no turn is open', () => {
    const entries = failAgentTurn([], 'no provider', idFactory(), clock)

    expect(entries).toEqual([
      {
        kind: 'assistant',
        id: 'id-1',
        text: 'no provider',
        status: 'error',
        createdAt: 1_700_000_000_000,
      },
    ])
  })

  it('fails the open turn in place', () => {
    const entries = failAgentTurn([openTurn], 'timeout', idFactory(), clock)

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ status: 'error', text: 'Hello\ntimeout' })
  })
})

describe('isAgentTurnPending', () => {
  it('is true only while a turn streams', () => {
    expect(isAgentTurnPending([openTurn])).toBe(true)
    expect(isAgentTurnPending([{ ...openTurn, status: 'done' }])).toBe(false)
    expect(isAgentTurnPending([])).toBe(false)
  })
})
