// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FlowRunLiveBlock from './FlowRunLiveBlock.vue'
import type { FlowRunRecord, FlowRunStep } from '@/composables/flowRunStore'

const NOW = 1_000_000

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
    runtime: '',
    peakMemoryMb: 0,
    ...overrides,
  }
}

function record(overrides: Partial<FlowRunRecord> = {}): FlowRunRecord {
  return {
    id: 'run-1',
    trigger: 'user',
    scope: 'full',
    rerun: false,
    startedAt: NOW - 206_000,
    state: 'running',
    steps: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('FlowRunLiveBlock', () => {
  it('shows the running headline and both elapsed clocks', () => {
    const wrapper = mount(FlowRunLiveBlock, {
      props: {
        run: record({
          steps: [
            step('Synthesis', 'success'),
            step('Route', 'running', { startedAt: NOW - 42_000 }),
          ],
        }),
      },
    })

    expect(wrapper.find('.live-block-headline').text()).toBe('Flow · Route · ecc')
    expect(wrapper.find('.live-block-time').text()).toBe('Step 42s · Run 3m 26s')
    expect(wrapper.find('.live-block').classes()).toContain('is-running')
  })

  it('prefers a running step over a stale failed step', () => {
    const wrapper = mount(FlowRunLiveBlock, {
      props: {
        run: record({
          steps: [
            step('Route', 'failed'),
            step('DRC', 'running', { startedAt: NOW - 5_000 }),
          ],
        }),
      },
    })

    expect(wrapper.find('.live-block').classes()).toContain('is-running')
    expect(wrapper.find('.live-block-headline').text()).toContain('DRC')
  })

  it('ticks the elapsed readout once a second', async () => {
    const wrapper = mount(FlowRunLiveBlock, {
      props: {
        run: record({ steps: [step('Route', 'running', { startedAt: NOW - 42_000 })] }),
      },
    })

    vi.advanceTimersByTime(2_000)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.live-block-time').text()).toBe('Step 44s · Run 3m 28s')
  })

  it('shows Initializing before any step has been observed running', () => {
    const wrapper = mount(FlowRunLiveBlock, { props: { run: record() } })

    expect(wrapper.find('.live-block-headline').text()).toBe('Initializing Flow')
    expect(wrapper.find('.live-block-preview-text').text()).toContain(
      'Waiting for first step output',
    )
  })

  it('keeps the failed step expanded with error lines', () => {
    const wrapper = mount(FlowRunLiveBlock, {
      props: {
        run: record({
          steps: [step('Route', 'failed', { startedAt: NOW - 60_000 }), step('DRC', 'pending')],
        }),
        logText: 'ERROR: 1204 DRC violations on metal3\nERROR: routing failed',
      },
    })

    expect(wrapper.find('.live-block').classes()).toContain('is-failed')
    expect(wrapper.find('.live-block-headline').text()).toContain('Route failed')
    expect(wrapper.find('.live-block-console').exists()).toBe(true)
    expect(wrapper.findAll('.live-block-console li')[0].classes()).toContain('is-error')
  })

  it('collapses running log to a one-line preview until expanded', async () => {
    const wrapper = mount(FlowRunLiveBlock, {
      props: {
        run: record({
          steps: [step('Synthesis', 'success'), step('Route', 'running')],
        }),
        logText: 'INFO: a\nINFO: b\nINFO: c\nINFO: d\n',
      },
    })

    expect(wrapper.find('.live-block-console').exists()).toBe(false)
    expect(wrapper.find('.live-block-preview-text').text()).toBe('INFO: d')
    expect(wrapper.find('.live-block-track').exists()).toBe(true)
    expect(wrapper.find('.live-block-track-count').text()).toBe('1 / 2')
    expect(wrapper.find('.live-block-track-steps').exists()).toBe(false)

    await wrapper.find('.live-block-preview').trigger('click')

    const lines = wrapper.findAll('.live-block-console li').map((node) => node.text())
    expect(lines).toEqual(['INFO: a', 'INFO: b', 'INFO: c', 'INFO: d'])
    expect(wrapper.text()).toContain('View full log →')
  })

  it('expands the progress track independently from the log panel', async () => {
    const wrapper = mount(FlowRunLiveBlock, {
      props: {
        run: record({
          steps: [
            step('Synthesis', 'success'),
            step('Route', 'running'),
            step('DRC', 'pending'),
          ],
        }),
      },
    })

    expect(wrapper.find('.live-block-track-steps').exists()).toBe(false)

    await wrapper.find('.live-block-track-toggle').trigger('click')

    expect(wrapper.findAll('.live-block-track-step')).toHaveLength(3)
    expect(wrapper.find('.live-block-console').exists()).toBe(false)
  })

  it('opens a step log from the expanded progress track', async () => {
    const wrapper = mount(FlowRunLiveBlock, {
      props: {
        run: record({
          steps: [step('Synthesis', 'success'), step('Route', 'running')],
        }),
      },
    })

    await wrapper.find('.live-block-track-toggle').trigger('click')
    await wrapper.find('.live-block-track-step.is-success').trigger('click')

    expect(wrapper.emitted('openFlowLog')?.[0]?.[0]).toMatchObject({ name: 'Synthesis' })
  })

  it('opens the focused step log from the running expanded actions', async () => {
    const wrapper = mount(FlowRunLiveBlock, {
      props: {
        run: record({ steps: [step('Route', 'running')] }),
        logText: 'INFO: hello',
      },
    })

    await wrapper.find('.live-block-preview').trigger('click')
    await wrapper.find('.live-block-link').trigger('click')

    expect(wrapper.emitted('openFlowLog')?.[0]?.[0]).toMatchObject({ name: 'Route' })
  })

  it('hides Ask Assistant while the run is still healthy', () => {
    const wrapper = mount(FlowRunLiveBlock, {
      props: {
        run: record({ steps: [step('Route', 'running')] }),
        assistantReady: true,
        logText: 'INFO: hello',
      },
    })

    expect(wrapper.text()).not.toContain('Ask Assistant')
  })

  it('keeps Ask Assistant muted until a provider is ready', async () => {
    const wrapper = mount(FlowRunLiveBlock, {
      props: {
        run: record({ steps: [step('Route', 'failed', { startedAt: 1 })] }),
        assistantReady: false,
        logText: 'ERROR: boom',
      },
    })
    const ask = wrapper
      .findAll('button')
      .find((btn) => btn.text().includes('Ask Assistant'))

    expect(ask?.attributes('aria-disabled')).toBe('true')
    await ask?.trigger('click')
    expect(wrapper.emitted('askAssistant')).toBeUndefined()
  })

  it('emits Ask Assistant with the failed step and error lines when ready', async () => {
    const wrapper = mount(FlowRunLiveBlock, {
      props: {
        run: record({ steps: [step('Route', 'failed', { startedAt: 1 })] }),
        assistantReady: true,
        logText: 'ERROR: boom\nERROR: again',
      },
    })

    const ask = wrapper
      .findAll('button')
      .find((btn) => btn.text().includes('Ask Assistant'))
    await ask?.trigger('click')

    expect(wrapper.emitted('askAssistant')?.[0]).toEqual([
      expect.objectContaining({ name: 'Route' }),
      ['ERROR: boom', 'ERROR: again'],
    ])
  })

  it('does not render a Stop control', () => {
    const wrapper = mount(FlowRunLiveBlock, {
      props: { run: record({ steps: [step('Route', 'running')] }) },
    })

    expect(wrapper.text()).not.toContain('Stop')
  })

  it('announces itself politely without reading the ticking clock or log', () => {
    const wrapper = mount(FlowRunLiveBlock, {
      props: {
        run: record({ steps: [step('Route', 'running')] }),
        logText: 'INFO: hello',
      },
    })

    expect(wrapper.find('.live-block').attributes('role')).toBe('status')
    expect(wrapper.find('.live-block-time').attributes('aria-hidden')).toBe('true')
  })
})
