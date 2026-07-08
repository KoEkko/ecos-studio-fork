import { describe, expect, it } from 'vitest'

import {
  WorkspaceSessionNotFoundError,
  WorkspaceSessionRegistry,
} from './workspaceSessions'

describe('WorkspaceSessionRegistry', () => {
  it('creates a GUI handle only after a workspace is activated', () => {
    const registry = new WorkspaceSessionRegistry({
      idProvider: () => 'workspace-handle-1',
    })

    const session = registry.activate('/work/demo', 'workspace-1')

    expect(session).toEqual({
      directory: '/work/demo',
      eccWorkspaceId: 'workspace-1',
      workspaceHandle: 'workspace-handle-1',
    })
  })

  it('keeps the GUI handle stable when rebinding the active ECC workspace id', () => {
    const registry = new WorkspaceSessionRegistry({
      idProvider: () => 'workspace-handle-1',
    })
    const session = registry.activate('/work/demo', 'workspace-1')

    registry.clearEccWorkspaceIds()
    registry.rebindActive('workspace-2')

    expect(registry.require(session.workspaceHandle)).toEqual({
      directory: '/work/demo',
      eccWorkspaceId: 'workspace-2',
      workspaceHandle: 'workspace-handle-1',
    })
  })

  it('throws when resolving an unknown handle', () => {
    const registry = new WorkspaceSessionRegistry()

    expect(() => registry.require('missing')).toThrow(WorkspaceSessionNotFoundError)
  })

  it('closes the active session', () => {
    const registry = new WorkspaceSessionRegistry({
      idProvider: () => 'workspace-handle-1',
    })
    const session = registry.activate('/work/demo', 'workspace-1')

    registry.close(session.workspaceHandle)

    expect(registry.active).toBeNull()
  })
})
