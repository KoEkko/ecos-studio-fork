import { afterEach, describe, expect, it } from 'vitest'
import {
  invalidateObservation,
  observationEpoch,
  resetObservationBusForTests,
  subscribeObservationBus,
} from './bus'

describe('observation bus', () => {
  afterEach(() => {
    resetObservationBusForTests()
  })

  it('notifies listeners with expanded scopes for all', () => {
    const events: string[][] = []
    subscribeObservationBus((event) => {
      events.push(event.scopes)
    })

    invalidateObservation('all', 'step-advance')

    expect(observationEpoch()).toBe(1)
    expect(events[0]).toEqual(
      expect.arrayContaining(['home-assets', 'qor', 'flow', 'logs']),
    )
  })

  it('delivers step-advance to qor subscribers', () => {
    const reasons: string[] = []
    subscribeObservationBus((event) => {
      if (event.scopes.includes('qor')) reasons.push(event.reason)
    })

    invalidateObservation(['home-assets', 'qor'], 'step-advance')
    expect(reasons).toEqual(['step-advance'])
  })
})
