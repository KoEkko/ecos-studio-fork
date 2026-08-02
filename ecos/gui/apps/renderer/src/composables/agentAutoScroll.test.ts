import { describe, expect, it } from 'vitest'
import { STICK_THRESHOLD_PX, shouldStickToBottom } from './agentAutoScroll'

describe('shouldStickToBottom', () => {
  it('sticks while the gap is within the threshold, inclusive', () => {
    expect(shouldStickToBottom(952, 100, 1_052)).toBe(true)
    expect(shouldStickToBottom(1_052 - 100 - STICK_THRESHOLD_PX, 100, 1_052)).toBe(true)
  })

  it('lets go one pixel past the threshold', () => {
    expect(shouldStickToBottom(1_052 - 100 - STICK_THRESHOLD_PX - 1, 100, 1_052)).toBe(
      false,
    )
  })

  it('sticks when the content is shorter than the viewport', () => {
    expect(shouldStickToBottom(0, 400, 120)).toBe(true)
  })

  it('sticks at an exact bottom and at an empty scroller', () => {
    expect(shouldStickToBottom(952, 100, 1_052 - 48)).toBe(true)
    expect(shouldStickToBottom(0, 0, 0)).toBe(true)
  })

  it('honours a caller supplied threshold', () => {
    expect(shouldStickToBottom(0, 100, 200, 0)).toBe(false)
    expect(shouldStickToBottom(0, 100, 200, 100)).toBe(true)
  })
})
