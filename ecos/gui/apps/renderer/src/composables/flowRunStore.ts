import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue'

export type FlowRunStepState = 'pending' | 'running' | 'success' | 'failed'

export interface FlowRunStep {
  /** flow.json 的 step.name，与 tool 一起定位日志 */
  name: string
  /** 路由段，单步运行用它认领自己的步骤 */
  path: string
  label: string
  /** yosys / ecc / dreamplace */
  tool: string
  state: FlowRunStepState
  /** flow.json 原样，格式 HH:MM:SS */
  runtime: string
  peakMemoryMb: number
  /** 观测到它转为 running 的时刻。flow.json 不提供，只能由本地观测补上。 */
  startedAt?: number
}

/** external 表示别的窗口或终端触发，本次会话不为它的参数负责。 */
export type FlowRunTrigger = 'user' | 'agent' | 'external'
export type FlowRunScope = 'full' | 'step'
export type FlowRunState = 'running' | 'success' | 'failed'

export interface FlowRunFailure {
  stepName: string
  tool: string
  lines: string[]
}

export interface FlowRunRecord {
  id: string
  trigger: FlowRunTrigger
  scope: FlowRunScope
  rerun: boolean
  /** 单步运行认领的路由段，`scope: 'step'` 时必有。 */
  stepPath?: string
  startedAt: number
  finishedAt?: number
  state: FlowRunState
  steps: FlowRunStep[]
  failure?: FlowRunFailure
}

export interface BeginFlowRunInit {
  trigger: FlowRunTrigger
  scope: FlowRunScope
  rerun: boolean
  stepPath?: string
  steps?: readonly FlowRunStep[]
}

/**
 * 一次运行的终态。空步骤列表判为 failed 而不是让 `every` 空真通过：一次没有产出
 * 任何步骤状态的运行，说成功比说失败更容易误导人。
 */
export function resolveFlowRunState(steps: readonly FlowRunStep[]): FlowRunState {
  if (steps.length === 0) return 'failed'
  if (steps.some((step) => step.state === 'failed')) return 'failed'
  // 有步骤仍在跑：这是进行中，绝不能落到 failed，否则「last run on disk」会整卡发红。
  if (steps.some((step) => step.state === 'running')) return 'running'
  if (steps.every((step) => step.state === 'success')) return 'success'
  // 有成功、有未跑、没有失败：上一次跑到一半停了。按未完成处理，视觉上仍用 failed
  // 槽位（报告卡只有 success / running / failed 三态），但不该出现在 live run 期间。
  return 'failed'
}

export interface FlowRunStore {
  runs: Readonly<Ref<FlowRunRecord[]>>
  /** 仍在运行的那条记录。它归 run deck 渲染，不进 feed。 */
  activeRun: ComputedRef<FlowRunRecord | null>
  beginRun: (init: BeginFlowRunInit) => string
  updateRun: (steps: readonly FlowRunStep[]) => void
  finishRun: (failure?: FlowRunFailure) => void
  clearRuns: () => void
}

export interface FlowRunStoreOptions {
  now?: () => number
}

export function createFlowRunStore(options: FlowRunStoreOptions = {}): FlowRunStore {
  const now = options.now ?? (() => Date.now())
  const runs = ref<FlowRunRecord[]>([])
  let idCounter = 0

  function activeIndex(): number {
    for (let index = runs.value.length - 1; index >= 0; index -= 1) {
      if (runs.value[index].state === 'running') return index
    }
    return -1
  }

  const activeRun = computed<FlowRunRecord | null>(() => {
    for (let index = runs.value.length - 1; index >= 0; index -= 1) {
      if (runs.value[index].state === 'running') return runs.value[index]
    }
    return null
  })

  function beginRun(init: BeginFlowRunInit): string {
    idCounter += 1
    const startedAt = now()
    const id = `run-${idCounter}`
    runs.value = [
      ...runs.value,
      {
        id,
        trigger: init.trigger,
        scope: init.scope,
        rerun: init.rerun,
        ...(init.stepPath ? { stepPath: init.stepPath } : {}),
        startedAt,
        state: 'running',
        steps: stampStartedAt([], init.steps ?? [], startedAt),
      },
    ]
    return id
  }

  /**
   * 只更新最后一条 running 的记录，没有就原样返回。创建记录是 `beginRun` 的专属职责，
   * 否则 flow.json 的每一次抖动都会在时间线上留下一条无中生有的运行。
   */
  function updateRun(steps: readonly FlowRunStep[]): void {
    const index = activeIndex()
    if (index === -1) return
    const existing = runs.value[index]
    const next = runs.value.slice()
    next[index] = { ...existing, steps: stampStartedAt(existing.steps, steps, now()) }
    runs.value = next
  }

  function finishRun(failure?: FlowRunFailure): void {
    const index = activeIndex()
    if (index === -1) return
    const existing = runs.value[index]
    // updateRun 会把「本轮没见过 running」的失败步骤压成 pending，避免旧 run 的
    // Incomplete 染红 deck；收尾时若确认失败，把那一步写回 failed，报告卡才诚实。
    const steps = failure
      ? existing.steps.map((step) =>
          step.name === failure.stepName ? { ...step, state: 'failed' as const } : step,
        )
      : existing.steps
    const next = runs.value.slice()
    next[index] = {
      ...existing,
      steps,
      state: failure ? 'failed' : resolveFlowRunState(steps),
      finishedAt: now(),
      ...(failure ? { failure } : {}),
    }
    runs.value = next
  }

  function clearRuns(): void {
    runs.value = []
  }

  return { runs: readonly(runs) as Readonly<Ref<FlowRunRecord[]>>, activeRun, beginRun, updateRun, finishRun, clearRuns }
}

/**
 * Carries each step's observed start time across snapshots and stamps newly running ones.
 *
 * flow.json 常残留上一轮的 Incomplete。若原样写进本轮 active run，deck 会在仍有
 * 步骤 Ongoing 时整块变红。只有本轮亲眼见过它 enter running（有 startedAt）的失败
 * 才保留；其余先按 pending 看待。
 */
function stampStartedAt(
  previous: readonly FlowRunStep[],
  incoming: readonly FlowRunStep[],
  at: number,
): FlowRunStep[] {
  const previousByName = new Map(previous.map((step) => [step.name, step]))
  return incoming.map((step) => {
    const startedAt = previousByName.get(step.name)?.startedAt
    if (step.state === 'running') {
      return { ...step, startedAt: startedAt ?? at }
    }
    if (step.state === 'failed' && startedAt === undefined) {
      return { ...step, state: 'pending' }
    }
    if (startedAt !== undefined) return { ...step, startedAt }
    return { ...step }
  })
}

// 运行记录是一个应用级事实，Home 与将来的其他入口共享同一份。
const sharedFlowRunStore = createFlowRunStore()

export function useFlowRunStore(): FlowRunStore {
  return sharedFlowRunStore
}
