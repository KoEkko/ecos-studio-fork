import { describe, expect, it } from 'vitest'
import useHomeDataSource from './useHomeData.ts?raw'
import useFlowStagesSource from './useFlowStages.ts?raw'
import observationIndexSource from './workspace-observation/index.ts?raw'
import flowStagesObservationSource from './workspace-observation/flowStagesObservation.ts?raw'

describe('useHomeData flow log loading strategy', () => {
  it('exposes an on-demand step log loader instead of bulk hydrating all contents on initial load', () => {
    expect(useHomeDataSource).toContain('ensureFlowLogSegmentContentLoaded')
    expect(useHomeDataSource).not.toContain(
      'await hydrateSegmentsWithLogs(flowLogSegments',
    )
  })

  it('subscribes to project file changes while keeping interval polling as a fallback', () => {
    expect(useHomeDataSource).toContain('watchProjectFile')
    expect(useHomeDataSource).toContain('startProjectFileWatcher')
    expect(useHomeDataSource).toContain('setInterval')
  })

  it('uses workspace resource metadata for step log paths instead of rebuilding them locally', () => {
    expect(useHomeDataSource).toContain('getWorkspaceResourceIndexApi')
    expect(useHomeDataSource).not.toContain('function stepLogAbsPath')
  })

  it('binds home observation once and never tears it down on component unmount', () => {
    expect(useHomeDataSource).toContain('ensureHomeObservationBound')
    expect(useHomeDataSource).toContain('homeObservationBound')
    expect(useHomeDataSource).not.toMatch(/\bonUnmounted\s*\(/)
  })
})

describe('workspace observation owner', () => {
  it('owns the flow.json watcher outside the useFlowStages facade', () => {
    expect(flowStagesObservationSource).toContain('watchProjectFile')
    expect(useFlowStagesSource).not.toContain('watchProjectFile')
    expect(useFlowStagesSource).toContain('getFlowStagesObservation')
  })

  it('exposes a single app-level bind entry including QoR', () => {
    expect(observationIndexSource).toContain('bindWorkspaceObservation')
    expect(observationIndexSource).toContain('ensureFlowStagesObservationBound')
    expect(observationIndexSource).toContain('ensureHomeObservationBound')
    expect(observationIndexSource).toContain('ensureQorObservationBound')
  })

  it('uses path@generation for Home assets instead of path-only short-circuit', () => {
    expect(useHomeDataSource).toContain('assetGenerationKey')
    expect(useHomeDataSource).toContain('statProjectFile')
    expect(useHomeDataSource).toContain('_loadedLayoutIdentity')
    expect(useHomeDataSource).not.toContain('_loadedLayoutPath')
    expect(useHomeDataSource).toContain("invalidateObservation(['home-assets', 'qor', 'logs']")
  })
})
