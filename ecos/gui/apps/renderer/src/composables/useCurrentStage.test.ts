import { describe, expect, it } from 'vitest'
import { getWorkspaceStageFlags } from './useCurrentStage'

describe('getWorkspaceStageFlags', () => {
  it('treats tech as a workspace setup page instead of a flow step', () => {
    expect(getWorkspaceStageFlags('tech')).toEqual({
      showProgressPanel: false,
      isHome: false,
      isConfigure: false,
      isTech: true,
      isFlowStep: false,
    })
  })

  it('hides the sidebar subflow column on home, which drives the flow itself', () => {
    expect(getWorkspaceStageFlags('home')).toMatchObject({
      showProgressPanel: false,
      isHome: true,
      isFlowStep: false,
    })
  })

  it('shows the sidebar subflow column on a flow step', () => {
    expect(getWorkspaceStageFlags('Floorplan')).toMatchObject({
      showProgressPanel: true,
      isFlowStep: true,
    })
  })
})
