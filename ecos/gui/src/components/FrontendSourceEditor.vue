<template>
  <div class="frontend-source-editor">
    <div v-if="!source?.path" class="source-empty">
      <i class="ri-file-code-line"></i>
      <span>Select a source artifact from Prepare step</span>
    </div>

    <template v-else>
      <div class="source-toolbar">
        <div class="source-meta">
          <strong :title="activePath || source.path">{{ sourceTitle }}</strong>
          <span :title="activePath || source.path">{{ activePath || source.path }}</span>
        </div>
        <div class="source-actions">
          <span class="source-state" :class="{ dirty: isDirty, saving }">{{ sourceStateText }}</span>
          <button type="button" class="icon-action" :title="themeTitle" @click="toggleTheme">
            <i :class="sourceTheme === 'dark' ? 'ri-sun-line' : 'ri-moon-line'"></i>
          </button>
          <button
            type="button"
            class="icon-action"
            title="Reload"
            :disabled="sourceLoading || saving || lintRunning"
            @click="void loadSourceContent()"
          >
            <i :class="sourceLoading ? 'ri-loader-4-line spin' : 'ri-refresh-line'"></i>
          </button>
          <button
            type="button"
            class="icon-action"
            title="Save"
            :disabled="!canSave"
            @click="void saveSource()"
          >
            <i :class="saving ? 'ri-loader-4-line spin' : 'ri-save-3-line'"></i>
          </button>
          <button
            type="button"
            class="text-action"
            :disabled="!canRunLint"
            @click="void runLint()"
          >
            <i :class="lintRunning ? 'ri-loader-4-line spin' : 'ri-shield-check-line'"></i>
            <span>Run Lint</span>
          </button>
        </div>
      </div>

      <div v-if="sourceError" class="source-error">
        <i class="ri-error-warning-line"></i>
        <span>{{ sourceError }}</span>
      </div>

      <div v-show="!sourceError" class="editor-pane">
        <div ref="editorHost" class="monaco-host"></div>
        <div v-if="sourceLoading" class="editor-overlay">
          <i class="ri-loader-4-line spin"></i>
          <span>Loading source...</span>
        </div>
      </div>

      <section class="lint-panel">
        <div class="lint-header">
          <div>
            <strong :class="lintStatusClass">{{ lintTitle }}</strong>
            <span>{{ lintSubtitle }}</span>
          </div>
          <button
            type="button"
            class="icon-action compact"
            :disabled="!lintLog"
            :title="showLintLog ? 'Hide log' : 'Show log'"
            @click="showLintLog = !showLintLog"
          >
            <i :class="showLintLog ? 'ri-list-check' : 'ri-terminal-box-line'"></i>
          </button>
        </div>

        <div v-if="lintError" class="lint-error">{{ lintError }}</div>

        <div v-else-if="diagnostics.length" class="diagnostic-list">
          <button
            v-for="diagnostic in diagnostics"
            :key="diagnosticKey(diagnostic)"
            type="button"
            class="diagnostic-row"
            :class="[diagnostic.severity, { jumpable: diagnosticMatchesCurrent(diagnostic) }]"
            @click="jumpToDiagnostic(diagnostic)"
          >
            <i :class="diagnostic.severity === 'error' ? 'ri-close-circle-line' : 'ri-alert-line'"></i>
            <span class="diagnostic-main">
              <strong>{{ diagnostic.code }}</strong>
              <small>{{ diagnosticLocation(diagnostic) }}</small>
              <em>{{ diagnostic.message || diagnostic.raw }}</em>
            </span>
          </button>
        </div>

        <div v-else class="lint-empty">
          {{ lintRunning ? 'Lint is running...' : 'No lint diagnostics yet' }}
        </div>

        <pre v-if="showLintLog && lintLog" class="lint-log">{{ lintLog }}</pre>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { CMDEnum, InfoEnum, ResponseEnum, StateEnum, StepEnum } from '@/api/type'
import { getInfoApi, runStepApi } from '@/api/flow'
import { useTauri } from '@/composables/useTauri'
import { useWorkspace } from '@/composables/useWorkspace'
import type { FrontendSourceSelection } from '@/stores/frontendSourceViewerStore'
import { useFrontendSourceViewerStore } from '@/stores/frontendSourceViewerStore'
import { resolveProjectOrExternalFileAccess, writeFrontendSourceFile } from '@/utils/projectFs'
import {
  configureFrontendMonaco,
  monaco,
  monacoLanguageForPath,
  monacoThemeName,
  type FrontendEditorTheme,
} from '@/utils/monacoFrontend'
import {
  countVerilatorDiagnostics,
  diagnosticMatchesPath,
  fileName,
  parseVerilatorDiagnostics,
  type VerilatorDiagnostic,
} from '@/utils/verilatorDiagnostics'

interface PathItem {
  label: string
  path: string
}

interface FrontendStepDetail {
  state?: string
  logs?: PathItem[]
  reports?: PathItem[]
}

const LINT_LOG_CHAR_LIMIT = 300000
const SOURCE_THEME_KEY = 'ecos.frontend.source.theme'

const props = defineProps<{
  source: FrontendSourceSelection | null
  openRequestedAt: number
}>()

const { isInTauri } = useTauri()
const { currentProject, showToast, triggerStepRefresh } = useWorkspace()
const sourceStore = useFrontendSourceViewerStore()

const editorHost = ref<HTMLElement | null>(null)
const activePath = ref('')
const activeLabel = ref('')
const sourceLoading = ref(false)
const sourceError = ref('')
const saving = ref(false)
const sourceTheme = ref<FrontendEditorTheme>('dark')
const lintRunning = ref(false)
const lintStatus = ref<'idle' | 'running' | 'success' | 'failed' | 'error'>('idle')
const lintError = ref('')
const lintLog = ref('')
const showLintLog = ref(false)
const diagnostics = ref<VerilatorDiagnostic[]>([])

let editor: ReturnType<typeof monaco.editor.create> | null = null
let model: monaco.editor.ITextModel | null = null
let changeDisposable: { dispose: () => void } | null = null
let savedContent = ''
let sourceLoadToken = 0

const isDirty = computed(() => sourceStore.isDirty)
const sourceTitle = computed(() => activeLabel.value || props.source?.label || fileName(props.source?.path || '') || 'Source')
const sourceStateText = computed(() => {
  if (saving.value) return 'Saving'
  if (sourceLoading.value) return 'Loading'
  return isDirty.value ? 'Unsaved' : 'Saved'
})
const canSave = computed(() => isInTauri && !!activePath.value && !!editor && isDirty.value && !sourceLoading.value && !saving.value)
const canRunLint = computed(() => isInTauri && !!activePath.value && !sourceLoading.value && !saving.value && !lintRunning.value)
const themeTitle = computed(() => sourceTheme.value === 'dark' ? 'Use light editor theme' : 'Use dark editor theme')
const lintCounts = computed(() => countVerilatorDiagnostics(diagnostics.value))
const lintTitle = computed(() => {
  if (lintStatus.value === 'running') return 'Lint running'
  if (lintStatus.value === 'success') return 'Lint passed'
  if (lintStatus.value === 'failed') return 'Lint failed'
  if (lintStatus.value === 'error') return 'Lint error'
  return 'Verilator lint'
})
const lintSubtitle = computed(() => {
  if (lintRunning.value) return 'waiting for backend result'
  const counts = lintCounts.value
  if (counts.errors || counts.warnings) {
    return `${counts.errors} errors · ${counts.warnings} warnings`
  }
  return lintLog.value ? 'no warnings or errors parsed' : 'not run yet'
})
const lintStatusClass = computed(() => ({
  ok: lintStatus.value === 'success',
  failed: lintStatus.value === 'failed' || lintStatus.value === 'error',
  running: lintStatus.value === 'running',
}))

onMounted(() => {
  configureFrontendMonaco()
  sourceTheme.value = initialTheme()
  createEditor()
  void loadSourceContent()
})

onBeforeUnmount(() => {
  changeDisposable?.dispose()
  model?.dispose()
  editor?.dispose()
})

watch(
  () => props.openRequestedAt,
  () => {
    void loadSourceContent()
  },
)

function createEditor(): void {
  if (!editorHost.value || editor) return
  editor = monaco.editor.create(editorHost.value, {
    automaticLayout: true,
    fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: 12,
    lineHeight: 19,
    minimap: { enabled: false },
    renderWhitespace: 'selection',
    scrollBeyondLastLine: false,
    tabSize: 2,
    theme: monacoThemeName(sourceTheme.value),
    value: '',
    wordWrap: 'off',
  })
}

async function loadSourceContent(): Promise<void> {
  const requested = props.source
  const path = requested?.path || ''
  if (!path) return

  const token = ++sourceLoadToken
  sourceLoading.value = true
  sourceError.value = ''
  lintError.value = ''

  try {
    if (!isInTauri) {
      sourceError.value = 'Source editor is available in ECOS Studio desktop.'
      return
    }
    const resolvedPath = await resolveProjectOrExternalFileAccess(path)
    if (!resolvedPath) {
      sourceError.value = `No file-system access to ${path}`
      return
    }
    const text = await readTextFile(resolvedPath)
    if (token !== sourceLoadToken) return

    activePath.value = resolvedPath
    activeLabel.value = requested?.label || fileName(resolvedPath)
    await nextTick()
    setEditorContent(resolvedPath, text)
    resetLintResult()
  } catch (err) {
    if (token !== sourceLoadToken) return
    sourceError.value = err instanceof Error ? err.message : String(err)
  } finally {
    if (token === sourceLoadToken) {
      sourceLoading.value = false
    }
  }
}

function setEditorContent(path: string, text: string): void {
  createEditor()
  if (!editor) return

  changeDisposable?.dispose()
  model?.dispose()
  model = monaco.editor.createModel(text, monacoLanguageForPath(path), monaco.Uri.file(path))
  editor.setModel(model)
  savedContent = text
  sourceStore.setDirty(false)
  changeDisposable = model.onDidChangeContent(() => {
    sourceStore.setDirty((editor?.getValue() || '') !== savedContent)
  })
  applyDiagnosticsToEditor()
}

async function saveSource(): Promise<void> {
  if (!editor || !activePath.value) return
  saving.value = true
  sourceError.value = ''

  try {
    const content = editor.getValue()
    const writtenPath = await writeFrontendSourceFile(activePath.value, content)
    if (!writtenPath) {
      sourceError.value = `Failed to save ${activePath.value}`
      return
    }
    activePath.value = writtenPath
    savedContent = content
    sourceStore.setDirty(false)
    showToast({
      severity: 'success',
      summary: 'Source Saved',
      detail: fileName(writtenPath),
      life: 2500,
    })
  } catch (err) {
    sourceError.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}

async function runLint(): Promise<void> {
  if (sourceStore.isDirty) {
    lintError.value = 'Save source before running lint.'
    return
  }
  if (!isInTauri) {
    lintError.value = 'Lint requires ECOS Studio desktop.'
    return
  }

  lintRunning.value = true
  lintStatus.value = 'running'
  lintError.value = ''
  lintLog.value = ''
  diagnostics.value = []
  applyDiagnosticsToEditor()

  try {
    const response = await runStepApi({
      cmd: CMDEnum.run_step,
      data: {
        step: StepEnum.LINT,
        rerun: true,
      },
    }, currentProject.value?.designTool)

    await loadLintResult()
    triggerStepRefresh()

    const ok = response.response === ResponseEnum.success && response.data?.state === StateEnum.Success
    lintStatus.value = ok ? 'success' : 'failed'
    showToast({
      severity: ok ? 'success' : 'error',
      summary: ok ? 'Lint Completed' : 'Lint Failed',
      detail: lintSubtitle.value,
      life: ok ? 3500 : 6000,
    })
  } catch (err) {
    lintStatus.value = 'error'
    lintError.value = err instanceof Error ? err.message : String(err)
  } finally {
    lintRunning.value = false
  }
}

async function loadLintResult(): Promise<void> {
  const response = await getInfoApi({
    cmd: CMDEnum.get_info,
    data: {
      step: StepEnum.LINT,
      id: InfoEnum.frontend_detail,
    },
  }, currentProject.value?.designTool)

  const detail = response.data?.info as FrontendStepDetail | undefined
  const lintText = await readLintText(detail)
  lintLog.value = lintText
  showLintLog.value = !lintText
  diagnostics.value = parseVerilatorDiagnostics(lintText)
  applyDiagnosticsToEditor()
}

async function readLintText(detail?: FrontendStepDetail): Promise<string> {
  const items = uniquePathItems([
    ...(detail?.logs || []),
    ...(detail?.reports || []),
  ]).filter((item) => /\.(log|txt|rpt)$/i.test(item.path))

  const parts: string[] = []
  for (const item of items) {
    const resolved = await resolveProjectOrExternalFileAccess(item.path)
    if (!resolved) continue
    try {
      const text = await readTextFile(resolved)
      parts.push(`--- ${item.label || fileName(item.path)} ---\n${text}`)
    } catch (err) {
      parts.push(`--- ${item.label || fileName(item.path)} ---\n${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const combined = parts.join('\n\n').trim()
  if (combined.length <= LINT_LOG_CHAR_LIMIT) return combined
  return `... (truncated, ${combined.length} chars total)\n\n${combined.slice(-LINT_LOG_CHAR_LIMIT)}`
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

function applyDiagnosticsToEditor(): void {
  if (!model) return
  const markers = diagnostics.value
    .filter((diagnostic) => diagnosticMatchesCurrent(diagnostic))
    .map((diagnostic) => ({
      severity: diagnostic.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
      message: `${diagnostic.code}: ${diagnostic.message || diagnostic.raw}`,
      startLineNumber: diagnostic.line,
      startColumn: diagnostic.column,
      endLineNumber: diagnostic.line,
      endColumn: diagnostic.column + 1,
    }))
  monaco.editor.setModelMarkers(model, 'verilator', markers)
}

function resetLintResult(): void {
  lintStatus.value = 'idle'
  lintError.value = ''
  lintLog.value = ''
  showLintLog.value = false
  diagnostics.value = []
  applyDiagnosticsToEditor()
}

function toggleTheme(): void {
  sourceTheme.value = sourceTheme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem(SOURCE_THEME_KEY, sourceTheme.value)
  monaco.editor.setTheme(monacoThemeName(sourceTheme.value))
}

function initialTheme(): FrontendEditorTheme {
  const stored = localStorage.getItem(SOURCE_THEME_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function jumpToDiagnostic(diagnostic: VerilatorDiagnostic): void {
  if (!editor || !diagnosticMatchesCurrent(diagnostic)) return
  editor.focus()
  editor.setPosition({ lineNumber: diagnostic.line, column: diagnostic.column })
  editor.revealLineInCenter(diagnostic.line)
}

function diagnosticMatchesCurrent(diagnostic: VerilatorDiagnostic): boolean {
  return diagnosticMatchesPath(diagnostic.file, activePath.value)
}

function diagnosticKey(diagnostic: VerilatorDiagnostic): string {
  return `${diagnostic.severity}:${diagnostic.code}:${diagnostic.file}:${diagnostic.line}:${diagnostic.column}:${diagnostic.message}`
}

function diagnosticLocation(diagnostic: VerilatorDiagnostic): string {
  return `${fileName(diagnostic.file)}:${diagnostic.line}:${diagnostic.column}`
}
</script>

<style scoped>
.frontend-source-editor {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  background: var(--bg-primary);
}

.source-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.source-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.source-meta strong {
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-meta span {
  color: var(--text-secondary);
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.source-state {
  height: 24px;
  display: inline-flex;
  align-items: center;
  padding: 0 7px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 700;
}

.source-state.dirty {
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.5);
}

.source-state.saving {
  color: var(--accent-color);
  border-color: rgba(59, 130, 246, 0.5);
}

.icon-action,
.text-action {
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
}

.icon-action {
  width: 28px;
}

.icon-action.compact {
  width: 26px;
  height: 26px;
}

.text-action {
  gap: 6px;
  padding: 0 9px;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 700;
}

.icon-action:hover:not(:disabled),
.text-action:hover:not(:disabled) {
  color: var(--accent-color);
  border-color: var(--accent-color);
}

.icon-action:disabled,
.text-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.editor-pane {
  position: relative;
  flex: 1;
  min-height: 180px;
  min-width: 0;
  overflow: hidden;
}

.monaco-host {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.editor-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary);
  background: rgba(15, 17, 23, 0.42);
  font-size: 11px;
}

.lint-panel {
  flex: 0 0 188px;
  min-height: 132px;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  overflow: hidden;
}

.lint-header {
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--border-color);
}

.lint-header > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.lint-header strong {
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.2;
}

.lint-header strong.ok {
  color: #22c55e;
}

.lint-header strong.failed {
  color: #ef4444;
}

.lint-header strong.running {
  color: var(--accent-color);
}

.lint-header span {
  color: var(--text-secondary);
  font-size: 10px;
  line-height: 1.2;
}

.diagnostic-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.diagnostic-row {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border: 0;
  border-bottom: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
}

.diagnostic-row.jumpable {
  cursor: pointer;
}

.diagnostic-row.jumpable:hover {
  background: var(--bg-hover);
}

.diagnostic-row.error > i {
  color: #ef4444;
}

.diagnostic-row.warning > i {
  color: #f59e0b;
}

.diagnostic-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.diagnostic-main strong {
  font-size: 11px;
  color: var(--text-primary);
}

.diagnostic-main small {
  color: var(--text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
}

.diagnostic-main em {
  color: var(--text-secondary);
  font-size: 11px;
  font-style: normal;
  line-height: 1.35;
  word-break: break-word;
}

.lint-empty,
.lint-error,
.source-empty,
.source-error {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 11px;
}

.lint-error,
.source-error {
  color: #ef4444;
}

.source-empty i,
.source-error i {
  font-size: 20px;
  opacity: 0.75;
}

.lint-log {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 10px;
  border-top: 1px solid var(--border-color);
  overflow: auto;
  color: var(--text-primary);
  background: var(--bg-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  line-height: 1.45;
  white-space: pre;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
