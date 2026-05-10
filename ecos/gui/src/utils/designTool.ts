import type { DesignTool, Project } from '@/types'

export function normalizeDesignTool(designTool?: DesignTool | null): DesignTool {
  return designTool === 'frontend' ? 'frontend' : 'backend'
}

export function projectDesignTool(project?: Pick<Project, 'designTool'> | null): DesignTool {
  return normalizeDesignTool(project?.designTool)
}
