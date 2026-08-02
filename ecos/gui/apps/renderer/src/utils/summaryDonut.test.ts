import { describe, expect, it } from 'vitest'
import {
  buildSummaryDonutArcs,
  donutCircumference,
  type SummaryDonutSlice,
} from './summaryDonut'

const CIRCUMFERENCE = 100

function slice(id: string, value: number): SummaryDonutSlice {
  return { id, label: id, value, tone: 'neutral' }
}

describe('buildSummaryDonutArcs', () => {
  it('lays the arcs end to end in the order they were given', () => {
    const arcs = buildSummaryDonutArcs(
      [slice('a', 50), slice('b', 30), slice('c', 20)],
      CIRCUMFERENCE,
    )

    expect(arcs.map((arc) => arc.id)).toEqual(['a', 'b', 'c'])
    expect(arcs.map((arc) => arc.dashOffset)).toEqual([-0, -50, -80])
    expect(arcs.map((arc) => arc.share)).toEqual([0.5, 0.3, 0.2])
  })

  it('drops slices with nothing to show', () => {
    const arcs = buildSummaryDonutArcs(
      [slice('a', 3), slice('b', 0), slice('c', 1)],
      CIRCUMFERENCE,
    )

    expect(arcs.map((arc) => arc.id)).toEqual(['a', 'c'])
    expect(arcs[1]?.dashOffset).toBe(-75)
  })

  it('closes the ring when a single slice holds everything', () => {
    const [arc] = buildSummaryDonutArcs([slice('a', 7)], CIRCUMFERENCE)

    expect(arc?.dashArray).toBe(`${CIRCUMFERENCE} 0`)
    expect(arc?.share).toBe(1)
  })

  it('separates neighbouring arcs with a hairline gap', () => {
    const [first] = buildSummaryDonutArcs([slice('a', 1), slice('b', 1)], CIRCUMFERENCE)

    expect(first && Number(first.dashArray.split(' ')[0])).toBeLessThan(50)
    expect(first && Number(first.dashArray.split(' ')[0])).toBeGreaterThan(49)
  })

  it('measures against an explicit total and leaves the rest as track', () => {
    const [arc] = buildSummaryDonutArcs([slice('score', 57)], CIRCUMFERENCE, 100)

    const [drawn, gap] = (arc?.dashArray ?? '').split(' ').map(Number)

    expect(arc?.share).toBeCloseTo(0.57, 5)
    expect(drawn).toBeCloseTo(57, 5)
    expect(gap).toBeCloseTo(43, 5)
  })

  /* A reading above its own scale fills the ring rather than wrapping past twelve
     o'clock and drawing a second lap over the first. */
  it('clamps a slice that overshoots the total', () => {
    const [arc] = buildSummaryDonutArcs([slice('score', 130)], CIRCUMFERENCE, 100)

    expect(arc?.share).toBe(1)
    expect(arc?.dashArray).toBe(`${CIRCUMFERENCE} 0`)
  })

  it('yields nothing when there is no data at all', () => {
    expect(buildSummaryDonutArcs([], CIRCUMFERENCE)).toEqual([])
    expect(buildSummaryDonutArcs([slice('a', 0)], CIRCUMFERENCE)).toEqual([])
  })
})

describe('donutCircumference', () => {
  it('matches the circle the component draws', () => {
    expect(donutCircumference(20)).toBeCloseTo(125.66, 2)
  })
})
