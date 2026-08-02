/**
 * Geometry for the small composition rings on the Home summary cards.
 *
 * The ring is one SVG circle per slice, each drawn with a dash pattern that exposes
 * only its own share of the circumference. Keeping the maths here rather than in the
 * component keeps it testable and stops rounding drift between the two cards.
 */

export type SummaryDonutTone = 'good' | 'warn' | 'bad' | 'neutral'

export interface SummaryDonutSlice {
  id: string
  label: string
  value: number
  tone: SummaryDonutTone
}

export interface SummaryDonutArc extends SummaryDonutSlice {
  /** 0-1 share of the ring taken by this slice. */
  share: number
  dashArray: string
  dashOffset: number
}

/** Hairline gap so neighbouring arcs of similar tone stay distinguishable. */
const ARC_GAP_RATIO = 0.006

export function donutCircumference(radius: number): number {
  return 2 * Math.PI * radius
}

/**
 * @param total Denominator to measure the slices against. Omit it and the slices are
 * a composition: they divide the ring between themselves and always close it. Supply
 * one and the ring becomes a gauge against a fixed scale, leaving whatever the slices
 * do not cover as visible track — which is the only honest way to draw a reading like
 * a score, where the missing part is "not reached" rather than "some other category".
 */
export function buildSummaryDonutArcs(
  slices: readonly SummaryDonutSlice[],
  circumference: number,
  total?: number,
): SummaryDonutArc[] {
  const positive = slices.filter((slice) => slice.value > 0)
  const sum = positive.reduce((running, slice) => running + slice.value, 0)
  const denominator = total !== undefined && total > 0 ? total : sum
  if (sum <= 0 || denominator <= 0 || circumference <= 0) return []

  // A single slice must close the ring, otherwise the gap reads as missing data.
  const gap = positive.length > 1 ? circumference * ARC_GAP_RATIO : 0

  let consumed = 0
  return positive.map((slice) => {
    const share = Math.min(slice.value / denominator, 1)
    const length = Math.max(share * circumference - gap, 0)
    const arc: SummaryDonutArc = {
      ...slice,
      share,
      dashArray: `${length} ${circumference - length}`,
      dashOffset: -consumed,
    }
    consumed += share * circumference
    return arc
  })
}
