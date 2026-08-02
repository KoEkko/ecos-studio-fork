import { describe, expect, it } from 'vitest'
import appSource from '../App.vue?raw'
import terminalSource from './ECOSTerminal.vue?raw'

describe('ECOSTerminal', () => {
  it('uses xterm with fit, web links, and search addons', () => {
    expect(terminalSource).toContain("from '@xterm/xterm'")
    expect(terminalSource).toContain("from '@xterm/addon-fit'")
    expect(terminalSource).toContain("from '@xterm/addon-web-links'")
    expect(terminalSource).toContain("from '@xterm/addon-search'")
  })

  it('starts as a node-pty shell terminal', () => {
    expect(terminalSource).toContain('startShellSession')
    expect(terminalSource).toContain('desktopApi.shell.createSession')
    expect(terminalSource).toContain('desktopApi.shell.write')
    expect(terminalSource).toContain('desktopApi.shell.resize')
    expect(terminalSource).toContain('desktopApi.shell.kill')
    expect(terminalSource).toContain('desktopApi.shell.onData')
    expect(terminalSource).toContain('desktopApi.shell.onExit')
    expect(terminalSource).not.toContain('desktopApi.cli.execute')
  })

  it('does not expose a terminal mode toggle', () => {
    expect(terminalSource).not.toContain('terminalMode')
    expect(terminalSource).not.toContain('terminal-mode-toggle')
    expect(terminalSource).not.toContain('switchTerminalMode')
  })

  it('starts the shell when the terminal is first expanded', () => {
    expect(terminalSource).toMatch(
      /watch\(\s*\(\) => props\.expanded,[\s\S]*if \(expanded\) \{[\s\S]*await ensureActiveTerminal\(\)/,
    )
  })

  it('receives the current workspace path and theme from App.vue', () => {
    expect(appSource).toContain(':project-path="currentProject?.path ?? null"')
    expect(appSource).toContain(':theme-name="themeStore.themeName"')
    expect(terminalSource).toMatch(/projectPath:\s*string \| null/)
    expect(terminalSource).toMatch(/themeName:\s*'light' \| 'dark'/)
  })

  it('passes the current workspace path when creating new shell sessions', () => {
    expect(terminalSource).toMatch(
      /desktopApi\.shell\.createSession\(\{[\s\S]*cols:\s*record\.terminal\.cols \|\| 80,[\s\S]*rows:\s*record\.terminal\.rows \|\| 24,[\s\S]*cwd:\s*props\.projectPath \?\? undefined,[\s\S]*\}\)/,
    )
    expect(terminalSource).not.toContain("write(record.sessionId, 'cd ")
    expect(terminalSource).not.toContain('write(record.sessionId, "cd ')
  })

  it('renders as a tab inside the shared bottom panel rather than owning the chrome', () => {
    expect(appSource).toMatch(
      /<BottomPanel>\s*<ECOSTerminal[\s\S]*?\/>\s*<FlowLogPanel[^>]*\/>[\s\S]*?<\/BottomPanel>/,
    )
    expect(appSource).toContain(
      ':expanded="isBottomPanelOpen && bottomPanelTab === \'terminal\'"',
    )
    expect(terminalSource).toMatch(/\.ecos-terminal-tab\s*\{[\s\S]*flex:\s*1;/)
    expect(terminalSource).not.toContain('.ecos-terminal-panel')
    expect(terminalSource).not.toContain('class="terminal-resize-handle"')
    expect(terminalSource).not.toContain('class="terminal-header"')
    expect(terminalSource).not.toContain('heightChange: [height: string]')
    expect(terminalSource).not.toContain('toggleMaximize: []')
    expect(terminalSource).not.toContain("emit('collapse')")
  })

  it('teleports its toolbar into the shared panel header only while it is showing', () => {
    expect(terminalSource).toMatch(
      /<Teleport v-if="expanded" defer to="#bottom-panel-actions">/,
    )
    expect(terminalSource).toMatch(
      /<Teleport[\s\S]*ref="terminalActions" class="terminal-actions"[\s\S]*<\/Teleport>/,
    )
  })

  it('keeps the prompt clear of the bottom status bar', () => {
    expect(terminalSource).toMatch(/<div\s+ref="terminalBody"\s+class="terminal-body">/)
    expect(terminalSource).toMatch(/\.terminal-body\s*\{[\s\S]*padding:\s*8px 10px 0;/)
    expect(terminalSource).toMatch(/\.terminal-surface\s*\{[\s\S]*height:\s*100%;/)
    expect(
      terminalSource.match(/\.terminal-surface\s*\{[^}]*\}/)?.[0] ?? '',
    ).not.toContain('padding:')
  })

  it('uses theme tokens for terminal chrome and xterm surfaces', () => {
    expect(terminalSource).not.toContain("const terminalBackground = '#1e1e1e'")
    expect(terminalSource).toMatch(
      /\.ecos-terminal-tab\s*\{[\s\S]*background:\s*var\(--bg-primary\);/,
    )
    expect(terminalSource).toMatch(
      /\.terminal-body\s*\{[\s\S]*background:\s*var\(--bg-primary\);/,
    )
    expect(terminalSource).toMatch(
      /\.terminal-surface\s*\{[\s\S]*background:\s*var\(--bg-primary\);/,
    )
    expect(terminalSource).toMatch(
      /:deep\(\.xterm-viewport\),\s*:deep\(\.xterm-screen\)\s*\{[\s\S]*background:\s*var\(--bg-primary\);/,
    )
  })

  it('uses VS Code-style terminal scrollbars instead of the app-wide light scrollbar', () => {
    expect(terminalSource).toMatch(
      /\.terminal-session-list,\s*:deep\(\.xterm-viewport\)\s*\{[\s\S]*scrollbar-color:\s*rgba\(121,\s*121,\s*121,\s*0\.4\)\s*transparent;/,
    )
    expect(terminalSource).toMatch(
      /\.terminal-session-list::-webkit-scrollbar,\s*:deep\(\.xterm-viewport::-webkit-scrollbar\)\s*\{[\s\S]*width:\s*10px;/,
    )
    expect(terminalSource).toMatch(
      /\.terminal-session-list::-webkit-scrollbar-track,\s*:deep\(\.xterm-viewport::-webkit-scrollbar-track\)\s*\{[\s\S]*background:\s*transparent;/,
    )
    expect(terminalSource).toMatch(
      /\.terminal-session-list::-webkit-scrollbar-thumb,\s*:deep\(\.xterm-viewport::-webkit-scrollbar-thumb\)\s*\{[\s\S]*background-color:\s*rgba\(121,\s*121,\s*121,\s*0\.4\);[\s\S]*border:\s*3px solid transparent;/,
    )
    expect(terminalSource).toMatch(
      /\.terminal-session-list::-webkit-scrollbar-thumb:hover,\s*:deep\(\.xterm-viewport::-webkit-scrollbar-thumb:hover\)\s*\{[\s\S]*background-color:\s*rgba\(100,\s*100,\s*100,\s*0\.7\);/,
    )
  })

  it('uses a readable terminal font size and high-contrast prompt colors', () => {
    expect(terminalSource).toContain('fontSize: 13')
    expect(terminalSource).toContain("foreground: '#e3e3e8'")
    expect(terminalSource).toContain("foreground: '#111827'")
    expect(terminalSource).toContain("green: '#23d18b'")
    expect(terminalSource).toContain("brightGreen: '#23d18b'")
    expect(terminalSource).not.toContain("green: '#6a9955'")
    expect(terminalSource).toContain("white: '#374151'")
    expect(terminalSource).toContain("brightWhite: '#111827'")
  })

  it('uses VS Code terminal colors for prompts, paths, and command output', () => {
    expect(terminalSource).toContain(
      "const terminalThemes: Record<'light' | 'dark', ITheme>",
    )
    expect(terminalSource).toMatch(
      /dark:\s*\{[\s\S]*background:\s*'#18181c'[\s\S]*foreground:\s*'#e3e3e8'/,
    )
    expect(terminalSource).toMatch(
      /light:\s*\{[\s\S]*background:\s*'#ffffff'[\s\S]*foreground:\s*'#111827'/,
    )
    expect(terminalSource).toContain("blue: '#3b8eea'")
    expect(terminalSource).toContain("brightBlue: '#6cb6ff'")
    expect(terminalSource).toContain("green: '#23d18b'")
    expect(terminalSource).toContain("brightGreen: '#23d18b'")
    expect(terminalSource).toContain("red: '#f14c4c'")
    expect(terminalSource).toContain("magenta: '#bc3fbc'")
    expect(terminalSource).toContain("brightMagenta: '#d670d6'")
    expect(terminalSource).not.toContain("blue: '#569cd6'")
  })

  it('updates existing xterm palettes when the app theme changes', () => {
    expect(terminalSource).toContain('function getTerminalTheme()')
    expect(terminalSource).toContain('theme: getTerminalTheme()')
    expect(terminalSource).toMatch(
      /function applyTerminalThemeToRecords\(\)[\s\S]*for \(const record of terminalRecords\.value\)[\s\S]*record\.terminal\.options\.theme = getTerminalTheme\(\)/,
    )
    expect(terminalSource).toMatch(
      /watch\(\s*\(\) => props\.themeName,[\s\S]*applyTerminalThemeToRecords\(\)[\s\S]*\)/,
    )
  })

  it('preserves existing terminal sessions when the project path changes', () => {
    expect(terminalSource).not.toMatch(/watch\(\s*\(\) => props\.projectPath/)
    expect(terminalSource).toMatch(
      /desktopApi\.shell\.createSession\(\{[\s\S]*cwd:\s*props\.projectPath \?\? undefined,[\s\S]*\}\)/,
    )
  })

  it('surfaces the cwd captured when each shell session starts', () => {
    expect(terminalSource).toContain('cwdPath: string | null')
    expect(terminalSource).toContain('record.cwdPath = props.projectPath')
    expect(terminalSource).toContain('class="terminal-cwd"')
    expect(terminalSource).toContain(':title="activeTerminalRecord.cwdPath"')
    expect(terminalSource).toContain(':title="getTerminalRecordTitle(record)"')
  })

  it('refits after the overlay layout settles and keeps the viewport at the bottom', () => {
    expect(terminalSource).toContain('function fitTerminalAfterLayout()')
    expect(terminalSource).toMatch(
      /function fitTerminal\(\)[\s\S]*activeRecord\.fitAddon\.fit\(\)[\s\S]*activeRecord\.terminal\.scrollToBottom\(\)[\s\S]*resizeShellSession\(activeRecord\)/,
    )
    expect(terminalSource).toMatch(
      /new ResizeObserver\(fitTerminal\)[\s\S]*resizeObserver\.observe\(terminalBody\.value\)/,
    )
    expect(terminalSource).toMatch(
      /if \(expanded\) \{[\s\S]*await ensureActiveTerminal\(\)[\s\S]*fitTerminalAfterLayout\(\)/,
    )
  })

  it('forwards all terminal input directly to the active shell session', () => {
    expect(terminalSource).toMatch(
      /function handleData\(record: TerminalRecord, data: string\) \{[\s\S]*void desktopApi\.shell\.write\(record\.sessionId, data\)[\s\S]*\}/,
    )
  })

  it('keeps only terminal-scoped actions and leaves panel chrome to BottomPanel', () => {
    expect(terminalSource).toContain('title="New Terminal"')
    expect(terminalSource).toContain('@click="createAndActivateTerminal"')
    expect(terminalSource).toContain('title="Terminal Profiles"')
    expect(terminalSource).toContain('ri-add-line')
    expect(terminalSource).toContain('ri-arrow-down-s-line')
    expect(terminalSource).not.toContain("'Maximize Panel'")
    expect(terminalSource).not.toContain("'Restore Panel'")
    expect(terminalSource).not.toContain('title="Close Panel"')
    expect(terminalSource).not.toContain('ri-more-line')
    expect(terminalSource).not.toContain('ri-fullscreen-line')
  })

  it('keeps prior VS Code terminal sessions alive when creating another terminal', () => {
    const createAndActivateTerminalBody =
      terminalSource.match(
        /async function createAndActivateTerminal\(\) \{([\s\S]*?)\nasync function activateTerminal/,
      )?.[1] ?? ''

    expect(terminalSource).toContain('interface TerminalRecord')
    expect(terminalSource).toContain(
      'const terminalRecords = shallowRef<TerminalRecord[]>([])',
    )
    expect(terminalSource).toMatch(
      /function createAndActivateTerminal\(\)[\s\S]*createTerminalRecord\(\)[\s\S]*terminalRecords\.value = \[\.\.\.terminalRecords\.value, record\][\s\S]*activeTerminalId\.value = record\.localId[\s\S]*startShellSession\(record\)/,
    )
    expect(createAndActivateTerminalBody).not.toContain('stopShellSession(record)')
  })

  it('shows terminal sessions in a right-side list and lets each session be deleted', () => {
    expect(terminalSource).toMatch(
      /<div\s+ref="terminalBody"\s+class="terminal-body">[\s\S]*class="terminal-workspace"[\s\S]*class="terminal-session-list"/,
    )
    expect(terminalSource).toContain('aria-label="Terminal session list"')
    expect(terminalSource).toContain('class="terminal-session-item"')
    expect(terminalSource).toContain('terminal-session-item--active')
    expect(terminalSource).toContain('title="Close Terminal"')
    expect(terminalSource).toContain('aria-label="Close Terminal"')
    expect(terminalSource).toContain('@click.stop="deleteTerminal(record.localId)"')
    expect(terminalSource).toContain('ri-delete-bin-line')
    expect(terminalSource).not.toContain(
      'terminal-session-item--active .terminal-session-delete',
    )
    expect(terminalSource).toMatch(
      /\.terminal-session-item--active::before\s*\{[\s\S]*background:\s*var\(--accent-color\);/,
    )
    expect(terminalSource).toMatch(
      /\.terminal-session-delete\s*\{[^}]*opacity:\s*0;[\s\S]*pointer-events:\s*none;/,
    )
    expect(terminalSource).toMatch(
      /\.terminal-session-item:hover \.terminal-session-delete,\s*\.terminal-session-item:focus-within \.terminal-session-delete\s*\{[^}]*opacity:\s*1;[\s\S]*pointer-events:\s*auto;/,
    )
    expect(terminalSource).toMatch(
      /async function deleteTerminal\(localId: string\)[\s\S]*await stopShellSession\(record\)[\s\S]*record\.terminal\.dispose\(\)[\s\S]*terminalRecords\.value = remainingRecords/,
    )
  })

  it('lets the right-side terminal session list be resized horizontally', () => {
    expect(terminalSource).toContain('const DEFAULT_TERMINAL_SESSION_LIST_WIDTH = 150')
    expect(terminalSource).toContain('const MIN_TERMINAL_SESSION_LIST_WIDTH = 104')
    expect(terminalSource).toContain('const MAX_TERMINAL_SESSION_LIST_WIDTH = 280')
    expect(terminalSource).toContain('ref="terminalWorkspace"')
    expect(terminalSource).toContain('class="terminal-session-resize-handle"')
    expect(terminalSource).toContain('@pointerdown="handleSessionListResizePointerDown"')
    expect(terminalSource).toContain(':style="terminalSessionListStyle"')
    expect(terminalSource).toMatch(
      /const terminalSessionListStyle = computed\(\(\) => \(\{[\s\S]*width: `\$\{terminalSessionListWidth\.value\}px`,[\s\S]*flexBasis: `\$\{terminalSessionListWidth\.value\}px`,/,
    )
    expect(terminalSource).toMatch(
      /function handleSessionListResizePointerMove\(event: PointerEvent\)[\s\S]*workspaceRect\.right - event\.clientX[\s\S]*terminalSessionListWidth\.value = clampTerminalSessionListWidth\(width\)[\s\S]*fitTerminal\(\)/,
    )
    expect(terminalSource).toContain(
      "document.body.classList.add('terminal-session-list-resizing')",
    )
    expect(terminalSource).toContain(
      "document.body.classList.remove('terminal-session-list-resizing')",
    )
    expect(terminalSource).toMatch(
      /\.terminal-session-resize-handle\s*\{[\s\S]*cursor:\s*col-resize;/,
    )
  })

  it('does not render command status decorations before terminal prompts', () => {
    expect(terminalSource).not.toContain('allowProposedApi: true')
    expect(terminalSource).not.toContain('TerminalCommandDecoration')
    expect(terminalSource).not.toContain('commandDecorations')
    expect(terminalSource).not.toContain('handleCommandDecorationInput')
    expect(terminalSource).not.toContain('registerMarker')
    expect(terminalSource).not.toContain('registerDecoration')
    expect(terminalSource).not.toContain('registerOscHandler')
    expect(terminalSource).not.toContain('terminal-command-decoration')
    expect(
      terminalSource.match(/\.terminal-surface\s*\{[^}]*\}/)?.[0] ?? '',
    ).not.toContain('padding-left:')
  })
})
