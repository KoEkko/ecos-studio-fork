<template>
  <div class="frontend-home-view">
    <div class="bg-grid"></div>

    <div class="frontend-home-dashboard">
      <section class="section-card frontend-workspace-area">
        <div class="section-header">
          <div class="header-icon"><i class="ri-code-s-slash-line"></i></div>
          <h2>Frontend Workspace</h2>
          <span class="header-badge">Frontend</span>
        </div>
        <div class="frontend-card-body">
          <div v-if="frontendSummaryError" class="frontend-error">{{ frontendSummaryError }}</div>
          <div class="frontend-info-grid">
            <div v-for="item in frontendWorkspaceItems" :key="item.label" class="frontend-info-item">
              <span class="frontend-info-label">
                <i :class="item.icon"></i>
                {{ item.label }}
              </span>
              <span class="frontend-info-value" :class="{ mono: item.mono }" :title="item.value">
                {{ item.value || '--' }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section class="section-card frontend-flow-area">
        <div class="section-header">
          <div class="header-icon monitor"><i class="ri-flow-chart"></i></div>
          <h2>Frontend Flow</h2>
          <span class="header-count">{{ frontendFlowStats.success }}/{{ frontendFlowStats.total }}</span>
        </div>
        <div class="frontend-card-body">
          <div class="frontend-stat-grid">
            <div class="frontend-stat-item">
              <span>Total</span>
              <strong>{{ frontendFlowStats.total }}</strong>
            </div>
            <div class="frontend-stat-item success">
              <span>Done</span>
              <strong>{{ frontendFlowStats.success }}</strong>
            </div>
            <div class="frontend-stat-item running">
              <span>Running</span>
              <strong>{{ frontendFlowStats.ongoing }}</strong>
            </div>
            <div class="frontend-stat-item failed">
              <span>Failed</span>
              <strong>{{ frontendFlowStats.failed }}</strong>
            </div>
          </div>

          <div class="frontend-progress-track">
            <div class="frontend-progress-fill" :style="{ width: `${frontendFlowProgress}%` }"></div>
          </div>

          <div v-if="frontendRunStages.length" class="frontend-flow-list">
            <div v-for="stage in frontendRunStages" :key="stage.path" class="frontend-flow-row">
              <div class="frontend-flow-icon" :class="stateClass(stage.state)">
                <i :class="stateIcon(stage.state)"></i>
              </div>
              <div class="frontend-flow-main">
                <strong>{{ stage.label }}</strong>
                <span>{{ frontendStepDescription(stage.path) }}</span>
              </div>
              <div class="frontend-flow-meta">
                <span :class="stateClass(stage.state)">{{ stage.state || 'Unstart' }}</span>
                <small>{{ stage.runtime || '--:--:--' }}</small>
              </div>
            </div>
          </div>
          <div v-else class="frontend-empty">
            <i class="ri-file-list-3-line"></i>
            <span>No frontend flow data</span>
          </div>
        </div>
      </section>

      <section class="section-card frontend-sim-area">
        <div class="section-header">
          <div class="header-icon analysis"><i class="ri-terminal-box-line"></i></div>
          <h2>Simulation Result</h2>
          <span class="header-badge">{{ frontendSimStatus }}</span>
        </div>
        <div class="frontend-card-body">
          <div v-if="frontendSimLoading" class="frontend-empty">
            <i class="ri-loader-4-line spin"></i>
            <span>Loading simulation result...</span>
          </div>
          <template v-else>
            <div class="frontend-sim-summary">
              <div class="frontend-sim-tile">
                <span>Suite</span>
                <strong>{{ frontendSimSuite }}</strong>
              </div>
              <div class="frontend-sim-tile">
                <span>Total Cases</span>
                <strong>{{ frontendSimTotalCases }}</strong>
              </div>
              <div class="frontend-sim-tile pass">
                <span>Passed</span>
                <strong>{{ frontendSimPassedCases }}</strong>
              </div>
              <div class="frontend-sim-tile fail">
                <span>Failed</span>
                <strong>{{ frontendSimFailedCases }}</strong>
              </div>
              <div class="frontend-sim-tile">
                <span>Waveforms</span>
                <strong>{{ frontendWaveformCount }}</strong>
              </div>
            </div>

            <div v-if="frontendFailedCaseList.length" class="frontend-case-list">
              <div class="frontend-case-list-title">Failed Cases</div>
              <div v-for="testCase in frontendFailedCaseList" :key="testCase.name" class="frontend-case-row failed">
                <i class="ri-close-circle-line"></i>
                <span>{{ testCase.name }}</span>
                <small>RC {{ testCase.returncode ?? '-' }}</small>
              </div>
            </div>
            <div v-else-if="frontendSimTotalCases > 0" class="frontend-case-list">
              <div class="frontend-case-row success">
                <i class="ri-checkbox-circle-line"></i>
                <span>All listed simulation cases passed.</span>
              </div>
            </div>
            <div v-else class="frontend-empty compact">
              <i class="ri-list-check-3"></i>
              <span>No simulation case result yet</span>
            </div>
          </template>
        </div>
      </section>

      <section class="section-card frontend-log-area">
        <div class="section-header">
          <div class="header-icon gds"><i class="ri-terminal-line"></i></div>
          <h2>Recent Logs</h2>
          <span v-if="flowLogStepName" class="header-badge">{{ flowLogStepName }}</span>
        </div>
        <div class="frontend-log-content">
          <div v-if="flowLogError" class="flow-log-error">{{ flowLogError }}</div>
          <div v-else-if="recentFrontendLogs.length" class="frontend-log-list">
            <div
              v-for="seg in recentFrontendLogs"
              :key="flowLogStepKey(seg)"
              class="frontend-log-step"
              :class="{ failed: seg.failed, missing: seg.missing && !seg.failed, live: seg.live }"
            >
              <div class="frontend-log-step-header">
                <span>{{ seg.stepName }}</span>
                <small>{{ seg.tool }}</small>
                <strong :class="{ failed: seg.failed }">{{ seg.state }}</strong>
                <button
                  v-if="seg.truncated"
                  type="button"
                  class="flow-log-expand-btn"
                  :disabled="expandingFlowLogKeys[flowLogStepKey(seg)]"
                  @click="onExpandFullLog(seg)"
                >
                  <i
                    :class="[
                      expandingFlowLogKeys[flowLogStepKey(seg)]
                        ? 'ri-loader-4-line flow-log-expand-btn-spinner'
                        : 'ri-expand-up-down-line',
                    ]"
                  ></i>
                  <span>{{ formatKb(seg.totalSize) }}</span>
                </button>
              </div>
              <pre>{{ previewLogContent(seg.content) }}</pre>
            </div>
          </div>
          <div v-else-if="flowLogLoading" class="frontend-empty">
            <i class="ri-loader-4-line spin"></i>
            <span>Loading flow logs...</span>
          </div>
          <div v-else class="frontend-empty">
            <i class="ri-terminal-line"></i>
            <span>No frontend logs yet</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { CMDEnum, InfoEnum, ResponseEnum, StepEnum } from '@/api/type'
import { getInfoApi } from '@/api/flow'
import { useFlowStages } from '@/composables/useFlowStages'
import { useHomeData, type FlowLogSegment } from '@/composables/useHomeData'
import { useTauri } from '@/composables/useTauri'
import { useWorkspace } from '@/composables/useWorkspace'
import { resolveProjectPathAccess } from '@/utils/projectFs'

interface FrontendParameters {
  Design?: string
  'Design Tool'?: string
  description?: string
  cpu_filelist?: string
  soc_filelist?: string
  soc_variant?: string
  testbench?: string
  sim_programs_dir?: string
  sim_tests_dir?: string
  sim_soc_root?: string
  sim_build_test_script?: string
}

interface FrontendSimCase {
  name: string
  ok: boolean
  returncode?: number
  wave?: string
}

interface FrontendStepDetail {
  state: string
  summary?: Record<string, unknown>
  cases?: FrontendSimCase[]
}

const { currentProject, stepRefreshCounter, sseMessages } = useWorkspace()
const { isInTauri } = useTauri()
const { dynamicFlowStages: frontendRunStages } = useFlowStages()
const {
  flowLogSegments,
  flowLogStepName,
  flowLogError,
  flowLogLoading,
  expandFlowLogSegment,
} = useHomeData()

const isFrontendProject = computed(() => currentProject.value?.designTool === 'frontend')
const frontendParameters = ref<FrontendParameters>({})
const frontendSummaryError = ref('')
const frontendSimDetail = ref<FrontendStepDetail | null>(null)
const frontendSimLoading = ref(false)
const expandingFlowLogKeys = reactive<Record<string, boolean>>({})

const frontendWorkspaceItems = computed(() => {
  const params = frontendParameters.value
  return [
    {
      label: 'Workspace',
      value: currentProject.value?.name || params.Design || '--',
      icon: 'ri-folder-line',
      mono: false,
    },
    {
      label: 'Location',
      value: currentProject.value?.path || '--',
      icon: 'ri-folder-open-line',
      mono: true,
    },
    {
      label: 'CPU RTL Filelist',
      value: params.cpu_filelist || '--',
      icon: 'ri-file-list-3-line',
      mono: true,
    },
    {
      label: 'Target SoC',
      value: formatSocVariant(params.soc_variant, params.soc_filelist),
      icon: 'ri-cpu-line',
      mono: false,
    },
    {
      label: 'SoC Filelist',
      value: params.soc_filelist || '--',
      icon: 'ri-node-tree',
      mono: true,
    },
    {
      label: 'Testbench',
      value: params.testbench || '--',
      icon: 'ri-test-tube-line',
      mono: true,
    },
  ]
})

const frontendFlowStats = computed(() => {
  const stages = frontendRunStages.value
  return {
    total: stages.length,
    success: stages.filter((s) => s.state === 'Success').length,
    ongoing: stages.filter((s) => s.state === 'Ongoing').length,
    failed: stages.filter((s) => ['Invalid', 'Incomplete', 'Imcomplete'].includes(s.state)).length,
    pending: stages.filter((s) => ['Pending', 'Unstart', ''].includes(s.state || '')).length,
  }
})

const frontendFlowProgress = computed(() => {
  if (!frontendFlowStats.value.total) return 0
  return Math.round((frontendFlowStats.value.success / frontendFlowStats.value.total) * 100)
})

const frontendSimCases = computed(() => frontendSimDetail.value?.cases || [])
const frontendSimSummary = computed(() => frontendSimDetail.value?.summary || {})
const frontendSimTotalCases = computed(() => frontendSimCases.value.length)
const frontendSimPassedCases = computed(() => frontendSimCases.value.filter((testCase) => testCase.ok).length)
const frontendSimFailedCases = computed(() => frontendSimCases.value.filter((testCase) => !testCase.ok).length)
const frontendWaveformCount = computed(() => frontendSimCases.value.filter((testCase) => !!testCase.wave).length)
const frontendFailedCaseList = computed(() => frontendSimCases.value.filter((testCase) => !testCase.ok).slice(0, 6))
const frontendSimSuite = computed(() => String(frontendSimSummary.value.test_suite || 'Default'))
const frontendSimStatus = computed(() => {
  if (!frontendSimDetail.value) return 'Unstart'
  if (frontendSimTotalCases.value === 0) return frontendSimDetail.value.state || 'Unstart'
  return frontendSimFailedCases.value > 0 ? 'Failed' : 'Passed'
})
const recentFrontendLogs = computed(() => flowLogSegments.value.slice(-3).reverse())

function formatKb(totalChars: number | undefined): string {
  if (!totalChars || totalChars <= 0) return '?'
  const kb = totalChars / 1024
  if (kb < 1) return `${totalChars} B`
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

async function onExpandFullLog(seg: FlowLogSegment): Promise<void> {
  const key = flowLogStepKey(seg)
  if (expandingFlowLogKeys[key]) return
  expandingFlowLogKeys[key] = true
  try {
    await expandFlowLogSegment(seg)
  } finally {
    expandingFlowLogKeys[key] = false
  }
}

function flowLogStepKey(seg: FlowLogSegment): string {
  return `${seg.stepName}\u001f${seg.tool}`
}

function formatSocVariant(socVariant?: string, socFilelist?: string): string {
  if (socVariant) {
    return socVariant.replace(/^soc/i, 'SoC ')
  }
  if (!socFilelist) return '--'
  const normalized = socFilelist.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  const idx = parts.findIndex((part) => /^SoC\d*$/i.test(part))
  return idx >= 0 ? parts[idx] : '--'
}

function frontendStepDescription(stepPath: string): string {
  const key = stepPath.toLowerCase()
  if (key === StepEnum.PREPARE) return 'Merge CPU RTL and SoC inputs'
  if (key === StepEnum.ELAB) return 'Elaborate RTL hierarchy'
  if (key === StepEnum.LINT) return 'Run static RTL checks'
  if (key === StepEnum.SIM) return 'Run selected simulation suite'
  return 'Frontend flow step'
}

function previewLogContent(content: string): string {
  if (!content) return '(empty log)'
  const lines = content.trimEnd().split('\n')
  return lines.slice(-24).join('\n') || '(empty log)'
}

async function loadFrontendParameters(): Promise<void> {
  frontendSummaryError.value = ''
  frontendParameters.value = {}

  if (!isFrontendProject.value || !currentProject.value?.path) return

  const parametersPath = `${currentProject.value.path}/home/parameters.json`
  try {
    if (!isInTauri) {
      frontendSummaryError.value = 'Frontend workspace summary is readable in ECOS Studio desktop.'
      return
    }
    const resolvedPath = await resolveProjectPathAccess(parametersPath)
    if (!resolvedPath) {
      frontendSummaryError.value = `No file-system access to ${parametersPath}`
      return
    }
    const content = await readTextFile(resolvedPath)
    frontendParameters.value = JSON.parse(content) as FrontendParameters
  } catch (err) {
    frontendSummaryError.value = err instanceof Error ? err.message : String(err)
  }
}

async function loadFrontendSimDetail(): Promise<void> {
  frontendSimDetail.value = null
  if (!isFrontendProject.value || !currentProject.value?.path) return

  frontendSimLoading.value = true
  try {
    const response = await getInfoApi({
      cmd: CMDEnum.get_info,
      data: {
        step: StepEnum.SIM,
        id: InfoEnum.frontend_detail,
      },
    }, currentProject.value.designTool)

    if (response.response === ResponseEnum.success) {
      frontendSimDetail.value = response.data?.info as FrontendStepDetail
    }
  } catch (err) {
    console.warn('Failed to load frontend sim summary:', err)
  } finally {
    frontendSimLoading.value = false
  }
}

async function refreshFrontendHomeSummary(): Promise<void> {
  await Promise.all([
    loadFrontendParameters(),
    loadFrontendSimDetail(),
  ])
}

function stateIcon(state: string): string {
  switch (state) {
    case 'Success':
      return 'ri-checkbox-circle-fill'
    case 'Ongoing':
      return 'ri-loader-4-line spin'
    case 'Incomplete':
    case 'Imcomplete':
      return 'ri-close-circle-fill'
    case 'Pending':
      return 'ri-time-line'
    case 'Unstart':
    default:
      return 'ri-checkbox-blank-circle-line'
  }
}

function stateClass(state: string): string {
  switch (state) {
    case 'Success':
      return 'state-success'
    case 'Ongoing':
      return 'state-ongoing'
    case 'Incomplete':
    case 'Imcomplete':
      return 'state-failed'
    case 'Pending':
      return 'state-pending'
    case 'Unstart':
    default:
      return 'state-unstart'
  }
}

watch(
  flowLogSegments,
  (segs) => {
    const alive = new Set(segs.map((s) => flowLogStepKey(s)))
    for (const key of Object.keys(expandingFlowLogKeys)) {
      if (!alive.has(key)) delete expandingFlowLogKeys[key]
    }
  },
  { deep: true },
)

watch(
  () => [currentProject.value?.path, currentProject.value?.designTool] as const,
  () => {
    void refreshFrontendHomeSummary()
  },
  { immediate: true },
)

watch(stepRefreshCounter, () => {
  void refreshFrontendHomeSummary()
})

watch(
  () => sseMessages.value.length,
  (newLen, oldLen) => {
    if (!isFrontendProject.value) return
    if (newLen <= (oldLen ?? 0)) return
    const latest = sseMessages.value[newLen - 1]
    const sseStep = latest?.data?.step as string | undefined
    if (!sseStep || sseStep.toLowerCase() === StepEnum.SIM) {
      void refreshFrontendHomeSummary()
    }
  },
)
</script>

<style scoped>
.frontend-home-view {
  height: 100%;
  position: relative;
  overflow: hidden;
  background: var(--bg-primary);
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(var(--accent-rgb, 59, 130, 246), 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(var(--accent-rgb, 59, 130, 246), 0.03) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
}

.section-card {
  background: var(--bg-secondary);
  border: 1px solid rgba(var(--accent-rgb, 59, 130, 246), 0.2);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  position: relative;
  box-shadow: inset 0 0 20px rgba(var(--accent-rgb, 59, 130, 246), 0.02);
  contain: layout paint style;
}

.section-card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(to right, var(--accent-color) 2px, transparent 2px) 0 0,
    linear-gradient(to bottom, var(--accent-color) 2px, transparent 2px) 0 0,
    linear-gradient(to left, var(--accent-color) 2px, transparent 2px) 100% 0,
    linear-gradient(to bottom, var(--accent-color) 2px, transparent 2px) 100% 0,
    linear-gradient(to right, var(--accent-color) 2px, transparent 2px) 0 100%,
    linear-gradient(to top, var(--accent-color) 2px, transparent 2px) 0 100%,
    linear-gradient(to left, var(--accent-color) 2px, transparent 2px) 100% 100%,
    linear-gradient(to top, var(--accent-color) 2px, transparent 2px) 100% 100%;
  background-repeat: no-repeat;
  background-size: 8px 8px;
  opacity: 0.6;
  z-index: 10;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: transparent;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 16px;
  flex-shrink: 0;
}

.section-header h2 {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-badge {
  padding: 2px 8px;
  background: rgba(var(--accent-rgb, 59, 130, 246), 0.1);
  color: var(--accent-color);
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  flex-shrink: 0;
}

.header-count {
  padding: 2px 8px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  flex-shrink: 0;
}

.frontend-home-dashboard {
  position: relative;
  z-index: 1;
  height: 100%;
  width: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  grid-template-rows: minmax(220px, 0.9fr) minmax(300px, 1.1fr);
  gap: 8px;
  padding: 8px;
  box-sizing: border-box;
}

.frontend-card-body {
  flex: 1;
  min-height: 0;
  padding: 10px;
  overflow: auto;
}

.frontend-error {
  margin-bottom: 8px;
  padding: 8px 10px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 6px;
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.08);
  font-size: 11px;
}

.frontend-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  height: 100%;
}

.frontend-info-item,
.frontend-stat-item,
.frontend-sim-tile {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  min-width: 0;
}

.frontend-info-item {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 10px;
}

.frontend-info-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.frontend-info-value {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.frontend-info-value.mono {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 11px;
}

.frontend-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.frontend-stat-item,
.frontend-sim-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
}

.frontend-stat-item span,
.frontend-sim-tile span {
  color: var(--text-secondary);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.frontend-stat-item strong,
.frontend-sim-tile strong {
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  line-height: 1;
}

.frontend-stat-item.success strong,
.frontend-sim-tile.pass strong {
  color: #10b981;
}

.frontend-stat-item.running strong {
  color: #60a5fa;
}

.frontend-stat-item.failed strong,
.frontend-sim-tile.fail strong {
  color: #f87171;
}

.frontend-progress-track {
  height: 6px;
  margin: 10px 0;
  border-radius: 999px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.frontend-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--accent-color);
  transition: width 0.25s ease;
}

.frontend-flow-list,
.frontend-log-list,
.frontend-case-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.frontend-flow-row,
.frontend-case-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
}

.frontend-flow-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.frontend-flow-icon.state-success {
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.5);
  background: rgba(16, 185, 129, 0.1);
}

.frontend-flow-icon.state-ongoing {
  color: #60a5fa;
  border-color: rgba(96, 165, 250, 0.5);
  background: rgba(96, 165, 250, 0.1);
}

.frontend-flow-icon.state-failed {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.5);
  background: rgba(248, 113, 113, 0.1);
}

.frontend-flow-meta .state-success {
  color: #10b981;
}

.frontend-flow-meta .state-ongoing {
  color: #60a5fa;
}

.frontend-flow-meta .state-failed {
  color: #f87171;
}

.frontend-flow-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.frontend-flow-main strong {
  color: var(--text-primary);
  font-size: 12px;
}

.frontend-flow-main span {
  color: var(--text-secondary);
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.frontend-flow-meta {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-family: 'JetBrains Mono', monospace;
}

.frontend-flow-meta span {
  font-size: 10px;
  font-weight: 700;
}

.frontend-flow-meta small {
  color: var(--text-secondary);
  font-size: 9px;
}

.frontend-sim-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.frontend-case-list-title {
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.frontend-case-row {
  justify-content: space-between;
  font-size: 11px;
}

.frontend-case-row span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.frontend-case-row.failed {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.35);
  background: rgba(248, 113, 113, 0.06);
}

.frontend-case-row.success {
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.35);
  background: rgba(16, 185, 129, 0.06);
}

.frontend-log-content {
  flex: 1;
  min-height: 0;
  padding: 10px;
  overflow: auto;
}

.frontend-log-step {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  overflow: hidden;
}

.frontend-log-step.failed {
  border-color: rgba(248, 113, 113, 0.38);
}

.frontend-log-step.missing {
  border-color: rgba(245, 158, 11, 0.35);
}

.frontend-log-step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 10px;
}

.frontend-log-step-header span {
  color: var(--text-primary);
  font-weight: 700;
}

.frontend-log-step-header small {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.frontend-log-step-header strong {
  color: var(--text-secondary);
  font-size: 9px;
  text-transform: uppercase;
}

.frontend-log-step-header strong.failed {
  color: #f87171;
}

.frontend-log-step pre {
  max-height: 170px;
  margin: 0;
  padding: 9px;
  overflow: auto;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 10px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.flow-log-expand-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  padding: 3px 7px;
  border: 1px solid rgba(var(--accent-rgb, 59, 130, 246), 0.28);
  border-radius: 4px;
  background: rgba(var(--accent-rgb, 59, 130, 246), 0.08);
  color: var(--accent-color);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
}

.flow-log-expand-btn:hover:not(:disabled) {
  border-color: rgba(var(--accent-rgb, 59, 130, 246), 0.5);
  background: rgba(var(--accent-rgb, 59, 130, 246), 0.14);
}

.flow-log-expand-btn:disabled {
  opacity: 0.7;
  cursor: default;
}

.flow-log-expand-btn-spinner {
  animation: spin 900ms linear infinite;
}

.flow-log-error {
  margin: 10px;
  padding: 12px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 6px;
  color: #fecaca;
  background: rgba(239, 68, 68, 0.08);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  line-height: 1.5;
}

.frontend-empty {
  height: 100%;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  font-size: 11px;
}

.frontend-empty.compact {
  min-height: 86px;
}

.frontend-empty i {
  font-size: 24px;
  opacity: 0.45;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.spin {
  animation: spin 1s linear infinite;
}

@media (max-width: 1200px) {
  .frontend-home-dashboard {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(4, minmax(260px, auto));
    overflow: auto;
  }

  .frontend-info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .frontend-sim-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .frontend-info-grid,
  .frontend-stat-grid,
  .frontend-sim-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
