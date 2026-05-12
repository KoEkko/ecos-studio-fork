import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution'
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution'
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution'
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution'
import 'monaco-editor/esm/vs/basic-languages/systemverilog/systemverilog.contribution'
import 'monaco-editor/esm/vs/basic-languages/tcl/tcl.contribution'
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution'
import 'monaco-editor/min/vs/editor/editor.main.css'

let configured = false

export type FrontendEditorTheme = 'dark' | 'light'

export function configureFrontendMonaco(): typeof monaco {
  if (configured) return monaco

  ;(globalThis as unknown as { MonacoEnvironment?: { getWorker: () => Worker } }).MonacoEnvironment = {
    getWorker() {
      return new EditorWorker()
    },
  }

  registerFilelistLanguage()

  monaco.editor.defineTheme('ecos-source-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'e6edf3', background: '0b1020' },
      { token: 'identifier', foreground: 'e6edf3' },
      { token: 'variable', foreground: 'f9fafb' },
      { token: 'variable.predefined', foreground: '7dd3fc', fontStyle: 'bold' },
      { token: 'keyword', foreground: '8ab4ff', fontStyle: 'bold' },
      { token: 'keyword.directive', foreground: 'c084fc', fontStyle: 'bold' },
      { token: 'number', foreground: 'f2cc60' },
      { token: 'string', foreground: '8fd694' },
      { token: 'string.include', foreground: 'a7f3d0' },
      { token: 'comment', foreground: '8b949e', fontStyle: 'italic' },
      { token: 'type', foreground: '7dd3fc' },
      { token: 'annotation', foreground: 'f0abfc' },
      { token: 'operator', foreground: '93c5fd' },
      { token: 'delimiter', foreground: 'cbd5e1' },
      { token: 'filelist.directive', foreground: '8ab4ff', fontStyle: 'bold' },
      { token: 'filelist.path', foreground: '8fd694' },
      { token: 'filelist.variable', foreground: 'f2cc60' },
    ],
    colors: {
      'editor.background': '#0b1020',
      'editor.foreground': '#e6edf3',
      'editorLineNumber.foreground': '#718096',
      'editorLineNumber.activeForeground': '#e2e8f0',
      'editorCursor.foreground': '#38bdf8',
      'editor.lineHighlightBackground': '#16213a',
      'editor.selectionBackground': '#2563eb88',
      'editor.inactiveSelectionBackground': '#33415566',
      'editor.selectionHighlightBackground': '#1d4ed84d',
      'editor.wordHighlightBackground': '#33415570',
      'editor.wordHighlightStrongBackground': '#47556980',
      'editor.findMatchBackground': '#f59e0b55',
      'editor.findMatchHighlightBackground': '#fbbf2440',
      'editorBracketMatch.background': '#22d3ee22',
      'editorBracketMatch.border': '#22d3ee',
      'editorGutter.background': '#0b1020',
      'editorIndentGuide.background1': '#25324a',
      'editorIndentGuide.activeBackground1': '#64748b',
      'editorWhitespace.foreground': '#334155',
      'editorWidget.background': '#111827',
      'editorWidget.border': '#334155',
      'input.background': '#111827',
      'input.foreground': '#e6edf3',
    },
  })

  monaco.editor.defineTheme('ecos-source-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: '111827', background: 'fbfcff' },
      { token: 'keyword', foreground: '1d4ed8', fontStyle: 'bold' },
      { token: 'keyword.directive', foreground: '9333ea', fontStyle: 'bold' },
      { token: 'number', foreground: 'a16207' },
      { token: 'string', foreground: '047857' },
      { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
      { token: 'type', foreground: '0369a1' },
      { token: 'identifier', foreground: '111827' },
      { token: 'variable.predefined', foreground: '0891b2', fontStyle: 'bold' },
      { token: 'annotation', foreground: 'be185d' },
      { token: 'operator', foreground: '2563eb' },
      { token: 'delimiter', foreground: '475569' },
      { token: 'filelist.directive', foreground: '1d4ed8', fontStyle: 'bold' },
      { token: 'filelist.path', foreground: '047857' },
      { token: 'filelist.variable', foreground: 'a16207' },
    ],
    colors: {
      'editor.background': '#fbfcff',
      'editor.foreground': '#111827',
      'editorLineNumber.foreground': '#94a3b8',
      'editorLineNumber.activeForeground': '#334155',
      'editorCursor.foreground': '#2563eb',
      'editor.lineHighlightBackground': '#e8f0ff',
      'editor.selectionBackground': '#bfdbfe',
      'editor.inactiveSelectionBackground': '#dbeafe',
      'editor.selectionHighlightBackground': '#bfdbfe80',
      'editor.wordHighlightBackground': '#e0e7ff',
      'editor.wordHighlightStrongBackground': '#c7d2fe',
      'editor.findMatchBackground': '#fbbf2480',
      'editor.findMatchHighlightBackground': '#fde68a80',
      'editorBracketMatch.background': '#67e8f933',
      'editorBracketMatch.border': '#0891b2',
      'editorGutter.background': '#fbfcff',
      'editorIndentGuide.background1': '#dbe3ef',
      'editorIndentGuide.activeBackground1': '#94a3b8',
      'editorWhitespace.foreground': '#cbd5e1',
    },
  })

  configured = true
  return monaco
}

export function monacoThemeName(theme: FrontendEditorTheme): string {
  return theme === 'dark' ? 'ecos-source-dark' : 'ecos-source-light'
}

export function monacoLanguageForPath(path: string): string {
  const name = fileName(path).toLowerCase()
  const ext = name.split('.').pop() || ''
  if (ext === 'sv' || ext === 'svh') return 'systemverilog'
  if (ext === 'v' || ext === 'vh') return 'verilog'
  if (ext === 'f' || ext === 'fl' || ext === 'filelist') return 'sv-filelist'
  if (['c', 'cc', 'cpp', 'h', 'hpp'].includes(ext)) return 'cpp'
  if (ext === 'py') return 'python'
  if (ext === 'sh') return 'shell'
  if (ext === 'tcl') return 'tcl'
  if (ext === 'md') return 'markdown'
  if (ext === 'yaml' || ext === 'yml') return 'yaml'
  return 'plaintext'
}

function fileName(path: string): string {
  return path.split('/').filter(Boolean).pop() || path
}

function registerFilelistLanguage(): void {
  const languageId = 'sv-filelist'
  if (!monaco.languages.getLanguages().some((language) => language.id === languageId)) {
    monaco.languages.register({
      id: languageId,
      extensions: ['.f', '.fl', '.filelist'],
      aliases: ['SV Filelist', 'filelist'],
    })
  }

  monaco.languages.setMonarchTokensProvider(languageId, {
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/\/\/.*$/, 'comment'],
        [/\$\([A-Za-z_][\w-]*\)|\$\{[A-Za-z_][\w-]*\}|\$[A-Za-z_][\w-]*/, 'filelist.variable'],
        [/\+(incdir|define)\+/, 'filelist.directive'],
        [/-[fFyIv]\b/, 'filelist.directive'],
        [/\+[A-Za-z_][\w-]*(?=\+|\s|$)/, 'filelist.directive'],
        [/"[^"]*"/, 'string'],
        [/'[^']*'/, 'string'],
        [/[^\s#"]+\.(svh?|vh?|v|h|hpp|c|cc|cpp|f|fl)\b/, 'filelist.path'],
        [/[^\s#"]+/, 'identifier'],
      ],
    },
  })
}

export { monaco }
