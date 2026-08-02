<template>
  <div v-show="expanded" class="ecos-terminal-tab" aria-label="Terminal">
    <!-- `defer` lets the shared panel header render before this teleport resolves it. -->
    <Teleport v-if="expanded" defer to="#bottom-panel-actions">
      <div ref="terminalActions" class="terminal-actions" aria-label="Terminal actions">
        <span
          v-if="activeTerminalRecord?.cwdPath"
          class="terminal-cwd"
          :title="activeTerminalRecord.cwdPath"
        >
          {{ activeTerminalRecord.cwdPath }}
        </span>
        <button
          class="terminal-icon-button"
          type="button"
          title="New Terminal"
          aria-label="New Terminal"
          @click="createAndActivateTerminal"
        >
          <i class="ri-add-line" aria-hidden="true"></i>
        </button>
        <button
          class="terminal-icon-button terminal-icon-button--compact"
          type="button"
          title="Terminal Profiles"
          aria-label="Terminal Profiles"
          @click.stop="toggleProfilesMenu"
        >
          <i class="ri-arrow-down-s-line" aria-hidden="true"></i>
        </button>
        <div v-if="showProfilesMenu" class="terminal-menu terminal-profile-menu">
          <button
            type="button"
            class="terminal-menu-item"
            @click="createAndActivateTerminal"
          >
            Default shell
          </button>
        </div>
      </div>
    </Teleport>
    <div ref="terminalBody" class="terminal-body">
      <div ref="terminalWorkspace" class="terminal-workspace">
        <div class="terminal-surfaces">
          <div
            v-for="record in terminalRecords"
            :key="record.localId"
            :ref="(element) => setTerminalSurface(record, element)"
            v-show="record.localId === activeTerminalId"
            class="terminal-surface"
            :class="{ 'terminal-surface--active': record.localId === activeTerminalId }"
          ></div>
        </div>
        <div
          v-if="terminalRecords.length > 0"
          class="terminal-session-resize-handle"
          aria-hidden="true"
          @pointerdown="handleSessionListResizePointerDown"
        ></div>
        <div
          v-if="terminalRecords.length > 0"
          class="terminal-session-list"
          role="tablist"
          aria-label="Terminal session list"
          :style="terminalSessionListStyle"
        >
          <div
            v-for="record in terminalRecords"
            :key="record.localId"
            class="terminal-session-item"
            :class="{
              'terminal-session-item--active': record.localId === activeTerminalId,
            }"
          >
            <button
              class="terminal-session-activate"
              type="button"
              role="tab"
              :aria-selected="record.localId === activeTerminalId"
              :title="getTerminalRecordTitle(record)"
              @click="activateTerminal(record.localId)"
            >
              <i class="ri-terminal-box-line" aria-hidden="true"></i>
              <span>{{ record.label }}</span>
              <i
                v-if="record.exitCode !== null"
                class="ri-alert-line terminal-session-warning"
                aria-hidden="true"
              ></i>
            </button>
            <button
              class="terminal-session-delete"
              type="button"
              title="Close Terminal"
              aria-label="Close Terminal"
              @click.stop="deleteTerminal(record.localId)"
            >
              <i class="ri-delete-bin-line" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { Terminal, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { getOptionalDesktopApi } from '@/platform/desktop'
import '@xterm/xterm/css/xterm.css'

const props = defineProps<{
  /** True only while the shared bottom panel is open on the terminal tab. */
  expanded: boolean
  maximized: boolean
  projectPath: string | null
  themeName: 'light' | 'dark'
}>()

const terminalThemes: Record<'light' | 'dark', ITheme> = {
  dark: {
    background: '#18181c',
    black: '#18181c',
    blue: '#3b8eea',
    brightBlack: '#9a9a9a',
    brightBlue: '#6cb6ff',
    brightCyan: '#4ec9b0',
    brightGreen: '#23d18b',
    brightMagenta: '#d670d6',
    brightRed: '#f14c4c',
    brightWhite: '#f2f2f2',
    brightYellow: '#dcdcaa',
    cursor: '#e3e3e8',
    cyan: '#4ec9b0',
    foreground: '#e3e3e8',
    green: '#23d18b',
    magenta: '#bc3fbc',
    red: '#f14c4c',
    selectionBackground: '#264f78',
    white: '#e3e3e8',
    yellow: '#dcdcaa',
  },
  light: {
    background: '#ffffff',
    black: '#111827',
    blue: '#2563eb',
    brightBlack: '#6b7280',
    brightBlue: '#1d4ed8',
    brightCyan: '#0e7490',
    brightGreen: '#047857',
    brightMagenta: '#7e22ce',
    brightRed: '#b91c1c',
    brightWhite: '#111827',
    brightYellow: '#b45309',
    cursor: '#111827',
    cyan: '#0891b2',
    foreground: '#111827',
    green: '#047857',
    magenta: '#9333ea',
    red: '#dc2626',
    selectionBackground: '#bfdbfe',
    white: '#374151',
    yellow: '#ca8a04',
  },
}
const DEFAULT_TERMINAL_SESSION_LIST_WIDTH = 150
const MIN_TERMINAL_SESSION_LIST_WIDTH = 104
const MAX_TERMINAL_SESSION_LIST_WIDTH = 280

interface TerminalRecord {
  fitAddon: FitAddon
  label: string
  localId: string
  cwdPath: string | null
  exitCode: number | null
  opened: boolean
  sessionId: string | null
  shellStartPromise: Promise<void> | null
  surfaceElement: HTMLElement | null
  terminal: Terminal
}

const terminalBody = ref<HTMLElement | null>(null)
const terminalWorkspace = ref<HTMLElement | null>(null)
const terminalActions = ref<HTMLElement | null>(null)
const terminalRecords = shallowRef<TerminalRecord[]>([])
const activeTerminalId = ref<string | null>(null)
const showProfilesMenu = ref(false)
const terminalSessionListWidth = ref(DEFAULT_TERMINAL_SESSION_LIST_WIDTH)
const activeTerminalRecord = computed(
  () =>
    terminalRecords.value.find((record) => record.localId === activeTerminalId.value) ??
    null,
)
const terminalSessionListStyle = computed(() => ({
  width: `${terminalSessionListWidth.value}px`,
  flexBasis: `${terminalSessionListWidth.value}px`,
}))

let terminalSequence = 0
let unsubscribeShellData: (() => void) | undefined
let unsubscribeShellExit: (() => void) | undefined
let resizeObserver: ResizeObserver | undefined
let sessionListResizePointerTarget: HTMLElement | null = null
let sessionListResizePointerId: number | null = null
const pendingShellData = new Map<string, string[]>()

function getTerminalTheme(): ITheme {
  return { ...terminalThemes[props.themeName] }
}

function applyTerminalThemeToRecords() {
  for (const record of terminalRecords.value) {
    record.terminal.options.theme = getTerminalTheme()
  }
}

function createTerminalRecord(): TerminalRecord {
  terminalSequence += 1
  const terminal = new Terminal({
    convertEol: true,
    cursorBlink: true,
    fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
    fontSize: 13,
    lineHeight: 1.4,
    theme: getTerminalTheme(),
  })
  const fitAddon = new FitAddon()
  const record: TerminalRecord = {
    fitAddon,
    label: `Terminal ${terminalSequence}`,
    localId: `terminal-${terminalSequence}`,
    cwdPath: null,
    exitCode: null,
    opened: false,
    sessionId: null,
    shellStartPromise: null,
    surfaceElement: null,
    terminal,
  }

  terminal.loadAddon(fitAddon)
  terminal.loadAddon(new WebLinksAddon())
  terminal.loadAddon(new SearchAddon())
  terminal.onData((data) => {
    handleData(record, data)
  })

  return record
}

function setTerminalSurface(
  record: TerminalRecord,
  element: Element | ComponentPublicInstance | null,
) {
  if (!(element instanceof HTMLElement)) return
  if (record.surfaceElement === element) return

  record.surfaceElement = element
  if (!record.opened) {
    record.terminal.open(element)
    record.opened = true
    fitTerminalAfterLayout()
  }
}

function findRecordBySessionId(sessionId: string) {
  return terminalRecords.value.find((record) => record.sessionId === sessionId)
}

function getShellDisplayName(shellPath: string) {
  return shellPath.split(/[\\/]/).filter(Boolean).pop() || shellPath
}

function getTerminalRecordTitle(record: TerminalRecord) {
  return record.cwdPath ? `${record.label} - ${record.cwdPath}` : record.label
}

function clampTerminalSessionListWidth(width: number) {
  return Math.max(
    MIN_TERMINAL_SESSION_LIST_WIDTH,
    Math.min(MAX_TERMINAL_SESSION_LIST_WIDTH, Math.round(width)),
  )
}

function fitTerminal() {
  if (!props.expanded) return
  const activeRecord = activeTerminalRecord.value
  if (!activeRecord?.opened) return

  requestAnimationFrame(() => {
    try {
      activeRecord.fitAddon.fit()
      activeRecord.terminal.scrollToBottom()
      resizeShellSession(activeRecord)
    } catch {
      /* xterm may not be measurable while the panel is animating */
    }
  })
}

function fitTerminalAfterLayout() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fitTerminal()
    })
  })
}

function resizeShellSession(record: TerminalRecord) {
  if (!record.sessionId) return
  const desktopApi = getOptionalDesktopApi()
  if (!desktopApi?.shell) return

  void desktopApi.shell.resize(
    record.sessionId,
    record.terminal.cols,
    record.terminal.rows,
  )
}

function writeLine(record: TerminalRecord, value = '') {
  record.terminal.writeln(value)
}

async function stopShellSession(record: TerminalRecord) {
  if (record.shellStartPromise) {
    try {
      await record.shellStartPromise
    } catch {
      /* The start failure will already be printed in the terminal. */
    }
  }

  if (!record.sessionId) return
  const sessionId = record.sessionId
  record.sessionId = null
  const desktopApi = getOptionalDesktopApi()

  try {
    if (desktopApi?.shell) {
      await desktopApi.shell.kill(sessionId)
    }
  } catch {
    /* Session may already have exited. */
  }
}

async function startShellSession(record: TerminalRecord) {
  if (record.sessionId) return
  if (record.shellStartPromise) return record.shellStartPromise

  record.shellStartPromise = createShellSession(record)
  await record.shellStartPromise
}

async function createShellSession(record: TerminalRecord) {
  const desktopApi = getOptionalDesktopApi()

  if (!desktopApi?.shell) {
    writeLine(record, 'ECOS desktop shell bridge is not available.')
    record.shellStartPromise = null
    return
  }

  try {
    record.cwdPath = props.projectPath
    const session = await desktopApi.shell.createSession({
      cols: record.terminal.cols || 80,
      rows: record.terminal.rows || 24,
      cwd: props.projectPath ?? undefined,
    })
    record.sessionId = session.sessionId
    record.label = getShellDisplayName(session.shell)
    record.exitCode = null
    terminalRecords.value = [...terminalRecords.value]
    const pendingData = pendingShellData.get(session.sessionId) ?? []
    pendingShellData.delete(session.sessionId)
    for (const chunk of pendingData) {
      record.terminal.write(chunk, () => {
        record.terminal.scrollToBottom()
      })
    }
  } catch (error) {
    writeLine(record, `[error] ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    record.shellStartPromise = null
  }
}

async function ensureActiveTerminal() {
  if (!activeTerminalRecord.value) {
    await createAndActivateTerminal()
    return
  }

  await nextTick()
  fitTerminalAfterLayout()
  await startShellSession(activeTerminalRecord.value)
  fitTerminalAfterLayout()
  activeTerminalRecord.value.terminal.focus()
}

async function createAndActivateTerminal() {
  closeTerminalMenus()
  const record = createTerminalRecord()
  terminalRecords.value = [...terminalRecords.value, record]
  activeTerminalId.value = record.localId

  await nextTick()
  fitTerminalAfterLayout()
  if (props.expanded) {
    await startShellSession(record)
    fitTerminalAfterLayout()
    record.terminal.focus()
  }
}

async function activateTerminal(localId: string) {
  const record = terminalRecords.value.find(
    (terminalRecord) => terminalRecord.localId === localId,
  )
  if (!record) return

  activeTerminalId.value = record.localId
  await nextTick()
  fitTerminalAfterLayout()
  if (props.expanded) {
    await startShellSession(record)
    record.terminal.focus()
  }
}

async function deleteTerminal(localId: string) {
  closeTerminalMenus()
  const recordIndex = terminalRecords.value.findIndex(
    (record) => record.localId === localId,
  )
  if (recordIndex === -1) return

  const record = terminalRecords.value[recordIndex]
  const wasActive = record.localId === activeTerminalId.value
  const remainingRecords = terminalRecords.value.filter(
    (terminalRecord) => terminalRecord.localId !== localId,
  )

  await stopShellSession(record)
  record.terminal.dispose()
  record.surfaceElement = null
  terminalRecords.value = remainingRecords

  if (!wasActive) {
    fitTerminalAfterLayout()
    return
  }

  const replacementRecord =
    remainingRecords[Math.min(recordIndex, remainingRecords.length - 1)] ?? null

  if (!replacementRecord) {
    activeTerminalId.value = null
    await createAndActivateTerminal()
    return
  }

  activeTerminalId.value = replacementRecord.localId
  await nextTick()
  fitTerminalAfterLayout()
  if (props.expanded) {
    await startShellSession(replacementRecord)
    replacementRecord.terminal.focus()
  }
}

function closeTerminalMenus() {
  showProfilesMenu.value = false
}

function closeTerminalMenusOutside(event: PointerEvent) {
  if (terminalActions.value?.contains(event.target as Node)) return
  closeTerminalMenus()
}

function toggleProfilesMenu() {
  showProfilesMenu.value = !showProfilesMenu.value
}

function handleShellData(event: { data: string; sessionId: string }) {
  const record = findRecordBySessionId(event.sessionId)
  if (!record) {
    pendingShellData.set(event.sessionId, [
      ...(pendingShellData.get(event.sessionId) ?? []),
      event.data,
    ])
    return
  }
  record.terminal.write(event.data, () => {
    record.terminal.scrollToBottom()
  })
}

function handleShellExit(event: { exitCode: number; sessionId: string }) {
  const record = findRecordBySessionId(event.sessionId)
  if (!record) return
  record.sessionId = null
  record.exitCode = event.exitCode
  terminalRecords.value = [...terminalRecords.value]

  writeLine(record)
  writeLine(record, `[shell exited with code ${event.exitCode}]`)
}

function handleData(record: TerminalRecord, data: string) {
  if (!record.sessionId) return
  const desktopApi = getOptionalDesktopApi()
  if (!desktopApi?.shell) return
  void desktopApi.shell.write(record.sessionId, data)
}

function handleSessionListResizePointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()

  sessionListResizePointerTarget = event.currentTarget as HTMLElement
  sessionListResizePointerId = event.pointerId
  sessionListResizePointerTarget.setPointerCapture?.(sessionListResizePointerId)
  document.body.classList.add('terminal-session-list-resizing')
  window.addEventListener('pointermove', handleSessionListResizePointerMove)
  window.addEventListener('pointerup', stopSessionListResize)
  window.addEventListener('pointercancel', stopSessionListResize)
  window.addEventListener('blur', stopSessionListResize)
  handleSessionListResizePointerMove(event)
}

function handleSessionListResizePointerMove(event: PointerEvent) {
  const workspaceRect = terminalWorkspace.value?.getBoundingClientRect()
  if (!workspaceRect) return

  const width = workspaceRect.right - event.clientX
  terminalSessionListWidth.value = clampTerminalSessionListWidth(width)
  fitTerminal()
}

function stopSessionListResize() {
  if (sessionListResizePointerTarget && sessionListResizePointerId !== null) {
    try {
      sessionListResizePointerTarget.releasePointerCapture?.(sessionListResizePointerId)
    } catch {
      /* Pointer capture may already be released by the browser. */
    }
  }
  sessionListResizePointerTarget = null
  sessionListResizePointerId = null
  document.body.classList.remove('terminal-session-list-resizing')
  window.removeEventListener('pointermove', handleSessionListResizePointerMove)
  window.removeEventListener('pointerup', stopSessionListResize)
  window.removeEventListener('pointercancel', stopSessionListResize)
  window.removeEventListener('blur', stopSessionListResize)
  fitTerminalAfterLayout()
}

onMounted(() => {
  document.addEventListener('pointerdown', closeTerminalMenusOutside)

  const desktopApi = getOptionalDesktopApi()
  if (desktopApi?.shell) {
    unsubscribeShellData = desktopApi.shell.onData(handleShellData)
    unsubscribeShellExit = desktopApi.shell.onExit(handleShellExit)
  }

  if (terminalBody.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(fitTerminal)
    resizeObserver.observe(terminalBody.value)
  }

  void createAndActivateTerminal()
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeTerminalMenusOutside)
  unsubscribeShellData?.()
  unsubscribeShellExit?.()
  stopSessionListResize()
  resizeObserver?.disconnect()
  for (const record of terminalRecords.value) {
    void stopShellSession(record)
    record.terminal.dispose()
  }
})

watch(
  () => props.expanded,
  async (expanded) => {
    if (expanded) {
      await ensureActiveTerminal()
      fitTerminalAfterLayout()
    }
  },
)

watch(
  () => props.maximized,
  async () => {
    await nextTick()
    fitTerminalAfterLayout()
  },
)

watch(
  () => props.themeName,
  () => {
    applyTerminalThemeToRecords()
  },
)
</script>

<style scoped>
.ecos-terminal-tab {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
}

.terminal-cwd {
  min-width: 0;
  max-width: 42ch;
  overflow: hidden;
  color: var(--text-secondary);
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-actions {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.terminal-icon-button {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  color: var(--text-primary);
  background: transparent;
  cursor: pointer;
}

.terminal-icon-button:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--text-primary) 10%, transparent);
}

.terminal-icon-button:focus-visible,
.terminal-session-activate:focus-visible,
.terminal-session-delete:focus-visible {
  outline: 1px solid var(--accent-color);
  outline-offset: -1px;
}

.terminal-icon-button i {
  font-size: 16px;
}

.terminal-icon-button--compact {
  width: 18px;
  margin-left: -6px;
}

.terminal-icon-button--compact i {
  font-size: 15px;
}

.terminal-menu {
  position: absolute;
  top: 30px;
  right: 0;
  z-index: 5;
  min-width: 156px;
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
}

.terminal-menu-item {
  width: 100%;
  height: 26px;
  display: flex;
  align-items: center;
  border: none;
  border-radius: 3px;
  padding: 0 10px;
  color: var(--text-primary);
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  text-align: left;
}

.terminal-menu-item:hover,
.terminal-menu-item:focus-visible {
  outline: none;
  background: color-mix(in srgb, var(--accent-color) 18%, var(--bg-secondary));
  color: var(--text-primary);
}

.terminal-body {
  flex: 1;
  min-height: 0;
  padding: 8px 10px 0;
  background: var(--bg-primary);
}

.terminal-workspace {
  height: 100%;
  min-height: 0;
  display: flex;
  overflow: hidden;
  background: var(--bg-primary);
}

.terminal-surfaces {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.terminal-surface {
  height: 100%;
  min-height: 0;
  background: var(--bg-primary);
}

.terminal-session-list {
  width: 150px;
  flex: 0 0 150px;
  padding: 3px 3px 0 0;
  overflow-y: auto;
  border-left: 1px solid var(--border-color);
}

.terminal-session-list,
:deep(.xterm-viewport) {
  scrollbar-width: thin;
  scrollbar-color: rgba(121, 121, 121, 0.4) transparent;
}

.terminal-session-list::-webkit-scrollbar,
:deep(.xterm-viewport::-webkit-scrollbar) {
  width: 10px;
  height: 10px;
}

.terminal-session-list::-webkit-scrollbar-track,
:deep(.xterm-viewport::-webkit-scrollbar-track) {
  background: transparent;
}

.terminal-session-list::-webkit-scrollbar-thumb,
:deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  min-height: 20px;
  background-clip: padding-box;
  background-color: rgba(121, 121, 121, 0.4);
  border: 3px solid transparent;
}

.terminal-session-list::-webkit-scrollbar-thumb:hover,
:deep(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
  background-color: rgba(100, 100, 100, 0.7);
}

.terminal-session-list::-webkit-scrollbar-thumb:active,
:deep(.xterm-viewport::-webkit-scrollbar-thumb:active) {
  background-color: rgba(191, 191, 191, 0.4);
}

.terminal-session-list::-webkit-scrollbar-corner,
:deep(.xterm-viewport::-webkit-scrollbar-corner) {
  background: transparent;
}

.terminal-session-resize-handle {
  width: 10px;
  align-self: stretch;
  flex: 0 0 10px;
  cursor: col-resize;
  position: relative;
}

.terminal-session-resize-handle::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 4px;
  width: 1px;
  background: var(--border-color);
}

.terminal-session-resize-handle:hover::before,
:global(body.terminal-session-list-resizing) .terminal-session-resize-handle::before {
  left: 3px;
  width: 2px;
  background: var(--accent-color);
}

.terminal-session-item {
  position: relative;
  min-width: 0;
  height: 26px;
  display: flex;
  align-items: center;
  background: transparent;
  color: var(--text-primary);
}

.terminal-session-item::before {
  content: '';
  width: 2px;
  align-self: stretch;
  flex: 0 0 2px;
  background: transparent;
}

.terminal-session-item--active {
  background: color-mix(in srgb, var(--accent-color) 12%, var(--bg-secondary));
}

.terminal-session-item--active::before {
  background: var(--accent-color);
}

.terminal-session-activate,
.terminal-session-delete {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.terminal-session-activate {
  min-width: 0;
  height: 100%;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 6px 0 8px;
  overflow: hidden;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 12px;
  line-height: 26px;
  text-align: left;
}

.terminal-session-activate span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-session-activate i {
  flex: 0 0 auto;
  font-size: 15px;
}

.terminal-session-warning {
  margin-left: auto;
  color: var(--warn-color);
}

.terminal-session-delete {
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 2px;
  border-radius: 3px;
  color: var(--text-primary);
  opacity: 0;
  pointer-events: none;
}

.terminal-session-item:hover,
.terminal-session-item:focus-within {
  background: color-mix(in srgb, var(--text-primary) 8%, var(--bg-secondary));
}

.terminal-session-item:hover .terminal-session-delete,
.terminal-session-item:focus-within .terminal-session-delete {
  opacity: 1;
  pointer-events: auto;
}

.terminal-session-delete:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--text-primary) 12%, var(--bg-secondary));
}

:deep(.xterm) {
  height: 100%;
}

:deep(.xterm-viewport),
:deep(.xterm-screen) {
  background: var(--bg-primary);
}

:global(body.terminal-session-list-resizing),
:global(body.terminal-session-list-resizing *) {
  cursor: col-resize !important;
  user-select: none !important;
  -webkit-user-select: none !important;
}
</style>
