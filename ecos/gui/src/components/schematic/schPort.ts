/** 原理图端口标注（与 SchShellNode 一致） */
export type SchPort = {
  name: string
  badge?: string
  tone?: 'default' | 'muted' | 'error' | 'violet'
  prefix?: string
}
