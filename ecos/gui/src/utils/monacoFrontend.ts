import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution'
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution'
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution'
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution'
import 'monaco-editor/esm/vs/basic-languages/tcl/tcl.contribution'
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution'
import 'monaco-editor/min/vs/editor/editor.main.css'

let configured = false
const VERILOG_LANGUAGE_ID = 'ecos-verilog'
const SYSTEMVERILOG_LANGUAGE_ID = 'ecos-systemverilog'
const FILELIST_LANGUAGE_ID = 'ecos-sv-filelist'

const RTL_LANGUAGE_CONFIG: monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/'],
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
    ['begin', 'end'],
    ['case', 'endcase'],
    ['module', 'endmodule'],
    ['function', 'endfunction'],
    ['task', 'endtask'],
  ],
  autoClosingPairs: [
    { open: '[', close: ']' },
    { open: '{', close: '}' },
    { open: '(', close: ')' },
    { open: '"', close: '"', notIn: ['string', 'comment'] },
    { open: "'", close: "'", notIn: ['string', 'comment'] },
  ],
  surroundingPairs: [
    { open: '[', close: ']' },
    { open: '{', close: '}' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  folding: {
    markers: {
      start: /^\s*(module|interface|package|program|class|function|task|begin|case|generate)\b/,
      end: /^\s*(endmodule|endinterface|endpackage|endprogram|endclass|endfunction|endtask|end|endcase|endgenerate)\b/,
    },
  },
}

const RTL_KEYWORDS = [
  'always',
  'always_comb',
  'always_ff',
  'always_latch',
  'assign',
  'automatic',
  'begin',
  'case',
  'casex',
  'casez',
  'class',
  'clocking',
  'default',
  'defparam',
  'disable',
  'do',
  'edge',
  'else',
  'end',
  'endcase',
  'endclass',
  'endclocking',
  'endfunction',
  'endgenerate',
  'endmodule',
  'endpackage',
  'endtask',
  'for',
  'force',
  'forever',
  'fork',
  'function',
  'generate',
  'genvar',
  'if',
  'ifdef',
  'ifndef',
  'initial',
  'interface',
  'localparam',
  'module',
  'negedge',
  'package',
  'parameter',
  'posedge',
  'release',
  'repeat',
  'return',
  'task',
  'typedef',
  'unique',
  'wait',
  'while',
]

const RTL_TYPE_KEYWORDS = [
  'bit',
  'byte',
  'chandle',
  'enum',
  'event',
  'inout',
  'input',
  'int',
  'integer',
  'logic',
  'longint',
  'output',
  'real',
  'realtime',
  'reg',
  'shortint',
  'shortreal',
  'signed',
  'string',
  'struct',
  'time',
  'tri',
  'tri0',
  'tri1',
  'typedef',
  'union',
  'unsigned',
  'uwire',
  'var',
  'wire',
]

export type FrontendEditorTheme = 'dark' | 'light'

export function configureFrontendMonaco(): typeof monaco {
  if (configured) return monaco

  ;(globalThis as unknown as { MonacoEnvironment?: { getWorker: () => Worker } }).MonacoEnvironment = {
    getWorker() {
      return new EditorWorker()
    },
  }

  registerRtlLanguages()
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
      { token: 'keyword.$0', foreground: '8ab4ff', fontStyle: 'bold' },
      { token: 'keyword.$2', foreground: '8ab4ff', fontStyle: 'bold' },
      { token: 'keyword.directive', foreground: 'c084fc', fontStyle: 'bold' },
      { token: 'keyword.directive.include', foreground: 'c084fc', fontStyle: 'bold' },
      { token: 'number', foreground: 'f2cc60' },
      { token: 'number.binary', foreground: 'f2cc60' },
      { token: 'number.hex', foreground: 'f2cc60' },
      { token: 'string', foreground: '8fd694' },
      { token: 'string.include', foreground: 'a7f3d0' },
      { token: 'string.include.identifier', foreground: 'a7f3d0' },
      { token: 'comment', foreground: '8b949e', fontStyle: 'italic' },
      { token: 'type', foreground: '7dd3fc' },
      { token: 'annotation', foreground: 'f0abfc' },
      { token: 'operator', foreground: '93c5fd' },
      { token: 'delimiter', foreground: 'cbd5e1' },
      { token: 'delimiter.curly', foreground: 'f0abfc' },
      { token: 'delimiter.parenthesis', foreground: '93c5fd' },
      { token: 'delimiter.square', foreground: 'f2cc60' },
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
      { token: 'keyword.$0', foreground: '1d4ed8', fontStyle: 'bold' },
      { token: 'keyword.$2', foreground: '1d4ed8', fontStyle: 'bold' },
      { token: 'keyword.directive', foreground: '9333ea', fontStyle: 'bold' },
      { token: 'keyword.directive.include', foreground: '9333ea', fontStyle: 'bold' },
      { token: 'number', foreground: 'a16207' },
      { token: 'number.binary', foreground: 'a16207' },
      { token: 'number.hex', foreground: 'a16207' },
      { token: 'string', foreground: '047857' },
      { token: 'string.include.identifier', foreground: '047857' },
      { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
      { token: 'type', foreground: '0369a1' },
      { token: 'identifier', foreground: '111827' },
      { token: 'variable.predefined', foreground: '0891b2', fontStyle: 'bold' },
      { token: 'annotation', foreground: 'be185d' },
      { token: 'operator', foreground: '2563eb' },
      { token: 'delimiter', foreground: '475569' },
      { token: 'delimiter.curly', foreground: 'be185d' },
      { token: 'delimiter.parenthesis', foreground: '2563eb' },
      { token: 'delimiter.square', foreground: 'a16207' },
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
  if (ext === 'sv' || ext === 'svh') return SYSTEMVERILOG_LANGUAGE_ID
  if (ext === 'v' || ext === 'vh') return VERILOG_LANGUAGE_ID
  if (ext === 'f' || ext === 'fl' || ext === 'filelist') return FILELIST_LANGUAGE_ID
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

function registerRtlLanguages(): void {
  registerMonarchLanguage(
    SYSTEMVERILOG_LANGUAGE_ID,
    ['.sv', '.svh'],
    ['ECOS SystemVerilog', 'systemverilog'],
    createRtlLanguage('.sv'),
  )
  registerMonarchLanguage(
    VERILOG_LANGUAGE_ID,
    ['.v', '.vh'],
    ['ECOS Verilog', 'verilog'],
    createRtlLanguage('.v'),
  )
}

function registerMonarchLanguage(
  id: string,
  extensions: string[],
  aliases: string[],
  language: monaco.languages.IMonarchLanguage,
): void {
  if (!monaco.languages.getLanguages().some((registered) => registered.id === id)) {
    monaco.languages.register({ id, extensions, aliases })
  }
  monaco.languages.setLanguageConfiguration(id, RTL_LANGUAGE_CONFIG)
  monaco.languages.setMonarchTokensProvider(id, language)
}

function createRtlLanguage(tokenPostfix: string): monaco.languages.IMonarchLanguage {
  return {
    defaultToken: 'identifier',
    tokenPostfix,
    keywords: RTL_KEYWORDS,
    typeKeywords: RTL_TYPE_KEYWORDS,
    operators: [
      '=',
      '+',
      '-',
      '*',
      '/',
      '%',
      '==',
      '!=',
      '===',
      '!==',
      '<',
      '<=',
      '>',
      '>=',
      '&&',
      '||',
      '&',
      '|',
      '^',
      '~',
      '!',
      '<<',
      '>>',
      '<<<',
      '>>>',
      '->',
      '<->',
      '?:',
    ],
    symbols: /[=><!~?:&|+\-*\/\^%#]+/,
    escapes: /\\(?:[nrtvf\\"']|x[0-9A-Fa-f]{1,2}|[0-7]{1,3})/,
    tokenizer: {
      root: [
        [/`(?:include|define|ifdef|ifndef|elsif|else|endif|timescale|default_nettype|undef|resetall)\b/, 'keyword.directive'],
        [/\(\*.*?\*\)/, 'annotation'],
        [/\$[A-Za-z_]\w*/, 'variable.predefined'],
        [
          /[A-Za-z_][\w$]*/,
          {
            cases: {
              '@typeKeywords': 'type',
              '@keywords': 'keyword',
              '@default': 'identifier',
            },
          },
        ],
        { include: '@whitespace' },
        { include: '@numbers' },
        { include: '@strings' },
        [/[{}()\[\]]/, '@brackets'],
        [/[;,.]/, 'delimiter'],
        [
          /@symbols/,
          {
            cases: {
              '@operators': 'operator',
              '@default': 'delimiter',
            },
          },
        ],
      ],
      whitespace: [
        [/[ \t\r\n]+/, ''],
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],
      ],
      comment: [
        [/[^\/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment'],
      ],
      numbers: [
        [/\d+'[sS]?[bB][0-1xXzZ?_]+/, 'number.binary'],
        [/\d+'[sS]?[oO][0-7xXzZ?_]+/, 'number.octal'],
        [/\d+'[sS]?[dD][0-9xXzZ?_]+/, 'number'],
        [/\d+'[sS]?[hH][0-9a-fA-FxXzZ?_]+/, 'number.hex'],
        [/\d+(\.\d+)?([eE][\-+]?\d+)?/, 'number'],
        [/'[01xXzZ]+/, 'number'],
      ],
      strings: [
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, 'string', '@pop'],
      ],
    },
  }
}

function registerFilelistLanguage(): void {
  const languageId = FILELIST_LANGUAGE_ID
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
