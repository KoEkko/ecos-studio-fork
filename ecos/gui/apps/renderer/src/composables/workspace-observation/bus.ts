export type ObservationScope =
  | 'flow'
  | 'home-index'
  | 'home-assets'
  | 'qor'
  | 'parameters'
  | 'logs'
  | 'all'

export type InvalidationReason =
  | 'fs-change'
  | 'step-advance'
  | 'run-started'
  | 'run-finished'
  | 'rerun-reset'
  | 'user-save'
  | 'session-switch'
  | 'resource-version'

export interface ObservationInvalidation {
  scopes: ObservationScope[]
  reason: InvalidationReason
  at: number
}

type Listener = (event: ObservationInvalidation) => void

const listeners = new Set<Listener>()
let epoch = 0

const ALL_SCOPES: ObservationScope[] = [
  'flow',
  'home-index',
  'home-assets',
  'qor',
  'parameters',
  'logs',
]

export function subscribeObservationBus(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function observationEpoch(): number {
  return epoch
}

export function invalidateObservation(
  scopes: ObservationScope | ObservationScope[],
  reason: InvalidationReason,
): void {
  const list = Array.isArray(scopes) ? scopes : [scopes]
  const expanded = list.includes('all')
    ? [...ALL_SCOPES]
    : [...new Set(list)]
  epoch += 1
  const event: ObservationInvalidation = {
    scopes: expanded,
    reason,
    at: Date.now(),
  }
  for (const listener of listeners) {
    try {
      listener(event)
    } catch (err) {
      console.error('[observation-bus] listener failed:', err)
    }
  }
}

export function resetObservationBusForTests(): void {
  listeners.clear()
  epoch = 0
}

export function observationEventIncludes(
  event: ObservationInvalidation,
  scope: ObservationScope,
): boolean {
  return event.scopes.includes(scope) || event.scopes.includes('all')
}
