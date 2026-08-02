import { computed, watch } from 'vue'
import { useWorkspace } from './useWorkspace'
import { useFlowStages } from './useFlowStages'
import { useHomeData } from './useHomeData'
import { isFlowExecutionActiveForWorkspace } from './useFlowRunner'
import {
  useFlowRunStore,
  type FlowRunFailure,
  type FlowRunStep,
} from './flowRunStore'
import { failedFlowRunStep } from './flowRunReport'
import { toFlowRunSteps } from './flowRunSteps'
import { flowLogStepKey } from '@/utils/flowLogSelection'
import { extractFailureLines } from '@/utils/flowLogFailure'

let tracking = false

/**
 * Active run is done when every step is success or failed — no running, no leftover
 * pending. Used to finish a stuck deck even if localRunActive never clears.
 */
export function isFlowRunStepsTerminal(steps: readonly FlowRunStep[]): boolean {
  if (steps.length === 0) return false
  return steps.every((step) => step.state === 'success' || step.state === 'failed')
}

/**
 * 把 flow 的运行过程记成条目。必须挂在应用级（App.vue）：单步运行可以从 step 页
 * 发起，Home 卸载之后仍然要记录。
 *
 * 起跑由 `useFlowRunner` 登记，因为只有它知道发起方和 rerun 参数；收尾放在这里，
 * 因为只有等 flow.json 落定才能判断终态。
 */
export function useFlowRunTracking(): void {
  if (tracking) return
  tracking = true

  const store = useFlowRunStore()
  const { currentProject } = useWorkspace()
  const { flowStages, hasOngoingRunStage, refreshFlowStages } = useFlowStages()
  const { flowLogContentByKey } = useHomeData()

  const localRunActive = computed(() =>
    isFlowExecutionActiveForWorkspace(currentProject.value?.path),
  )
  // flow.json 落后于本地状态，两个信号都归零才算真的停了。
  const runActive = computed(() => localRunActive.value || hasOngoingRunStage.value)

  function stepsForActiveRun(): FlowRunStep[] {
    const steps = toFlowRunSteps(flowStages.value)
    const run = store.activeRun.value
    if (run?.scope !== 'step' || !run.stepPath) return steps
    const wanted = run.stepPath.toLowerCase()
    return steps.filter((step) => step.path.toLowerCase() === wanted)
  }

  function failureForSteps(steps: readonly FlowRunStep[]): FlowRunFailure | undefined {
    const failed = failedFlowRunStep(steps)
    if (!failed?.tool) return undefined
    const logText =
      flowLogContentByKey.value[
        flowLogStepKey({ stepName: failed.name, tool: failed.tool })
      ] ?? ''
    return {
      stepName: failed.name,
      tool: failed.tool,
      lines: extractFailureLines(logText, 3),
    }
  }

  function finishActiveRun(): void {
    if (!store.activeRun.value) return
    const steps = stepsForActiveRun()
    store.updateRun(steps)
    store.finishRun(failureForSteps(steps))
  }

  watch(runActive, (active, wasActive) => {
    if (active === wasActive) return
    if (active) {
      // 本地发起的运行已经由 useFlowRunner 登记过。走到这里还没有记录，说明是
      // 另一个窗口或终端触发的。只在 flow.json 真有 Ongoing 时建 external，
      // 避免 markFlowExecutionActive 的 bookkeeping 单独顶出一条永远收不掉的 deck。
      if (store.activeRun.value) return
      if (!hasOngoingRunStage.value) return
      // 乐观 UI 可能在 beginRun 之前就把 hasOngoingRunStage 拉高；那种情况归 runner。
      if (localRunActive.value) return
      store.beginRun({
        trigger: 'external',
        scope: 'full',
        rerun: false,
        steps: toFlowRunSteps(flowStages.value),
      })
      return
    }
    finishActiveRun()
  })

  watch(flowStages, () => {
    if (!store.activeRun.value) return
    const steps = stepsForActiveRun()
    store.updateRun(steps)
    // Pipeline 已全绿但 localRunActive 卡住时，runActive 下沿不会来——按步骤终态收尾。
    if (isFlowRunStepsTerminal(steps)) {
      store.finishRun(failureForSteps(steps))
    }
  })

  watch(
    () => store.activeRun.value?.id,
    (id, previousId) => {
      if (!id || id === previousId) return
      store.updateRun(stepsForActiveRun())
    },
  )

  // 本地运行结束后 flow.json 未必还会再触发一次监听，主动拉一把让
  // hasOngoingRunStage 归零，收尾才有机会发生。
  watch(localRunActive, (active, wasActive) => {
    if (active || !wasActive) return
    void refreshFlowStages()
  })

  // 换了工程就是另一段历史，上一份运行记录不该跟过来。
  watch(
    () => currentProject.value?.path,
    (path, previousPath) => {
      if (path === previousPath) return
      store.clearRuns()
    },
  )

  // Recover a deck left open when finish was missed (e.g. localRunActive stuck).
  {
    const run = store.activeRun.value
    if (run) {
      const steps = stepsForActiveRun()
      if (isFlowRunStepsTerminal(steps)) {
        store.updateRun(steps)
        store.finishRun(failureForSteps(steps))
      }
    }
  }
}
