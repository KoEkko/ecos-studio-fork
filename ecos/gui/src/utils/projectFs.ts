import { invoke } from '@tauri-apps/api/core'

/**
 * Ask the Tauri backend to authorize a concrete file or directory path under the
 * currently registered project root. Returns false when the project has been
 * closed/switched or when the path is outside the active workspace scope.
 */
export async function resolveProjectPathAccess(path: string): Promise<string | null> {
  if (!path) return null

  try {
    return await invoke<string>('request_project_permission', { path })
  } catch (error) {
    console.warn(`Failed to request file access permission for ${path}:`, error)
    return null
  }
}

export async function requestProjectPathAccess(path: string): Promise<boolean> {
  return (await resolveProjectPathAccess(path)) !== null
}

/**
 * Try project-scoped access first. If the path is outside the active workspace
 * root, fall back to granting single-file access for explicit source preview.
 */
export async function resolveProjectOrExternalFileAccess(path: string): Promise<string | null> {
  const projectScoped = await resolveProjectPathAccess(path)
  if (projectScoped) return projectScoped

  try {
    return await invoke<string>('request_external_file_permission', { path })
  } catch (error) {
    console.warn(`Failed to request external file access permission for ${path}:`, error)
    return null
  }
}
