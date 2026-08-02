import { describe, expect, it } from 'vitest'
import {
  formatDurationSeconds,
  formatElapsedMs,
  formatPeakMemory,
  parseFlowRuntimeSeconds,
  sumFlowRuntimeSeconds,
} from './duration'

describe('parseFlowRuntimeSeconds', () => {
  it('parses the HH:MM:SS shape flow.json writes', () => {
    expect(parseFlowRuntimeSeconds('00:01:02')).toBe(62)
    expect(parseFlowRuntimeSeconds('01:00:00')).toBe(3600)
    expect(parseFlowRuntimeSeconds('00:00:00')).toBe(0)
  })

  it('returns null for values it cannot read', () => {
    expect(parseFlowRuntimeSeconds('aa:bb:cc')).toBeNull()
    expect(parseFlowRuntimeSeconds('00:01')).toBeNull()
    expect(parseFlowRuntimeSeconds('00:01:02:03')).toBeNull()
    expect(parseFlowRuntimeSeconds('00::02')).toBeNull()
    expect(parseFlowRuntimeSeconds('')).toBeNull()
    expect(parseFlowRuntimeSeconds(undefined)).toBeNull()
    expect(parseFlowRuntimeSeconds(null)).toBeNull()
  })
})

describe('sumFlowRuntimeSeconds', () => {
  it('adds every readable entry and skips the rest', () => {
    expect(sumFlowRuntimeSeconds(['00:01:00', 'aa:bb:cc', '00:00:30'])).toEqual({
      seconds: 90,
      hasValue: true,
    })
  })

  it('reports no value when nothing parsed', () => {
    expect(sumFlowRuntimeSeconds([])).toEqual({ seconds: 0, hasValue: false })
    expect(sumFlowRuntimeSeconds(['', undefined, 'nope'])).toEqual({
      seconds: 0,
      hasValue: false,
    })
  })
})

describe('formatDurationSeconds', () => {
  it('drops the unit that would read as zero', () => {
    expect(formatDurationSeconds(38)).toBe('38s')
    expect(formatDurationSeconds(252)).toBe('4m 12s')
    expect(formatDurationSeconds(3840)).toBe('1h 4m')
  })

  it('clamps negatives so a skewed clock cannot render "-3s"', () => {
    expect(formatDurationSeconds(-5)).toBe('0s')
  })
})

describe('formatElapsedMs', () => {
  it('truncates to whole seconds', () => {
    expect(formatElapsedMs(1999)).toBe('1s')
    expect(formatElapsedMs(252_000)).toBe('4m 12s')
    expect(formatElapsedMs(-1)).toBe('0s')
  })
})

describe('formatPeakMemory', () => {
  it('switches to GB past 1024 MB', () => {
    expect(formatPeakMemory(820)).toBe('820 MB')
    expect(formatPeakMemory(2458)).toBe('2.4 GB')
  })

  it('returns an empty string when there is nothing worth showing', () => {
    expect(formatPeakMemory(0)).toBe('')
    expect(formatPeakMemory(undefined)).toBe('')
    expect(formatPeakMemory(Number.NaN)).toBe('')
  })
})
