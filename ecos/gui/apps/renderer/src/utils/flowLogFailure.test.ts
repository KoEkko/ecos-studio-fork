import { describe, expect, it } from 'vitest'
import { extractFailureLines, extractTailLines } from './flowLogFailure'

describe('extractFailureLines', () => {
  it('keeps a contiguous ERROR block instead of only the final line', () => {
    const log = [
      'INFO: starting route',
      'WARN: congestion high',
      'ERROR: 1204 DRC violations on metal3',
      'ERROR: routing failed after 3 iterations',
      'INFO: cleaning up',
    ].join('\n')

    expect(extractFailureLines(log, 3)).toEqual([
      'ERROR: 1204 DRC violations on metal3',
      'ERROR: routing failed after 3 iterations',
      'INFO: cleaning up',
    ])
  })

  it('falls back to the last non-empty lines when nothing looks like an error', () => {
    const log = 'INFO: a\nINFO: b\nINFO: c\nINFO: d\n'
    expect(extractFailureLines(log, 3)).toEqual(['INFO: b', 'INFO: c', 'INFO: d'])
  })

  it('returns an empty list for blank input', () => {
    expect(extractFailureLines('')).toEqual([])
    expect(extractFailureLines('\n\n')).toEqual([])
  })

  it('recognises FATAL and bracketed error markers', () => {
    expect(extractFailureLines('[ERROR] boom\nok', 2)).toEqual(['[ERROR] boom', 'ok'])
    expect(extractFailureLines('FATAL: out of memory', 1)).toEqual([
      'FATAL: out of memory',
    ])
    expect(extractFailureLines('tool error: bad netlist', 1)).toEqual([
      'tool error: bad netlist',
    ])
  })
})

describe('extractTailLines', () => {
  it('keeps only the newest non-empty lines', () => {
    expect(extractTailLines('a\n\nb\nc\nd', 2)).toEqual(['c', 'd'])
  })
})
