// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProjectQorScoreChart from './ProjectQorScoreChart.vue'
import type { ProjectQorTrendPoint } from '@/utils/projectQorTrend'

const TREND_POINTS: ProjectQorTrendPoint[] = [
  { workspaceId: 'ws_a', label: 'ws_a', score: 58.4, status: 'Yellow' },
  { workspaceId: 'ws_b', label: 'ws_b', score: 74.2, status: 'Green' },
  { workspaceId: 'ws_c', label: 'ws_c', score: null, status: 'Blocked' },
]

function mountChart(trendPoints = TREND_POINTS) {
  return mount(ProjectQorScoreChart, {
    props: {
      trendPoints,
      baselineWorkspaceId: 'ws_a',
      baselineLabel: 'ws_a',
      selectedWorkspaceId: 'ws_b',
    },
  })
}

describe('ProjectQorScoreChart', () => {
  it('plots one lollipop per workspace', () => {
    expect(mountChart().findAll('.qor-lollipop')).toHaveLength(3)
  })

  it('labels rated workspaces with their score and unrated ones as NR', () => {
    const wrapper = mountChart()

    expect(
      wrapper.findAll('.qor-chart-value-label').map((label) => label.text()),
    ).toEqual(['58.4', '74.2'])
    expect(wrapper.find('.qor-chart-not-rated').text()).toBe('NR')
  })

  it('flags the highest score as best and reports it in the header', () => {
    const wrapper = mountChart()
    const lollipops = wrapper.findAll('.qor-lollipop')

    expect(lollipops[1].classes()).toContain('best')
    expect(lollipops[0].classes()).not.toContain('best')
    expect(wrapper.find('.qor-best-chip').text()).toContain('74.2')
  })

  it('marks the selected and baseline workspaces separately', () => {
    const lollipops = mountChart().findAll('.qor-lollipop')

    expect(lollipops[0].classes()).toContain('baseline')
    expect(lollipops[1].classes()).toContain('selected')
  })

  it('selects a workspace when its lollipop is clicked', async () => {
    const wrapper = mountChart()

    await wrapper.findAll('.qor-lollipop')[0].trigger('click')

    expect(wrapper.emitted('select-workspace')).toEqual([['ws_a']])
  })

  it('selects a workspace from the keyboard', async () => {
    const wrapper = mountChart()

    await wrapper.findAll('.qor-lollipop')[2].trigger('keydown.enter')

    expect(wrapper.emitted('select-workspace')).toEqual([['ws_c']])
  })

  it('describes each point for assistive technology', () => {
    const wrapper = mountChart()

    expect(wrapper.findAll('.qor-lollipop')[0].attributes('aria-label')).toBe(
      'ws_a: 58.4 (baseline, below the 60 analysis threshold)',
    )
    expect(wrapper.findAll('.qor-lollipop')[1].attributes('aria-label')).toBe(
      'ws_b: 74.2 (selected, meets the 60 analysis threshold)',
    )
  })

  it('shows an empty state instead of an axis when there is nothing to plot', () => {
    const wrapper = mountChart([])

    expect(wrapper.find('.qor-score-chart').exists()).toBe(false)
    expect(wrapper.find('.qor-score-empty').text()).toContain('No workspace')
    expect(wrapper.find('.qor-best-chip').text()).toBe('NR')
  })
})
