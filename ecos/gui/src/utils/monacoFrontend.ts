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

  monaco.editor.defineTheme('ecos-source-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '8ab4ff', fontStyle: 'bold' },
      { token: 'number', foreground: 'f2cc60' },
      { token: 'string', foreground: '8fd694' },
      { token: 'comment', foreground: '7f8a99', fontStyle: 'italic' },
      { token: 'type', foreground: '7dd3fc' },
      { token: 'identifier', foreground: 'e5e7eb' },
    ],
    colors: {
      'editor.background': '#0f1117',
      'editor.foreground': '#e5e7eb',
      'editorLineNumber.foreground': '#64748b',
      'editorLineNumber.activeForeground': '#cbd5e1',
      'editorCursor.foreground': '#38bdf8',
      'editor.lineHighlightBackground': '#172033',
      'editor.selectionBackground': '#2563eb66',
      'editor.inactiveSelectionBackground': '#33415566',
      'editorGutter.background': '#0f1117',
    },
  })

  monaco.editor.defineTheme('ecos-source-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '1d4ed8', fontStyle: 'bold' },
      { token: 'number', foreground: 'a16207' },
      { token: 'string', foreground: '047857' },
      { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
      { token: 'type', foreground: '0369a1' },
      { token: 'identifier', foreground: '111827' },
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
      'editorGutter.background': '#fbfcff',
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

export { monaco }
