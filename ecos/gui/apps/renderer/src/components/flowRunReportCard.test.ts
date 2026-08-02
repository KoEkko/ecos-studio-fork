// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FlowRunReportCard from './FlowRunReportCard.vue'
import {
  flowRunReportView,
  flowRunSnapshotReportView,
} from '@/composables/flowRunReport'
import type { FlowRunRecord, FlowRunStep } from '@/composables/flowRunStore'

function step(
  name: string,
  state: FlowRunStep['state'],
  overrides: Partial<FlowRunStep> = {},
): FlowRunStep {
  return {
    name,
    path: name.toLowerCase(),
    label: name,
    tool: 'ecc',
    state,
    runtime: '00:00:18',
    peakMemoryMb: 412,
    ...overrides,
  }
}

function record(overrides: Partial<FlowRunRecord> = {}): FlowRunRecord {
  return {
    id: 'run-1',
    trigger: 'user',
    scope: 'full',
    rerun: false,
    startedAt: 0,
    finishedAt: 252_000,
    state: 'success',
    steps: [step('Synthesis', 'success'), step('Route', 'success')],
    ...overrides,
  }
}

function mountRun(overrides: Partial<FlowRunRecord> = {}) {
  return mount(FlowRunReportCard, {
    props: { report: flowRunReportView(record(overrides)) },
  })
}

describe('FlowRunReportCard', () => {
  it('summarises a successful run without opening the step list', () => {
    const wrapper = mountRun()

    expect(wrapper.find('.run-report-title').text()).toBe('Flow')
    expect(wrapper.text()).toContain('4m 12s')
    expect(wrapper.text()).toContain('2 / 2')
    expect(wrapper.find('.run-report-steps').exists()).toBe(false)
  })

  it('opens straight to the step list when the run failed', () => {
    const wrapper = mountRun({
      state: 'failed',
      steps: [step('Synthesis', 'success'), step('Route', 'failed')],
      failure: {
        stepName: 'Route',
        tool: 'ecc',
        lines: ['ERROR: routing failed'],
      },
    })

    expect(wrapper.find('.run-report-title').text()).toContain('failed at Route')
    expect(wrapper.findAll('.run-report-step')).toHaveLength(2)
    expect(wrapper.find('.run-report-failure').text()).toContain('ERROR: routing failed')
  })

  it('renders an in-progress snapshot in the running style, not failed', () => {
    const wrapper = mount(FlowRunReportCard, {
      props: {
        report: flowRunSnapshotReportView({
          steps: [
            step('Synthesis', 'success'),
            step('Place', 'running'),
            step('Route', 'pending', { runtime: '' }),
          ],
          state: 'running',
          stepRuntimeSeconds: 20,
        }),
      },
    })

    expect(wrapper.find('.run-report').classes()).toContain('is-running')
    expect(wrapper.find('.run-report').classes()).not.toContain('is-failed')
    expect(wrapper.find('.run-report-icon').classes()).toContain('ri-loader-4-line')
    expect(wrapper.find('.run-report-title').text()).toContain('running Place')
    expect(wrapper.find('.run-report-tag').text()).toBe('in progress')
    expect(wrapper.findAll('.run-report-step')).toHaveLength(3)
  })

  it('keeps Ask Assistant muted until a provider is ready', async () => {
    const wrapper = mount(FlowRunReportCard, {
      props: {
        assistantReady: false,
        report: flowRunReportView(
          record({
            state: 'failed',
            steps: [step('Route', 'failed')],
            failure: { stepName: 'Route', tool: 'ecc', lines: ['ERROR: boom'] },
          }),
        ),
      },
    })
    const ask = wrapper.findAll('.run-report-link')[1]

    expect(ask.attributes('aria-disabled')).toBe('true')
    await ask.trigger('click')
    expect(wrapper.emitted('askAssistant')).toBeUndefined()
  })

  it('lets the reader collapse a failed run they have finished reading', async () => {
    const wrapper = mountRun({
      state: 'failed',
      steps: [step('Route', 'failed')],
    })

    await wrapper.find('.run-report-summary').trigger('click')

    expect(wrapper.find('.run-report-steps').exists()).toBe(false)
  })

  it('names the slowest step with its runtime', () => {
    const wrapper = mountRun({
      steps: [
        step('Synthesis', 'success', { runtime: '00:00:18' }),
        step('Route', 'success', { runtime: '00:01:02', peakMemoryMb: 2458 }),
      ],
    })

    const slowest = wrapper.find('.run-report-slowest').text()
    expect(slowest).toContain('Route')
    expect(slowest).toContain('00:01:02')
    expect(slowest).toContain('2.4 GB')
  })

  it('deep-links a step that has a log', async () => {
    const wrapper = mountRun({
      state: 'failed',
      steps: [step('Route', 'failed')],
    })

    await wrapper.find('.run-report-step').trigger('click')

    expect(wrapper.emitted('openFlowLog')?.[0]?.[0]).toMatchObject({ name: 'Route' })
  })

  it('refuses to link a step that never ran, because it has no log', async () => {
    const wrapper = mountRun({
      state: 'failed',
      steps: [step('Route', 'failed'), step('DRC', 'pending', { runtime: '' })],
    })
    const pending = wrapper.findAll('.run-report-step')[1]

    expect(pending.attributes('disabled')).toBeDefined()
    expect(pending.text()).toContain('not run')

    await pending.trigger('click')
    expect(wrapper.emitted('openFlowLog')).toBeUndefined()
  })

  it('marks a rerun and a run someone else started', () => {
    expect(mountRun({ rerun: true }).find('.run-report-title').text()).toContain(
      '(rerun)',
    )
    expect(mountRun({ trigger: 'external' }).find('.run-report-tag').text()).toContain(
      'started elsewhere',
    )
  })

  it('titles a single step run after the step', () => {
    const wrapper = mountRun({ scope: 'step', steps: [step('Route', 'success')] })

    expect(wrapper.find('.run-report-title').text()).toBe('Route')
  })
})

describe('FlowRunReportCard as a disk snapshot', () => {
  function mountSnapshot() {
    return mount(FlowRunReportCard, {
      props: {
        report: flowRunSnapshotReportView({
          steps: [step('Synthesis', 'success'), step('Route', 'success')],
          state: 'success',
          stepRuntimeSeconds: 252,
        }),
      },
    })
  }

  /*
   * Summing step runtimes gives CPU time, not the wall clock a run took. The card has
   * to say which one it is showing or the number quietly lies.
   */
  it('never presents its step runtime sum as a wall clock duration', () => {
    const text = mountSnapshot().text()

    expect(text).toContain('4m 12s across steps')
  })

  it('says the numbers came off disk rather than from this session', () => {
    expect(mountSnapshot().find('.run-report-tag').text()).toContain('last run on disk')
  })
})
