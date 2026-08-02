import { describe, expect, it } from 'vitest'
import { HOME_QOR_METRIC_DESCRIPTORS, toHomeQorMetricTiles } from './useHomeQorMetrics'
import { DASHBOARD_METRIC_ORDER } from '@/views/project-management/projectAnalysisPresentation'
import type { ProjectWorkspaceFinalMetrics } from '@/utils/projectManagement'

describe('home QoR metric tiles', () => {
  it('tracks the project dashboard comparison columns, excluding runtime and memory', () => {
    expect(HOME_QOR_METRIC_DESCRIPTORS.map((entry) => entry.id)).toEqual([
      ...DASHBOARD_METRIC_ORDER,
    ])
    expect(HOME_QOR_METRIC_DESCRIPTORS).toHaveLength(8)
    expect(HOME_QOR_METRIC_DESCRIPTORS.map((entry) => entry.id)).not.toContain('runtime')
    expect(HOME_QOR_METRIC_DESCRIPTORS.map((entry) => entry.id)).not.toContain('memory')
  })

  it('labels tiles with the comparison table headers', () => {
    expect(HOME_QOR_METRIC_DESCRIPTORS.map((entry) => entry.label)).toEqual([
      'Die Area',
      'Core Util',
      'Frequency [MHz]',
      'Setup WNS',
      'Setup TNS',
      'Hold WNS',
      'Hold TNS',
      'DRC',
    ])
  })

  it('renders every tile as pending when no metrics are available', () => {
    const tiles = toHomeQorMetricTiles(null)
    expect(tiles).toHaveLength(8)
    expect(tiles.every((tile) => tile.state === 'pending')).toBe(true)
    expect(tiles.every((tile) => tile.display === 'N/A')).toBe(true)
    expect(tiles.every((tile) => tile.value === null)).toBe(true)
  })

  it('carries display, state and corner hint through from the final metrics', () => {
    const finalMetrics: ProjectWorkspaceFinalMetrics = {
      dieArea: {
        id: 'die_area',
        label: 'Die Area',
        value: 2400,
        display: '2400',
        state: 'good',
        hint: 'MAX - SS - 1.08 V',
      },
      setupWns: {
        id: 'sta_setup_wns',
        label: 'Setup WNS',
        value: -0.42,
        display: '-0.42',
        state: 'bad',
      },
    }

    const tiles = toHomeQorMetricTiles(finalMetrics)
    expect(tiles[0]).toEqual({
      id: 'die_area',
      label: 'Die Area',
      display: '2400',
      value: 2400,
      state: 'good',
      hint: 'MAX - SS - 1.08 V',
    })
    expect(tiles.find((tile) => tile.id === 'wns')).toMatchObject({
      display: '-0.42',
      state: 'bad',
    })
    // Metrics absent from the artifact still occupy a slot so the grid stays stable.
    expect(tiles.find((tile) => tile.id === 'drc')).toMatchObject({
      display: 'N/A',
      state: 'pending',
    })
  })
})
