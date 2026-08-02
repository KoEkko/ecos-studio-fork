import { ensureFlowStagesObservationBound } from './flowStagesObservation'
import { ensureHomeObservationBound } from './homeObservation'
import { ensureQorObservationBound } from './qorObservation'

/**
 * App 级唯一观测入口。幂等。
 *
 * 之后所有 workspace 文件 watch / run-scoped poll / log tail / QoR 刷新
 * 只能经此绑定；UI composable 不得再各自装副作用。
 */
export function bindWorkspaceObservation(): void {
  ensureFlowStagesObservationBound()
  ensureHomeObservationBound()
  ensureQorObservationBound()
}

export { ensureFlowStagesObservationBound } from './flowStagesObservation'
export { ensureHomeObservationBound } from './homeObservation'
export { ensureQorObservationBound, refreshQorObservation } from './qorObservation'
export {
  invalidateObservation,
  subscribeObservationBus,
  type InvalidationReason,
  type ObservationScope,
} from './bus'
