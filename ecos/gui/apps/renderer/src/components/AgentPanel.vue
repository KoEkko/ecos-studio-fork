<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import AgentFeed from '@/components/AgentFeed.vue'
import AgentInput from '@/components/AgentInput.vue'
import { AGENT_UNAVAILABLE_MESSAGE, useAgent } from '@/composables/useAgent'
import { useAssistantFocus } from '@/composables/useAssistantFocus'
import { deckFocusStep, toFlowRunSnapshot } from '@/composables/flowRunReport'
import { useFlowRunStore, type FlowRunStep } from '@/composables/flowRunStore'
import { useBottomPanel } from '@/composables/useBottomPanel'
import { useFlowRunner } from '@/composables/useFlowRunner'
import { useFlowStages } from '@/composables/useFlowStages'
import { useHomeData } from '@/composables/useHomeData'
import { flowLogStepKey } from '@/utils/flowLogSelection'
import { parseSlashCommand } from '@/utils/agentSlashCommands'

const { openBottomPanel } = useBottomPanel()
const { flowStages, hasOngoingRunStage, refreshFlowStages } = useFlowStages()
const { flowLogContentByKey } = useHomeData()
const { runs, activeRun } = useFlowRunStore()
const { runAllFlow, runFlow, isRunning } = useFlowRunner()
const {
  entries,
  statusMessage,
  isAvailable,
  isBusy,
  isReady,
  send,
  interrupt,
  clear,
  refreshStatus,
} = useAgent()
const { focusToken } = useAssistantFocus()

const feedRef = ref<InstanceType<typeof AgentFeed>>()
const inputRef = ref<InstanceType<typeof AgentInput>>()
const isRerun = ref(false)

const flowRunBusy = computed(() => isRunning.value || hasOngoingRunStage.value)
const runLabel = computed(() => (isRerun.value ? 'ReRun Flow' : 'Run Flow'))

// 本次会话跑过之后就不再需要磁盘快照，交给 mergeAgentFeed 决定何时收起。
const snapshot = computed(() => toFlowRunSnapshot(flowStages.value))

const knownSteps = computed(() =>
  flowStages.value.filter((stage) => stage.group === 'run').map((stage) => stage.label),
)

const activeRunLogText = computed(() => {
  const run = activeRun.value
  if (!run) return ''
  const step = deckFocusStep(run.steps).step
  if (!step?.tool) return ''
  return (
    flowLogContentByKey.value[
      flowLogStepKey({ stepName: step.name, tool: step.tool })
    ] ?? ''
  )
})

const notice = computed(() => {
  if (!isAvailable.value) return AGENT_UNAVAILABLE_MESSAGE
  if (!isReady.value && statusMessage.value) return statusMessage.value
  return ''
})

function onOpenFlowLog(step: FlowRunStep): void {
  if (!step.tool) return
  openBottomPanel('flow-log', {
    stepKey: flowLogStepKey({ stepName: step.name, tool: step.tool }),
  })
}

async function handleRunFlow(): Promise<void> {
  if (flowRunBusy.value) return
  await runAllFlow({ rerun: isRerun.value })
  await refreshFlowStages()
}

function draftAskAboutFailure(step: FlowRunStep, lines: string[]): void {
  const excerpt = lines.length ? `\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`` : ''
  inputRef.value?.setDraft(
    `Why did ${step.label} fail? Please explain the error and suggest a fix.${excerpt}`,
  )
}

function resolveStepPath(token: string): string | null {
  const wanted = token.trim().toLowerCase()
  const stage = flowStages.value.find(
    (item) =>
      item.group === 'run' &&
      (item.label.toLowerCase() === wanted ||
        item.name.toLowerCase() === wanted ||
        item.path.toLowerCase() === wanted),
  )
  return stage?.path ?? null
}

async function handleSlash(text: string): Promise<boolean> {
  const command = parseSlashCommand(text, knownSteps.value)
  if (!command) return false

  if (command.kind === 'clear') {
    clear()
    return true
  }

  if (command.kind === 'qor') {
    openBottomPanel('qor')
    return true
  }

  if (command.kind === 'log') {
    const path = resolveStepPath(command.step)
    const stage = flowStages.value.find(
      (item) => item.group === 'run' && item.path === path,
    )
    if (!stage?.tool) return true
    openBottomPanel('flow-log', {
      stepKey: flowLogStepKey({ stepName: stage.name, tool: stage.tool }),
    })
    return true
  }

  if (command.kind === 'run') {
    if (isRunning.value) return true
    if (command.step) {
      const path = resolveStepPath(command.step)
      if (!path) return true
      await runFlow({ step: path, rerun: command.rerun })
      return true
    }
    await runAllFlow({ rerun: command.rerun })
    return true
  }

  // unknown slash: leave it in the box as a failed command rather than chat noise
  inputRef.value?.setDraft(
    `Unknown command. Try /run, /rerun, /log <step>, /qor, or /clear.`,
  )
  return true
}

// 自己发的消息一定要看得到，不管之前翻到了哪里。
async function onSubmit(text: string): Promise<void> {
  feedRef.value?.scrollToBottom()
  if (await handleSlash(text)) return
  if (!isAvailable.value) return
  await send(text)
}

function onRetry(): void {
  const lastUser = [...entries.value].reverse().find((entry) => entry.kind === 'user')
  if (!lastUser || lastUser.kind !== 'user') return
  inputRef.value?.setDraft(lastUser.text)
}

watch(focusToken, async () => {
  await nextTick()
  feedRef.value?.scrollToLiveBlock()
})

onMounted(() => {
  void refreshStatus()
})
</script>

<template>
  <section class="section-card agent-panel">
    <div class="section-header section-header--divided agent-panel-header">
      <h2>Assistant</h2>
      <span class="header-hint">Ask about this design or type / for commands</span>
      <div class="header-actions">
        <div class="agent-run-group">
          <button
            type="button"
            class="agent-run-btn"
            :disabled="flowRunBusy"
            :title="runLabel"
            @click="handleRunFlow"
          >
            <i
              :class="flowRunBusy ? 'ri-loader-4-line agent-run-spin' : 'ri-play-fill'"
              aria-hidden="true"
            ></i>
            <span>{{ flowRunBusy ? 'Running…' : runLabel }}</span>
          </button>
          <button
            type="button"
            class="agent-rerun-btn"
            :class="{ active: isRerun }"
            :aria-pressed="isRerun ? 'true' : 'false'"
            title="Discard previous results and restart the flow from the first step"
            @click="isRerun = !isRerun"
          >
            <i class="ri-restart-line" aria-hidden="true"></i>
          </button>
        </div>
        <button
          type="button"
          class="action-btn"
          title="Clear the conversation"
          aria-label="Clear the conversation"
          :disabled="!entries.length"
          @click="clear"
        >
          <i class="ri-delete-bin-line"></i>
        </button>
      </div>
    </div>

    <AgentFeed
      ref="feedRef"
      :entries="entries"
      :runs="runs"
      :active-run="activeRun"
      :active-run-log-text="activeRunLogText"
      :snapshot="snapshot"
      :assistant-ready="isReady"
      @open-flow-log="onOpenFlowLog"
      @ask-assistant="draftAskAboutFailure"
      @retry="onRetry"
    />

    <AgentInput
      ref="inputRef"
      :busy="isBusy"
      :notice="notice"
      @submit="onSubmit"
      @interrupt="interrupt"
    />
  </section>
</template>

<style scoped src="./sectionCard.css"></style>

<style scoped>
.agent-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.agent-panel-header {
  padding-bottom: 8px;
}

.agent-run-group {
  display: inline-flex;
  align-items: stretch;
  flex-shrink: 0;
}

.agent-run-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 9px;
  border: 1px solid var(--accent-color);
  border-radius: 6px 0 0 6px;
  background: var(--accent-color);
  color: var(--accent-text);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.agent-run-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent-color) 88%, #000);
}

.agent-run-btn:disabled {
  cursor: progress;
  opacity: 0.6;
}

.agent-rerun-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--border-color);
  border-left: none;
  border-radius: 0 6px 6px 0;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
}

.agent-rerun-btn:hover {
  color: var(--text-primary);
}

.agent-rerun-btn.active {
  color: var(--accent-color);
  border-color: color-mix(in srgb, var(--accent-color) 55%, transparent);
  background: color-mix(in srgb, var(--accent-color) 10%, var(--bg-primary));
}

.agent-run-spin {
  animation: agent-run-spin 0.9s linear infinite;
}

@keyframes agent-run-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
