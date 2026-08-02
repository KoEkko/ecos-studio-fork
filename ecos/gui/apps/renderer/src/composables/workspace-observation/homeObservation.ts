/**
 * Home 观测绑定入口。
 *
 * Phase 0：控制器仍住在 useHomeData 模块内（资产 loader / log 与 watch 同文件），
 * 但对外只通过本包的 ensure 暴露，且全应用只 bind 一次。
 * Phase 1+ 会把 watch/poll 与 generation 资产迁入本目录并删除 useHomeData 内副作用。
 */
export {
  ensureHomeObservationBound,
  resetHomeObservationForTests,
} from '@/composables/useHomeData'
