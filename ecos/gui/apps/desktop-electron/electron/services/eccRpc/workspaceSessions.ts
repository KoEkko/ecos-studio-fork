import { randomUUID } from 'node:crypto'

export interface WorkspaceSessionRecord {
  directory: string
  eccWorkspaceId: string | null
  workspaceHandle: string
}

export class WorkspaceSessionNotFoundError extends Error {
  constructor(workspaceHandle: string) {
    super(`Workspace session not found: ${workspaceHandle}`)
    this.name = 'WorkspaceSessionNotFoundError'
  }
}

export interface WorkspaceSessionRegistryOptions {
  idProvider?: () => string
}

export class WorkspaceSessionRegistry {
  private activeSession: WorkspaceSessionRecord | null = null
  private readonly idProvider: () => string

  constructor(options: WorkspaceSessionRegistryOptions = {}) {
    this.idProvider = options.idProvider ?? (() => `workspace-${randomUUID()}`)
  }

  get active(): WorkspaceSessionRecord | null {
    return this.activeSession ? { ...this.activeSession } : null
  }

  activate(directory: string, eccWorkspaceId: string): WorkspaceSessionRecord {
    this.activeSession = {
      directory,
      eccWorkspaceId,
      workspaceHandle: this.idProvider(),
    }
    return { ...this.activeSession }
  }

  clearEccWorkspaceIds(): void {
    if (!this.activeSession) {
      return
    }
    this.activeSession = {
      ...this.activeSession,
      eccWorkspaceId: null,
    }
  }

  close(workspaceHandle: string): void {
    if (this.activeSession?.workspaceHandle === workspaceHandle) {
      this.activeSession = null
    }
  }

  rebindActive(eccWorkspaceId: string): WorkspaceSessionRecord {
    if (!this.activeSession) {
      throw new WorkspaceSessionNotFoundError('')
    }
    this.activeSession = {
      ...this.activeSession,
      eccWorkspaceId,
    }
    return { ...this.activeSession }
  }

  require(workspaceHandle: string): WorkspaceSessionRecord {
    if (this.activeSession?.workspaceHandle !== workspaceHandle) {
      throw new WorkspaceSessionNotFoundError(workspaceHandle)
    }
    return { ...this.activeSession }
  }
}
