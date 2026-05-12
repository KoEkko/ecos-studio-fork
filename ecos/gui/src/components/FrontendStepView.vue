<template>
  <div class="frontend-step-view">
    <div class="frontend-step-shell">
      <header class="frontend-step-header">
        <div class="frontend-step-title">
          <div class="frontend-step-icon">
            <i :class="stepIcon"></i>
          </div>
          <div>
            <h2>{{ stepTitle }}</h2>
            <p>{{ detail?.tool || 'frontend' }} step result</p>
          </div>
        </div>
        <div class="frontend-step-actions">
          <button type="button" class="icon-button" title="Refresh" :disabled="loading" @click="loadDetail">
            <i :class="loading ? 'ri-loader-4-line spin' : 'ri-refresh-line'"></i>
          </button>
        </div>
      </header>

      <div v-if="loading" class="frontend-step-state">
        <i class="ri-loader-4-line spin"></i>
        <span>Loading step result...</span>
      </div>

      <div v-else-if="error" class="frontend-step-error">
        <i class="ri-error-warning-line"></i>
        <span>{{ error }}</span>
      </div>

      <template v-else>
        <section class="summary-grid">
          <div class="summary-tile status-tile" :class="statusClass">
            <span class="summary-label">Status</span>
            <strong>{{ detail?.state || 'Unstart' }}</strong>
          </div>
          <div class="summary-tile">
            <span class="summary-label">Runtime</span>
            <strong>{{ detail?.runtime || '--:--:--' }}</strong>
          </div>
          <div class="summary-tile">
            <span class="summary-label">Tool</span>
            <strong>{{ detail?.tool || '-' }}</strong>
          </div>
          <div v-if="isSimStep" class="summary-tile">
            <span class="summary-label">Suite</span>
            <strong>{{ detail?.summary?.test_suite || 'Default' }}</strong>
          </div>
          <div v-if="isSimStep" class="summary-tile pass-tile">
            <span class="summary-label">Passed</span>
            <strong>{{ passedCases }}</strong>
          </div>
          <div v-if="isSimStep" class="summary-tile fail-tile">
            <span class="summary-label">Failed</span>
            <strong>{{ failedCases }}</strong>
          </div>
          <div v-if="isSimStep" class="summary-tile">
            <span class="summary-label">Total Cases</span>
            <strong>{{ totalCases }}</strong>
          </div>
        </section>

        <div class="frontend-step-tabs">
          <button v-for="tab in visibleTabs" :key="tab.id" type="button"
            class="frontend-step-tab"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id">
            <i :class="tab.icon"></i>
            <span>{{ tab.label }}</span>
          </button>
        </div>

        <main class="frontend-step-content">
          <section v-if="activeTab === 'summary'" class="detail-panel">
            <div class="panel-header">
              <h3>Result Summary</h3>
              <button type="button" class="text-button" :disabled="!detail?.summary"
                @click="sendToInspector('Summary', detail?.summary || {})">
                <i class="ri-send-plane-line"></i>
                <span>Send</span>
              </button>
            </div>
            <pre class="json-block">{{ formattedSummary }}</pre>
          </section>

          <section v-else-if="activeTab === 'cases'" class="cases-panel">
            <div class="panel-header">
              <h3>Simulation Cases</h3>
              <span class="panel-meta">{{ totalCases }} cases</span>
            </div>
            <div v-if="cases.length === 0" class="empty-panel">
              <i class="ri-file-list-3-line"></i>
              <span>No simulation case result yet</span>
            </div>
            <div v-else class="cases-table-wrap">
              <table class="cases-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Status</th>
                    <th>RC</th>
                    <th>Wave</th>
                    <th>Image</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="testCase in cases" :key="testCase.name"
                    :class="{ selected: selectedCase?.name === testCase.name, failed: !testCase.ok }"
                    @click="selectCase(testCase)">
                    <td>
                      <div class="case-name">
                        <i :class="testCase.ok ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'"></i>
                        <span>{{ testCase.name }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="case-status" :class="testCase.ok ? 'ok' : 'failed'">
                        {{ testCase.ok ? 'PASS' : 'FAIL' }}
                      </span>
                    </td>
                    <td>{{ testCase.returncode ?? '-' }}</td>
                    <td>
                      <button
                        v-if="testCase.wave"
                        type="button"
                        class="path-pill path-button"
                        :title="testCase.wave"
                        @click.stop="openWaveform(testCase.wave, testCase.name)"
                      >
                        <i class="ri-pulse-line"></i>
                        <span>{{ fileName(testCase.wave) }}</span>
                      </button>
                      <span v-else class="path-pill">-</span>
                    </td>
                    <td>
                      <span class="path-pill" :title="testCase.image || ''">
                        {{ testCase.image ? fileName(testCase.image) : '-' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section v-else-if="activeTab === 'log'" class="log-panel">
            <div class="panel-header">
              <div>
                <h3>Execution Log</h3>
                <p>{{ selectedLogPath || 'No log selected' }}</p>
              </div>
              <div class="panel-actions">
                <select v-model="selectedLogPath" class="log-select" @change="loadSelectedLog">
                  <option v-for="log in availableLogs" :key="log.path" :value="log.path">
                    {{ log.label }}
                  </option>
                </select>
                <button type="button" class="icon-button" title="Reload log" :disabled="logLoading || !selectedLogPath"
                  @click="loadSelectedLog">
                  <i :class="logLoading ? 'ri-loader-4-line spin' : 'ri-refresh-line'"></i>
                </button>
                <button type="button" class="text-button" :disabled="!logContent"
                  @click="sendToInspector('Log', logContent)">
                  <i class="ri-send-plane-line"></i>
                  <span>Send</span>
                </button>
              </div>
            </div>
            <pre class="log-viewer" :class="{ empty: !logContent }">{{ logContent || 'No log content' }}</pre>
          </section>

          <section v-else-if="activeTab === 'reports'" class="files-panel">
            <div class="panel-header">
              <h3>Reports</h3>
              <span class="panel-meta">{{ reports.length }} files</span>
            </div>
            <div v-if="reports.length === 0" class="empty-panel">
              <i class="ri-folder-open-line"></i>
              <span>No reports yet</span>
            </div>
            <div v-else class="file-list">
              <button v-for="item in reports" :key="item.path" type="button" class="file-row" :title="item.path"
                @click="sendFileToInspector(item)">
                <i :class="fileIcon(item.path)"></i>
                <span class="file-row-main">
                  <strong>{{ item.label || fileName(item.path) }}</strong>
                  <small>{{ shortPath(item.path) }}</small>
                </span>
                <i class="ri-arrow-right-s-line"></i>
              </button>
            </div>
          </section>

          <section v-else-if="activeTab === 'artifacts'" class="files-panel">
            <div class="panel-header">
              <h3>Artifacts</h3>
              <span class="panel-meta">{{ artifacts.length }} files</span>
            </div>
            <div v-if="artifacts.length === 0" class="empty-panel">
              <i class="ri-folder-open-line"></i>
              <span>No artifacts yet</span>
            </div>
            <div v-else class="file-list">
              <button v-for="item in artifacts" :key="item.path" type="button" class="file-row" :title="item.path"
                @click="handleArtifactClick(item)">
                <i :class="fileIcon(item.path)"></i>
                <span class="file-row-main">
                  <strong>{{ item.label || fileName(item.path) }}</strong>
                  <small>{{ shortPath(item.path) }}</small>
                </span>
                <i class="ri-arrow-right-s-line"></i>
              </button>
            </div>
          </section>

          <section v-else-if="activeTab === 'src'" class="files-panel source-panel">
            <div class="panel-header">
              <div>
                <h3>Source Files</h3>
                <p>RTL and filelist paths parsed from frontend inputs</p>
              </div>
              <span class="panel-meta">{{ sourceArtifacts.length }} files</span>
            </div>
            <div v-if="sourceArtifacts.length === 0" class="empty-panel">
              <i class="ri-code-s-slash-line"></i>
              <span>No source files discovered yet</span>
            </div>
            <div v-else class="source-file-list">
              <button
                v-for="item in sourceArtifacts"
                :key="item.path"
                type="button"
                class="source-file-row"
                :title="item.path"
                @click="openSourceArtifact(item)"
              >
                <span class="source-file-icon">
                  <i :class="fileIcon(item.path)"></i>
                </span>
                <span class="source-file-main">
                  <span class="source-file-title">
                    <strong>{{ sourceDisplayName(item) }}</strong>
                    <em>{{ sourceLanguageLabel(item.path) }}</em>
                  </span>
                  <small>{{ sourcePathHint(item.path) }}</small>
                </span>
                <span class="source-file-open">
                  <i class="ri-edit-2-line"></i>
                </span>
              </button>
            </div>
          </section>
        </main>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { CMDEnum, InfoEnum, ResponseEnum, StepEnum, getStepMetadata } from '@/api/type'
import { getInfoApi } from '@/api/flow'
import { useWorkspace } from '@/composables/useWorkspace'
import { useTauri } from '@/composables/useTauri'
import { requestProjectPathAccess } from '@/utils/projectFs'
import { useMessageStore } from '@/stores/messageStore'
import { useWaveformViewerStore } from '@/stores/waveformViewerStore'
import { useFrontendSourceViewerStore } from '@/stores/frontendSourceViewerStore'

interface PathItem {
  label: string
  path: string
}

interface SimCase {
  name: string
  ok: boolean
  returncode?: number
  image?: string
  log?: string
  report_log?: string
  run_log?: string
  wave?: string
  run_id?: string
}

interface FrontendStepDetail {
  step: string
  tool: string
  state: string
  runtime: string
  peak_memory_mb?: number
  summary: Record<string, unknown>
  cases?: SimCase[]
  logs: PathItem[]
  reports: PathItem[]
  artifacts: PathItem[]
}

const route = useRoute()
const { currentProject, sseMessages, stepRefreshCounter } = useWorkspace()
const { isInTauri } = useTauri()
const messageStore = useMessageStore()
const waveformStore = useWaveformViewerStore()
const sourceViewerStore = useFrontendSourceViewerStore()

const stepEnumValues = Object.values(StepEnum)
const currentStep = computed(() => {
  const currentPath = route.path.split('/').filter(Boolean).pop() || ''
  return stepEnumValues.find((step) => step.toLowerCase() === currentPath.toLowerCase())
})

const detail = ref<FrontendStepDetail | null>(null)
const loading = ref(false)
const error = ref('')
const activeTab = ref<'summary' | 'cases' | 'log' | 'reports' | 'artifacts' | 'src'>('summary')
const selectedCase = ref<SimCase | null>(null)
const selectedLogPath = ref('')
const logContent = ref('')
const logLoading = ref(false)

const isSimStep = computed(() => currentStep.value?.toLowerCase() === StepEnum.SIM.toLowerCase())
const cases = computed(() => detail.value?.cases || [])
const reports = computed(() => detail.value?.reports || [])
const allArtifacts = computed(() => {
  const base = detail.value?.artifacts || []
  const fromCases = cases.value.flatMap((testCase) => [
    testCase.wave ? { label: `${testCase.name} wave`, path: testCase.wave } : null,
    testCase.image ? { label: `${testCase.name} image`, path: testCase.image } : null,
  ]).filter(Boolean) as PathItem[]
  return uniquePathItems([...base, ...fromCases])
})
const sourceArtifacts = computed(() => allArtifacts.value.filter((item) => isSourceArtifactPath(item.path)))
const artifacts = computed(() => allArtifacts.value.filter((item) => !isSourceArtifactPath(item.path)))
const totalCases = computed(() => cases.value.length)
const passedCases = computed(() => cases.value.filter((testCase) => testCase.ok).length)
const failedCases = computed(() => cases.value.filter((testCase) => !testCase.ok).length)

const visibleTabs = computed(() => [
  { id: 'summary' as const, label: 'Summary', icon: 'ri-dashboard-3-line' },
  ...(isSimStep.value ? [{ id: 'cases' as const, label: 'Cases', icon: 'ri-list-check-3' }] : []),
  { id: 'log' as const, label: 'Log', icon: 'ri-terminal-box-line' },
  { id: 'reports' as const, label: 'Reports', icon: 'ri-file-chart-line' },
  { id: 'artifacts' as const, label: 'Artifacts', icon: 'ri-folder-3-line' },
  { id: 'src' as const, label: 'Src', icon: 'ri-code-s-slash-line' },
])

const stepTitle = computed(() => getStepMetadata(currentStep.value || '')?.label || currentStep.value || 'Frontend Step')
const stepIcon = computed(() => getStepMetadata(currentStep.value || '')?.icon || 'ri-terminal-box-line')
const statusClass = computed(() => {
  const state = (detail.value?.state || '').toLowerCase()
  if (state === 'success') return 'status-success'
  if (state === 'ongoing') return 'status-running'
  if (state === 'incomplete' || state === 'invalid') return 'status-failed'
  return 'status-idle'
})

const formattedSummary = computed(() => JSON.stringify(detail.value?.summary || {}, null, 2))
const availableLogs = computed(() => {
  const logs = [...(detail.value?.logs || [])]
  const selected = selectedCase.value
  if (selected) {
    const caseLogs = [
      selected.log ? { label: `${selected.name} log`, path: selected.log } : null,
      selected.report_log ? { label: `${selected.name} report log`, path: selected.report_log } : null,
      selected.run_log ? { label: `${selected.name} run log`, path: selected.run_log } : null,
    ].filter(Boolean) as PathItem[]
    return [
      ...caseLogs,
      ...logs.filter((log) => !caseLogs.some((item) => item.path === log.path)),
    ]
  }
  return logs
})

async function loadDetail(): Promise<void> {
  if (!currentStep.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await getInfoApi({
      cmd: CMDEnum.get_info,
      data: {
        step: currentStep.value,
        id: InfoEnum.frontend_detail,
      },
    }, currentProject.value?.designTool)

    if (response.response !== ResponseEnum.success) {
      throw new Error(response.message?.join(', ') || 'Failed to load frontend step detail')
    }
    detail.value = response.data?.info as FrontendStepDetail
    selectedCase.value = cases.value[0] || null
    selectedLogPath.value = availableLogs.value[0]?.path || ''
    await loadSelectedLog()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function loadSelectedLog(): Promise<void> {
  logContent.value = ''
  if (!selectedLogPath.value) return
  logLoading.value = true
  try {
    if (!isInTauri) {
      logContent.value = `File path: ${selectedLogPath.value}\n(Readable only in Tauri environment)`
      return
    }
    if (!(await requestProjectPathAccess(selectedLogPath.value))) {
      logContent.value = `File path: ${selectedLogPath.value}\n(No file-system access in current workspace scope)`
      return
    }
    logContent.value = await readTextFile(selectedLogPath.value)
  } catch (err) {
    logContent.value = err instanceof Error ? err.message : String(err)
  } finally {
    logLoading.value = false
  }
}

async function selectCase(testCase: SimCase): Promise<void> {
  selectedCase.value = testCase
  activeTab.value = 'log'
  selectedLogPath.value = testCase.log || testCase.report_log || testCase.run_log || availableLogs.value[0]?.path || ''
  await loadSelectedLog()
}

async function sendFileToInspector(item: PathItem): Promise<void> {
  let content: unknown = item.path
  let format: 'json' | 'csv' | 'text' | 'html' = fileFormat(item.path)
  if (isInTauri && await requestProjectPathAccess(item.path)) {
    const text = await readTextFile(item.path)
    if (format === 'json') {
      try {
        content = JSON.parse(text)
      } catch {
        content = text
      }
    } else {
      content = text
    }
  }
  sendToInspector(item.label || fileName(item.path), content, format)
}

function handleArtifactClick(item: PathItem): void {
  if (isWaveformPath(item.path)) {
    openWaveform(item.path, caseNameFromArtifactLabel(item.label))
    return
  }
  if (isSourceArtifactPath(item.path)) {
    openSourceArtifact(item)
    return
  }
  void sendFileToInspector(item)
}

function openSourceArtifact(item: PathItem): void {
  sourceViewerStore.openSource({
    path: item.path,
    label: item.label || fileName(item.path),
    step: currentStep.value || 'frontend',
  })
}

function openWaveform(path: string, caseName?: string): void {
  waveformStore.openWave({
    path,
    caseName,
    step: currentStep.value || 'frontend',
  })
}

function sendToInspector(title: string, content: unknown, format: 'json' | 'csv' | 'text' | 'html' = 'json'): void {
  messageStore.addInfoMessage({
    title,
    step: currentStep.value || 'frontend',
    items: [{ label: title, content, format }],
  })
}

watch(currentStep, () => {
  activeTab.value = 'summary'
  void loadDetail()
}, { immediate: true })

watch(stepRefreshCounter, () => {
  void loadDetail()
})

watch(
  () => sseMessages.value.length,
  (newLen, oldLen) => {
    if (newLen <= (oldLen ?? 0)) return
    const latest = sseMessages.value[newLen - 1]
    const sseStep = latest?.data?.step as string | undefined
    if (sseStep && currentStep.value && sseStep.toLowerCase() === currentStep.value.toLowerCase()) {
      void loadDetail()
    }
  }
)

function fileName(path: string): string {
  return path.split('/').filter(Boolean).pop() || path
}

function shortPath(path: string): string {
  return path.split('/').filter(Boolean).slice(-4).join('/')
}

function sourcePathHint(path: string): string {
  return path.split('/').filter(Boolean).slice(-5, -1).join('/') || path
}

function sourceDisplayName(item: PathItem): string {
  const label = item.label || fileName(item.path)
  return label.startsWith('CPU RTL · ') ? label.slice('CPU RTL · '.length) : label
}

function sourceLanguageLabel(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'sv' || ext === 'svh') return 'SystemVerilog'
  if (ext === 'v' || ext === 'vh') return 'Verilog'
  if (ext === 'f' || ext === 'fl' || ext === 'filelist') return 'Filelist'
  if (ext === 'c' || ext === 'cc' || ext === 'cpp' || ext === 'h' || ext === 'hpp') return 'C/C++'
  if (ext === 'py') return 'Python'
  if (ext === 'sh') return 'Shell'
  if (ext === 'tcl') return 'Tcl'
  if (ext === 's' || ext === 'asm') return 'ASM'
  return 'Source'
}

function fileFormat(path: string): 'json' | 'csv' | 'text' | 'html' {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'json') return 'json'
  if (ext === 'csv') return 'csv'
  if (ext === 'html' || ext === 'htm') return 'html'
  return 'text'
}

function isWaveformPath(path: string): boolean {
  return /\.(vcd|fst|ghw)$/i.test(path)
}

function isSourceArtifactPath(path: string): boolean {
  return /\.(v|sv|vh|svh|c|cc|cpp|h|hpp|f|fl|filelist|py|sh|tcl|s|asm)$/i.test(path)
}

function caseNameFromArtifactLabel(label: string): string | undefined {
  return label.endsWith(' wave') ? label.slice(0, -5) : undefined
}

function fileIcon(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'json') return 'ri-braces-line'
  if (ext === 'vcd' || ext === 'fst' || ext === 'ghw') return 'ri-pulse-line'
  if (ext === 'bin' || ext === 'elf') return 'ri-cpu-line'
  if (ext === 'v' || ext === 'sv' || ext === 'vh' || ext === 'svh') return 'ri-code-s-slash-line'
  if (ext === 'f' || ext === 'fl' || ext === 'filelist') return 'ri-file-list-3-line'
  if (ext === 'rpt') return 'ri-file-chart-line'
  return 'ri-file-text-line'
}

function uniquePathItems(items: PathItem[]): PathItem[] {
  const seen = new Set<string>()
  const result: PathItem[] = []
  for (const item of items) {
    const path = String(item.path || '').trim()
    if (!path || seen.has(path)) continue
    seen.add(path)
    result.push({ ...item, path })
  }
  return result
}
</script>

<style scoped>
.frontend-step-view {
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
}

.frontend-step-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 14px;
  gap: 12px;
}

.frontend-step-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.frontend-step-title {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
}

.frontend-step-title h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 750;
}

.frontend-step-title p {
  margin: 2px 0 0;
  color: var(--text-secondary);
  font-size: 11px;
}

.frontend-step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: var(--bg-secondary);
  color: var(--accent-color);
  font-size: 18px;
}

.frontend-step-actions,
.panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-button,
.text-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-button {
  width: 30px;
}

.text-button {
  padding: 0 10px;
  font-size: 11px;
  font-weight: 700;
}

.icon-button:hover:not(:disabled),
.text-button:hover:not(:disabled) {
  border-color: var(--text-secondary);
}

.icon-button:disabled,
.text-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
  gap: 8px;
}

.summary-tile {
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: var(--bg-secondary);
}

.summary-label {
  display: block;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.summary-tile strong {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
}

.status-success strong,
.pass-tile strong {
  color: #10b981;
}

.status-running strong {
  color: #60a5fa;
}

.status-failed strong,
.fail-tile strong {
  color: #ef4444;
}

.frontend-step-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  border-bottom: 1px solid var(--border-color);
}

.frontend-step-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.frontend-step-tab.active {
  border-bottom-color: var(--accent-color);
  color: var(--accent-color);
}

.frontend-step-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.detail-panel,
.cases-panel,
.log-panel,
.files-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: color-mix(in srgb, var(--bg-secondary) 46%, var(--bg-primary));
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
}

.panel-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 750;
}

.panel-header p {
  max-width: 720px;
  margin: 2px 0 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-meta {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
}

.json-block,
.log-viewer {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 12px;
  overflow: auto;
  color: var(--text-primary);
  background: var(--bg-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.log-viewer.empty {
  color: var(--text-secondary);
}

.cases-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.cases-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.cases-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 10px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 10px;
  text-align: left;
  text-transform: uppercase;
}

.cases-table td {
  padding: 8px 10px;
  border-top: 1px solid var(--border-color);
  vertical-align: middle;
}

.cases-table tbody tr {
  cursor: pointer;
}

.cases-table tbody tr:hover,
.cases-table tbody tr.selected {
  background: color-mix(in srgb, var(--accent-color) 9%, transparent);
}

.cases-table tbody tr.failed {
  background: color-mix(in srgb, #ef4444 6%, transparent);
}

.case-name {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.case-name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-status {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
}

.case-status.ok {
  background: rgba(16, 185, 129, 0.14);
  color: #10b981;
}

.case-status.failed {
  background: rgba(239, 68, 68, 0.14);
  color: #ef4444;
}

.path-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 180px;
  overflow: hidden;
  color: var(--text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-pill span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.path-button {
  height: 24px;
  padding: 0 7px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  cursor: pointer;
}

.path-button:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.log-select {
  max-width: 260px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 11px;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  overflow: auto;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
}

.file-row:hover {
  border-color: var(--text-secondary);
  background: var(--bg-secondary);
}

.file-row-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.file-row-main strong,
.file-row-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-row-main strong {
  font-size: 12px;
}

.file-row-main small {
  color: var(--text-secondary);
  font-size: 10px;
}

.source-panel .panel-header {
  align-items: flex-start;
}

.source-file-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px;
  padding: 10px;
  overflow: auto;
}

.source-file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--accent-color) 7%, transparent), transparent 52%),
    var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease;
}

.source-file-row:hover {
  border-color: var(--accent-color);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--accent-color) 12%, transparent), transparent 58%),
    var(--bg-secondary);
  transform: translateY(-1px);
}

.source-file-icon,
.source-file-open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--accent-color);
}

.source-file-open {
  width: 24px;
  height: 24px;
  color: var(--text-secondary);
}

.source-file-row:hover .source-file-open {
  border-color: color-mix(in srgb, var(--accent-color) 55%, var(--border-color));
  color: var(--accent-color);
}

.source-file-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: 4px;
}

.source-file-title {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 7px;
}

.source-file-title strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 750;
}

.source-file-title em {
  flex: 0 0 auto;
  max-width: 94px;
  overflow: hidden;
  padding: 2px 6px;
  border: 1px solid color-mix(in srgb, var(--accent-color) 35%, var(--border-color));
  border-radius: 999px;
  color: var(--accent-color);
  font-size: 9px;
  font-style: normal;
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.source-file-main small {
  overflow: hidden;
  color: var(--text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-panel,
.frontend-step-state,
.frontend-step-error {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 160px;
  color: var(--text-secondary);
  font-size: 12px;
}

.frontend-step-error {
  color: #ef4444;
}

.spin {
  animation: spin 0.85s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
