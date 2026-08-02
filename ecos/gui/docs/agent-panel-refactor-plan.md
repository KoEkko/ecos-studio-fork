# Assistant 区域重构实施计划

状态：P0 / P1 已实现（第二版形态）
范围：`ecos/gui/apps/renderer`。P0/P1 不触碰 `desktop-electron` 与 `packages/shared`。

---

## 1. 出发点

### 1.1 Assistant 现在是个空壳

`AgentService` 扫两个目录找 `agent-provider.json`：

```163:169:ecos/gui/apps/desktop-electron/electron/main/index.ts
  const agentService = new AgentService({
    // A user-installed plugin wins over the bundled one with the same providerId.
    pluginRoots: [
      join(app.getPath('userData'), 'agent-providers'),
      join(process.resourcesPath, 'agent-providers'),
    ],
  })
```

仓库里没有任何 provider，打包配置也不会往 `resources/agent-providers` 放东西。真机上 `getStatus` 返回 `state: 'stopped'`，输入框按不动。**面板里现在唯一能显示的内容就是 flow 步骤镜像。**

协议能力同样受限。`DesktopAgentEvent` 只有五种类型，`tool` 就是一个字符串，没有结构化的工具调用、工具结果回传或审批往返。在协议不改的前提下，agent 无法发起 flow、读不到日志、也无法对运行结果发表意见。

### 1.2 flow 镜像进对话流，缺少存在理由

顶部 `FlowPipelineBar` 已经有 12 个步骤和进度条。Assistant 区再显示一遍「12 steps completed」，读者没有多得到任何信息。

Cursor 的内联终端块之所以成立，是因为存在因果链：用户问了一件事，agent 决定跑一条命令，命令输出成为 agent 下一句话的依据，三者同属一轮对话。当前实现里这条链是断的，运行由别处的按钮触发，输出无人消费。

### 1.3 现有实现的三处具体缺陷

**冷快照被伪装成对话历史。** `AgentPanel` 挂载即把 `flowStages` 当前状态写进 transcript：

```ts
watch(flowSnapshots, (steps) => recordFlowSteps(steps), { immediate: true, deep: true })
```

打开一个上周跑完的工程，对话顶部立刻出现「12 steps completed」，看起来像刚发生。

**没有「一次运行」的概念。** `applyFlowStepSnapshots` 用 `stepName` 做主键就地更新，ReRun 覆盖上一次记录而非追加。

**分组靠启发式。** `groupAgentTimeline` 折叠「连续 ≥2 个 success」，中间夹一个失败步骤就会把一次运行切成互不相关的碎片。

这三者是同一个病根的并发症：**flow 被塞进了一个不属于它的数据结构。**

---

## 2. 已确认的产品决策

| 议题 | 结论 |
| --- | --- |
| provider 现状 | 近期会有，UI 需为真实对话预留结构 |
| Assistant 定位 | EDA 领域助手：懂 flow、懂 QoR、能解释失败、能改 `parameters.json` |
| 用户在场情况 | 跑 flow 时盯着看，第一时间想知道跑到哪、有没有出错 |
| 区域形态 | 运行控制台。顶部钉运行状态，下方是报告与对话流 |
| 报告与 LLM 的关系 | 分开。报告卡永远是模板生成的事实，provider 就绪后 agent 在卡下方追加评论 |
| 运行间 QoR 对比 | 不做。QoR 属于 Home 左栏，Assistant 区不重复 |
| 区域命名 | 继续叫 Assistant |
| provider 未就绪时的 agent 入口 | 灰掉 + tooltip 说明原因 |
| Workspace 页 `AIChatPanel` | 彻底不显示运行内容，只做对话 |
| Assistant 区的 Run 按钮 | 不放。`FlowPipelineBar` 保持唯一常驻入口 |
| flow 取消 | P0 只做禁用占位，ECC 侧 `flow.cancel` 后续补 |

---

## 3. 三块区域的职责划分

「报告卡不含 QoR」这个决定把职责切干净了，后续所有设计都以此为准绳：

| 区域 | 维度 | 回答的问题 | 内容 |
| --- | --- | --- | --- |
| `FlowPipelineBar` | 空间 | 整体到哪了 | 12 个步骤横排、进度、点击跳转 |
| Home 左栏 | 质量 | 芯片好不好 | QoR 指标、checklist、gate |
| Assistant 区 | 时间 | 此刻在干什么、刚才花了多久 | 当前步骤耗时、live log、运行报告 |

**任何一块区域都不重复另外两块已有的信息。** 这条规则直接决定了 run deck 的内容（见 5.2）。

---

## 4. 架构：flow 与对话彻底解耦

因为 `AIChatPanel` 只做对话，而它与 Home 共享模块级 `entries`，与其在渲染层过滤运行条目，不如让两者从一开始就分家。

```
useAgent().entries          纯对话：user / assistant / tool
flowRunStore.runs           运行记录：独立的模块级 store
```

`AgentPanel`（Home）把两者按时间戳合并渲染，`AIChatPanel`（Workspace）只渲染 `entries`。

这样 `agentTimeline.ts` 里不再需要 `AgentFlowRunEntry`，1.3 里那三处缺陷随之全部消失，不需要单独修。

### 4.1 对话侧的改动（`composables/agentTimeline.ts`）

**删除**：`AgentFlowRunEntry`、`AgentFlowGroupEntry`、`AgentTimelineItem`、`groupAgentTimeline()`、`applyFlowStepSnapshots()`、`FlowStepSnapshot`。

**保留并加时间戳**（合并渲染需要）：

```ts
export interface AgentUserEntry {
  kind: 'user'
  id: string
  text: string
  createdAt: number
}
// AgentAssistantEntry / AgentToolEntry 同样加 createdAt

export type AgentTimelineEntry =
  | AgentUserEntry
  | AgentAssistantEntry
  | AgentToolEntry
```

`useAgent.ts` 相应删除 `recordFlowSteps`。

### 4.2 运行侧（新文件 `composables/flowRunStore.ts`）

```ts
export type FlowRunStepState = 'pending' | 'running' | 'success' | 'failed'

export interface FlowRunStep {
  /** flow.json 的 step.name，与 tool 一起定位日志 */
  name: string
  label: string
  /** yosys / ecc / dreamplace */
  tool: string
  state: FlowRunStepState
  /** flow.json 原样，格式 HH:MM:SS */
  runtime: string
  peakMemoryMb: number
  /** 观测到它转为 running 的时刻，flow.json 不提供 */
  startedAt?: number
}

export type FlowRunTrigger = 'user' | 'agent' | 'external'
export type FlowRunState = 'running' | 'success' | 'failed'

export interface FlowRunFailure {
  stepName: string
  tool: string
  /** 从日志抽取的错误行，运行结束时抽一次 */
  lines: string[]
}

export interface FlowRunRecord {
  id: string
  trigger: FlowRunTrigger
  scope: 'full' | 'step'
  rerun: boolean
  startedAt: number
  finishedAt?: number
  state: FlowRunState
  steps: FlowRunStep[]
  failure?: FlowRunFailure
}
```

Store 只做三件事，全是纯函数加一层 `ref` 包装：

```ts
export function beginRun(init: {
  trigger: FlowRunTrigger
  scope: 'full' | 'step'
  rerun: boolean
  steps: readonly FlowRunStep[]
}): string  // 返回 runId

/** 更新最后一个 running 的 run；没有则原样返回，绝不凭空创建。 */
export function updateRun(steps: readonly FlowRunStep[]): void

export function finishRun(failure?: FlowRunFailure): void

export function clearRuns(): void  // 切 workspace 时调用
```

`updateRun` 永不创建记录是关键约束：它保证任何 flow.json 抖动都不会产生条目，创建只发生在显式的 `beginRun`。

### 4.3 谁调用 beginRun / finishRun

放进 `useFlowRunner` 内部，不放在 `FlowPipelineBar`。理由：`runAllFlow` / `runFlow` 精确知道运行何时开始、何时结束、用的什么参数，而调用方有多个（Pipeline Bar、LeftSidebar、将来的 slash 命令），逐个要求它们记得上报迟早会漏。

```
useFlowRunner.runAllFlow(options)
  markFlowExecutionActiveForWorkspace(directory)
  flowRunStore.beginRun({ trigger: options.trigger ?? 'user', scope: 'full', rerun })
  ... await rtl2gdsApi ...
  finally:
    flowRunStore.finishRun(await extractFailure())
    clearFlowExecutionActiveForWorkspace(directory)
```

`FlowRunOptions` 增加可选的 `trigger`，默认 `'user'`。将来 agent 发起时传 `'agent'`。现有调用方无需修改。

**外部触发**由 `flowRunTracker`（`AgentPanel` 挂载时启动的 watcher）检测：`hasOngoingRunStage` 出现 false → true 跳变而 `isRunning` 为 false 时，`beginRun({ trigger: 'external' })`。

### 4.4 运行中的步骤更新

run 活跃期间 watch `flowStages`，映射后调 `updateRun`：

```ts
// composables/flowRunSteps.ts —— 纯函数，配单测
export function toFlowRunSteps(stages: readonly FlowStage[]): FlowRunStep[]
```

只取 `group === 'run'`，保留 pending（报告卡的「完成 7 / 12」需要总数）。状态映射复用现成的 `flowPipelineStepTone`，不重复实现 `Invalid` / `Incomplete` / `Imcomplete` 三种拼写的归一。

`startedAt` 由 `updateRun` 在检测到某步骤首次变 running 时打戳。

### 4.5 生命周期边界情况

| 情况 | 处理 |
| --- | --- |
| 挂载时 flow 已在跑 | `hasOngoingRunStage` 初始即 true，无跳变，不创建记录。**错过开头就不编造** |
| 挂载时 flow 早已跑完 | 无任何信号，`runs` 为空。滚动区改为显示磁盘快照报告（见 5.4） |
| 切换 workspace | `clearRuns()` + 现有的 `resetTranscript()` |
| 运行中切走再切回 | 视为错过开头，不恢复 |
| 单步运行 | `scope: 'step'`，`steps` 只含该步骤 |
| 连续两次运行 | 两条独立记录 |
| 应用重启 | 记录全丢，回落到磁盘快照报告。P0 不做持久化 |

---

## 5. 界面

### 5.1 布局

```
┌ Assistant ─────────────────────────────┐
│  header                                │
│  ────────────────────────────────────  │
│  RUN DECK        运行中才出现，钉在顶部 │
│  ────────────────────────────────────  │
│                                        │
│  FEED            可滚动                 │
│    运行报告卡 / 用户消息 / agent 回复   │
│                                        │
│  ────────────────────────────────────  │
│  INPUT                                 │
└────────────────────────────────────────┘
```

Run deck 不参与滚动。RTL2GDS 要跑几分钟到几小时，用户会盯着看；躺在聊天流里的话，往下翻一眼报告，正在跑的东西就滑出视野了。Cursor 不需要这么做，因为它的工具调用是秒级的。这是必须偏离它的地方。

### 5.2 Run deck

按第 3 节的规则，deck 只放 Pipeline Bar 没有的东西。**不要进度条，不要 N/M**，那是 Pipeline Bar 的活，顶上一模一样的东西已经有了。deck 独有的只有耗时和 live log。

**运行中**

```
◌  Route · ecc                        42s / 3m 26s
   > INFO: routing layer metal3
   > INFO: 12043 nets remaining
   > INFO: congestion 0.82
```

- 左侧：当前 running 步骤的 label 与 tool，旋转图标
- 右侧：`本步已跑 / 本次运行总计`，1s 一跳。用 `setInterval` 而非 `requestAnimationFrame`，秒级刷新不值得占 rAF
- log tail：当前步骤日志最后 3 行，等宽字体，单行截断不换行
- 数据源：`useHomeData().flowLogContentByKey[flowLogStepKey({ stepName, tool })]`，live watch 已在增量 tail
- 新行以 `opacity` 过渡淡入。不要动 layout 属性

**失败**

Deck 转红并停住，不跳到下一步。log tail 从「最后 3 行」切换为「**最后一处 ERROR 起的 3 行**」，因为报错后面常跟一堆无用的收尾输出。

```
✗  Route 失败 · ecc                         3m 26s
   > ERROR: 1204 DRC violations on metal3
   > ERROR: routing failed after 3 iterations

   [打开完整日志]   [问 Assistant]
```

`[问 Assistant]` 在 provider 未就绪时置灰，`title` 说明原因，保留可聚焦否则读不到 tooltip。

**Stop 按钮**：禁用态，`title="Cancelling a running flow is not supported yet"`。

**进出动画**：`grid-template-rows: 0fr → 1fr`，180ms `cubic-bezier(.22,1,.36,1)`。

### 5.3 运行报告卡

运行结束后 deck 收起，feed 底部落下一张报告卡。内容全是**运行本身**的事实，不涉及芯片质量。

**折叠态（默认）**

```
✓  RTL2GDS · 4m 12s · 12 / 12                        ⌄
   最慢  Route  1m 02s  2.4 GB
```

**失败时（默认展开到失败处）**

```
✗  RTL2GDS · 失败于 Route · 3m 26s · 7 / 12          ⌃
   最慢  Route  2m 58s  2.4 GB

   > ERROR: 1204 DRC violations on metal3
   > ERROR: routing failed after 3 iterations

   ✓  Synthesis    yosys      18s    412 MB
   ✓  Floorplan    ecc         4s    280 MB
   …
   ✗  Route        ecc      2m 58s   2.4 GB
   ○  DRC          ecc            未运行

   [打开 Route 日志]   [问 Assistant]
```

- 步骤行点击 = `openBottomPanel('flow-log', { stepKey })`，沿用现有机制
- pending 步骤置灰不可点（没有日志）
- `rerun` 时标题后缀 ` (rerun)`；`trigger === 'external'` 时加一枚静音标签
- provider 就绪后，agent 的评论作为一条独立的 assistant 消息追加在卡**下方**，不改写卡内容

### 5.4 冷状态：磁盘快照报告

没有运行记录时（刚打开工程、或应用重启后），feed 顶部显示一张从 `flow.json` 当前状态重建的报告，标题明确写「上一次运行」。

这与 1.3 反对的冷快照不是一回事。被反对的是把磁盘状态**伪装成刚发生的对话事件**；这张卡明确陈述自己描述的是既有状态，不声称发生在何时。区别在于诚实，不在于是否显示。

因为不知道真实起止时刻，这张卡：

- 不显示总耗时（各步 `runtime` 求和只是 CPU 时间之和，不等于墙钟时间），改为显示「各步合计 4m 12s」
- 不显示 trigger
- 其余与 5.3 一致

一旦本次会话产生了真实运行记录，这张卡消失。

### 5.5 Feed 合并

```ts
// composables/agentFeed.ts —— 纯函数，配单测
export type AgentFeedItem =
  | { kind: 'message'; at: number; entry: AgentTimelineEntry }
  | { kind: 'run'; at: number; run: FlowRunRecord }

/** 按时间戳升序合并。running 的 run 不进 feed，它在 deck 里。 */
export function mergeAgentFeed(
  entries: readonly AgentTimelineEntry[],
  runs: readonly FlowRunRecord[],
): AgentFeedItem[]
```

### 5.6 滚动

替换现有的无条件 `scrollTop = scrollHeight`（用户上翻看历史时会被拽回底部）。

```ts
const STICK_THRESHOLD_PX = 48

export function shouldStickToBottom(
  scrollTop: number, clientHeight: number, scrollHeight: number,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= STICK_THRESHOLD_PX
}
```

- 内容增长时只有贴底才跟随
- 离底后右下角浮出「跳到底部」圆钮，带未读计数
- 用户发送消息时无条件到底

### 5.7 空状态

没有运行记录、也没有 `flow.json` 时：

```
还没有运行记录。运行 RTL2GDS 后，这里会显示每一步的耗时和日志。
```

provider 未就绪时输入框上方保留现有的 notice。不放建议提示词，因为点了也没人回答。

---

## 6. 组件

```
AgentPanel.vue          容器，Home 专用。接线 useAgent + flowRunStore
  AgentRunDeck.vue      钉顶，仅运行中渲染
  AgentFeed.vue         合并渲染 + 滚动管理（替换 AgentTimeline.vue）
    AgentMessage.vue    user / assistant / tool
    FlowRunReportCard.vue
  AgentInput.vue        不改

AIChatPanel.vue         Workspace 专用
  AgentFeed.vue         runs 传空数组，scrollable=false
  AgentInput.vue
```

`AgentTimeline.vue` 重命名为 `AgentFeed.vue`，props 变为 `{ entries, runs?, scrollable?, hideEmpty?, emptyHint? }`。一个列表组件同时服务两个面板，`AIChatPanel` 不传 `runs` 即自然只渲染对话。

新增的纯函数模块：

| 文件 | 职责 |
| --- | --- |
| `composables/flowRunStore.ts` | 运行记录 store（唯一有状态的新模块） |
| `composables/flowRunSteps.ts` | `toFlowRunSteps` 映射 |
| `composables/flowRunReport.ts` | 最慢步骤、完成计数、终态推导、格式化 |
| `composables/agentFeed.ts` | `mergeAgentFeed` |
| `composables/agentAutoScroll.ts` | `shouldStickToBottom` |
| `utils/flowLogFailure.ts` | 错误行抽取 |
| `utils/duration.ts` | `HH:MM:SS` 解析与显示格式化 |

### 6.1 `utils/duration.ts`

`useWorkspace.ts` 第 1155 到 1172 行已有一份内联的 `HH:MM:SS` 解析，未导出。抽出来共用，不写第三份。

```ts
/** flow.json 的 runtime 是 "HH:MM:SS"。解析失败返回 null，不抛。 */
export function parseFlowRuntimeSeconds(runtime: string): number | null

export function sumFlowRuntimeSeconds(runtimes: readonly string[]): number

/** "4m 12s" / "38s" / "1h 04m" */
export function formatDurationSeconds(seconds: number): string

export function formatElapsedMs(ms: number): string

/** "2.4 GB" / "820 MB" */
export function formatPeakMemory(mb: number): string
```

`useWorkspace.ts` 改为调用它，行为不变。测试用例保留现有的 `'aa:bb:cc'` 非法输入场景。

### 6.2 `utils/flowLogFailure.ts`

```ts
/**
 * 从日志尾部向前找最后一处 ERROR/FATAL，返回它及其后若干行。
 * 找不到时回落为最后 maxLines 行非空内容。
 */
export function extractFailureLines(logText: string, maxLines = 3): string[]
```

纯正则，不需要 LLM。模式：`/^\s*(ERROR|FATAL|\[ERROR\])/i` 与 `/\berror\b\s*:/i`。

---

## 7. 视觉

沿用现有 CSS 变量，不新增 token。

| 用途 | 值 |
| --- | --- |
| Run deck 背景（running） | `color-mix(in srgb, var(--accent-color) 8%, transparent)` |
| Run deck 背景（failed） | `var(--danger-bg)` |
| Run deck 下边界 | `1px solid var(--border-color)`，与 feed 分开 |
| 报告卡背景（success） | 透明。已完成的运行不该比 agent 的回答更抢眼 |
| 报告卡背景（failed） | `var(--danger-bg)` |
| 卡片边框 | 无。靠背景区分，避免嵌套边框 |
| 圆角 | 8px |
| 卡片内边距 | 8px 10px |
| 标题字号 | 11px / 500 |
| 元信息字号 | 10px，`opacity: .7` |
| 等宽字体 | `'JetBrains Mono', 'SF Mono', ui-monospace, monospace` |
| 展开动效 | `grid-template-rows: 0fr → 1fr`，160ms `cubic-bezier(.22,1,.36,1)` |
| Deck 进出 | 同上，180ms |

`sectionCard.css` 不变。

---

## 8. 无障碍

- Feed 容器：`role="log"`、`aria-live="polite"`、`aria-relevant="additions"`
- 流式期间关闭 `aria-live`，turn 结束时把完整文本写入一个视觉隐藏的 live region，避免逐 token 播报
- Run deck：`role="status"`、`aria-live="polite"`。log tail 本身设 `aria-hidden="true"`，否则每秒都在打断朗读
- 展开按钮：`aria-expanded` + `aria-controls`
- 禁用的 Stop 与「问 Assistant」：`aria-disabled="true"` 且保留可聚焦，否则读不到 tooltip 里的原因
- 状态不只靠颜色：running / success / failed 各有独立图标

---

## 9. 测试

沿用 vitest，纯函数优先。

| 文件 | 覆盖 |
| --- | --- |
| `flowRunStore.test.ts` | `beginRun` 追加、`updateRun` 只改最后一个 running run 且不凭空创建、`finishRun` 推导终态、连续两次运行产生两条记录、`startedAt` 首次打戳 |
| `flowRunSteps.test.ts` | 过滤 setup 组、保留 pending、三种失败拼写归一 |
| `flowRunReport.test.ts` | 最慢步骤、完成计数、全 pending 时不崩 |
| `agentFeed.test.ts` | 按时间戳合并、running run 不进 feed、空输入 |
| `agentAutoScroll.test.ts` | 阈值边界 |
| `flowLogFailure.test.ts` | 找到 ERROR、找不到时回落、空日志、只有空行 |
| `duration.test.ts` | `HH:MM:SS` 正常与非法输入、求和、各量级格式化 |
| `agentRunDeck.test.ts` | 运行中显示耗时与 tail、失败时切换为 ERROR 起始、Stop 禁用 |
| `flowRunReportCard.test.ts` | 失败默认展开、pending 步骤不可点、快照卡不显示总耗时 |

需一并更新：`homeAgentSurface.test.ts`、`agentTimeline.test.ts`（删除 flow 相关断言）、`useWorkspace.test.ts`（`HH:MM:SS` 解析移出后的回归）。

---

## 10. 分阶段

### P0（本轮）

1. `utils/duration.ts` 并把 `useWorkspace.ts` 的内联解析改为调用它
2. `flowRunStore.ts` + `flowRunSteps.ts` + `flowRunReport.ts`
3. `useFlowRunner` 内部接入 `beginRun` / `finishRun`，`FlowRunOptions` 加 `trigger`
4. 外部运行的 watcher
5. `agentTimeline.ts` 删除 flow 相关类型与函数，条目加 `createdAt`；`useAgent` 删除 `recordFlowSteps`
6. `agentFeed.ts` 合并函数
7. `AgentRunDeck.vue`（耗时 + 静态 log 占位 + 禁用 Stop）
8. `FlowRunReportCard.vue`（含 5.4 的快照卡形态）
9. `AgentTimeline.vue` → `AgentFeed.vue`，抽出 `AgentMessage.vue`
10. `agentAutoScroll.ts` + 跳到底部
11. `AgentPanel.vue` 重新接线；`AIChatPanel.vue` 不传 `runs`
12. 上表 P0 相关测试

### P1

13. `flowLogFailure.ts` + deck 与报告卡的错误行展示
14. live log tail 实时接入
15. markdown 渲染 + 代码块复制
16. 消息 hover 工具条（复制 / 重试）
17. slash 命令：`/run`、`/rerun`、`/run <step>`、`/log <step>`、`/clear`。需把 `useFlowRunner.runFlow` 的 step 来源从路由参数改为可选入参

### P2（依赖协议扩展）

18. `DesktopAgentEvent` 扩展结构化工具调用与审批往返
19. agent 发起运行（`trigger: 'agent'`）
20. agent 对运行报告的评论
21. `@` 提及：`@step` / `@log` / `@file` / `@metric`
22. `flow.cancel`：shared 契约 + IPC + ECC RPC，解除 Stop 禁用
23. 模式切换（接线已有的 `DesktopAgentSetModeRequest`）

### P3

24. 运行记录持久化（跨重启）
25. 会话历史（接线已有的 `listSessions` / `resumeSession`）
26. 参数 diff 卡 + Apply / Discard

---

## 11. 风险与待观察

| 项 | 说明 |
| --- | --- |
| 外部运行检测精度 | 依赖 `hasOngoingRunStage` 的跳变，而 flow.json watch 有延迟，短运行可能整个错过。可接受：错过好过编造 |
| live log tail 的数据来源 | `flowLogContentByKey` 由 `useHomeData` 的 live watch 填充，目前只在 HomeView 启动。P0 的 deck 先不接实时 tail，P1 处理 |
| 各步 runtime 求和不等于墙钟时间 | 快照卡因此只写「各步合计」。真实运行记录用观测到的 `startedAt` / `finishedAt`，两者不要混用 |
| Assistant 区在无运行无 provider 时偏空 | 常态下只有一张快照卡和一个灰输入框，占 Home 42% 宽度。provider 到位前可考虑调整 splitter 默认比例，本轮不动 |
| `useFlowRunner` 依赖 `flowRunStore` | 两者同属 flow 域，方向合理。但要注意 `useFlowRunner` 已被多处引用，改动需跑全量测试 |
