import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import HomeView from './HomeView.vue'

const homeState = vi.hoisted(() => {
  const makeRef = <T>(value: T) => ({
    __v_isRef: true,
    value,
  })

  return {
    analysisCharts: makeRef<any[]>([]),
    checklistItems: makeRef<any[]>([]),
    config: makeRef<Record<string, any>>({}),
    currentWorkspaceFlowExecutionActive: makeRef(false),
    ensureFlowLogSegmentContentLoaded: vi.fn(),
    expandFlowLogSegment: vi.fn(),
    flowLogContentByKey: makeRef<Record<string, string>>({}),
    flowLogError: makeRef<string | null>(null),
    flowLogLoading: makeRef(false),
    flowLogSegments: makeRef<any[]>([]),
    flowLogStepName: makeRef(''),
    layoutBlobUrl: makeRef(''),
    monitorData: makeRef<Record<string, any> | null>(null),
  }
})

const echartsMock = vi.hoisted(() => {
  const chartInstance = {
    dispose: vi.fn(),
    getZr: vi.fn(() => ({
      on: vi.fn(),
    })),
    group: '',
    resize: vi.fn(),
    setOption: vi.fn(),
  }

  return {
    connect: vi.fn(),
    graphic: {
      LinearGradient: vi.fn(() => ({ type: 'linear-gradient' })),
    },
    init: vi.fn(() => chartInstance),
    use: vi.fn(),
  }
})

vi.mock('echarts/core', () => echartsMock)
vi.mock('echarts/charts', () => ({
  LineChart: {},
}))
vi.mock('echarts/components', () => ({
  GridComponent: {},
  TooltipComponent: {},
}))
vi.mock('echarts/renderers', () => ({
  CanvasRenderer: {},
}))

vi.mock('@/composables/useParameters', () => ({
  useParameters: () => ({
    config: homeState.config,
  }),
}))

vi.mock('@/composables/useHomeData', () => ({
  useHomeData: () => ({
    analysisCharts: homeState.analysisCharts,
    checklistItems: homeState.checklistItems,
    currentWorkspaceFlowExecutionActive: homeState.currentWorkspaceFlowExecutionActive,
    ensureFlowLogSegmentContentLoaded: homeState.ensureFlowLogSegmentContentLoaded,
    expandFlowLogSegment: homeState.expandFlowLogSegment,
    flowLogContentByKey: homeState.flowLogContentByKey,
    flowLogError: homeState.flowLogError,
    flowLogLoading: homeState.flowLogLoading,
    flowLogSegments: homeState.flowLogSegments,
    flowLogStepName: homeState.flowLogStepName,
    layoutBlobUrl: homeState.layoutBlobUrl,
    monitorData: homeState.monitorData,
  }),
}))

vi.mock('@/composables/useWindowResizeState', () => ({
  isWindowResizing: {
    __v_isRef: true,
    value: false,
  },
}))

const FlowLogStepChooserStub = {
  emits: ['close', 'jumpLive', 'select'],
  props: ['items', 'liveKey', 'selectedKey'],
  template: `
    <div class="flow-log-step-chooser-stub">
      <button class="flow-log-step-chooser-close" type="button" @click="$emit('close')">Close</button>
      <button
        v-if="liveKey && liveKey !== selectedKey"
        class="flow-log-step-chooser-live-btn"
        type="button"
        @click="$emit('jumpLive')"
      >
        Jump to live
      </button>
      <button
        v-for="item in items"
        :key="item.key"
        class="flow-log-step-chooser-item"
        type="button"
        @click="$emit('select', item.key)"
      >
        {{ item.stepName }}
      </button>
    </div>
  `,
}

function mountHomeView() {
  return mount(HomeView, {
    attachTo: document.body,
    global: {
      stubs: {
        ChecklistTable: {
          props: ['items'],
          template:
            '<div class="checklist-table-stub"><div v-for="item in items" :key="item.item">{{ item.item }} {{ item.state }}</div></div>',
        },
        FlowLogCodeViewer: {
          props: ['content', 'live', 'loading', 'missing'],
          template:
            '<pre class="flow-log-code-viewer-stub" :data-live="live" :data-loading="loading" :data-missing="missing">{{ content }}</pre>',
        },
        FlowLogStepChooser: FlowLogStepChooserStub,
        Splitter: {
          template: '<div class="splitter-stub"><slot /></div>',
        },
        SplitterPanel: {
          template: '<div class="splitter-panel-stub"><slot /></div>',
        },
      },
    },
  })
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      disconnect = vi.fn()
      observe = vi.fn()
    },
  )
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 0
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())

  homeState.config.value = {
    bottomLayer: 'MET2',
    clock: 'clk_i',
    core: {
      Size: [80, 80],
      utilization: 0.45,
    },
    design: 'chip_demo',
    die: {
      Size: [100, 100],
    },
    frequencyMax: 50,
    pdk: 'ics55',
    topLayer: 'MET5',
    topModule: 'chip_top',
  }
  homeState.monitorData.value = {
    'peak memory (mb)': [12, 24],
    frequency: [50, 75],
    step: ['Synthesis', 'Floorplan'],
  }
  homeState.checklistItems.value = [
    {
      item: 'Timing clean',
      state: 'Success',
      step: 'Synthesis',
      type: 'timing',
    },
    {
      item: 'DRC clean',
      state: 'Failed',
      step: 'Route',
      type: 'signoff',
    },
  ]
  homeState.layoutBlobUrl.value = 'blob:layout-preview'
  homeState.analysisCharts.value = [
    {
      imageBlobUrl: 'blob:instances-chart',
      label: 'instances dist.',
    },
  ]
  homeState.flowLogSegments.value = [
    {
      failed: false,
      missing: false,
      state: 'Success',
      stepName: 'Synthesis',
      tool: 'yosys',
      totalSize: 2048,
      truncated: true,
    },
    {
      failed: false,
      live: true,
      missing: false,
      state: 'Ongoing',
      stepName: 'Floorplan',
      tool: 'openroad',
    },
  ]
  homeState.flowLogContentByKey.value = {
    ['Synthesis\u001fyosys']: 'synthesis log output',
    ['Floorplan\u001fopenroad']: 'floorplan live log',
  }
  homeState.flowLogStepName.value = 'Floorplan'
  homeState.flowLogError.value = null
  homeState.flowLogLoading.value = false
  homeState.currentWorkspaceFlowExecutionActive.value = true
  homeState.ensureFlowLogSegmentContentLoaded.mockClear()
  homeState.expandFlowLogSegment.mockClear()
  homeState.expandFlowLogSegment.mockResolvedValue(undefined)
})

describe('HomeView dashboard interactions', () => {
  it('renders workspace summary data, checklist count, layout, metrics, and selected live log', () => {
    const wrapper = mountHomeView()

    expect(wrapper.text()).toContain('chip_demo')
    expect(wrapper.text()).toContain('chip_top')
    expect(wrapper.text()).toContain('1/2')
    expect(wrapper.get('img[alt="Layout Preview"]').attributes('src')).toBe(
      'blob:layout-preview',
    )
    expect(wrapper.text()).toContain('instances dist.')
    expect(wrapper.text()).toContain('floorplan live log')
  })

  it('opens and closes the layout fullscreen preview from the header action', async () => {
    const wrapper = mountHomeView()

    await wrapper.get('.layout-area .action-btn').trigger('click')
    await flushPromises()

    expect(document.body.querySelector('.layout-fullscreen-overlay')).toBeTruthy()
    expect(wrapper.classes()).toContain('layout-fullscreen-active')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(document.body.querySelector('.layout-fullscreen-overlay')).toBeNull()
    expect(wrapper.classes()).not.toContain('layout-fullscreen-active')
  })

  it('opens the metric chart lightbox and closes it from the dialog button', async () => {
    mountHomeView()

    document.body.querySelector<HTMLElement>('.chart-card')!.click()
    await flushPromises()

    expect(document.body.querySelector('.chart-lightbox-overlay')).toBeTruthy()
    expect(document.body.textContent).toContain('instances dist.')

    document.body.querySelector<HTMLButtonElement>('.chart-lightbox-close')!.click()
    await flushPromises()

    expect(document.body.querySelector('.chart-lightbox-overlay')).toBeNull()
  })

  it('selects a flow log step from the transient chooser and expands its full log', async () => {
    const wrapper = mountHomeView()

    await wrapper.get('.flow-log-steps-trigger').trigger('click')
    await flushPromises()

    expect(document.body.querySelector('.flow-log-chooser-overlay')).toBeTruthy()

    const synthesisButton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('.flow-log-step-chooser-item'),
    ).find((button) => button.textContent?.includes('Synthesis'))
    expect(synthesisButton).toBeTruthy()

    synthesisButton!.click()
    await flushPromises()

    expect(document.body.querySelector('.flow-log-chooser-overlay')).toBeNull()
    expect(wrapper.text()).toContain('synthesis log output')

    await wrapper.get('button.flow-log-expand-btn').trigger('click')
    await flushPromises()

    expect(homeState.expandFlowLogSegment).toHaveBeenCalledWith(
      expect.objectContaining({
        stepName: 'Synthesis',
        tool: 'yosys',
      }),
    )
  })

  it('jumps back to the live flow log after inspecting a completed step', async () => {
    const wrapper = mountHomeView()

    await wrapper.get('.flow-log-steps-trigger').trigger('click')
    await flushPromises()

    const synthesisButton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('.flow-log-step-chooser-item'),
    ).find((button) => button.textContent?.includes('Synthesis'))
    expect(synthesisButton).toBeTruthy()

    synthesisButton!.click()
    await flushPromises()

    expect(wrapper.get('.flow-log-code-viewer-stub').text()).toBe('synthesis log output')

    await wrapper.get('.flow-log-jump-live-btn').trigger('click')
    await flushPromises()

    expect(wrapper.get('.flow-log-code-viewer-stub').text()).toBe('floorplan live log')
    expect(wrapper.find('.flow-log-jump-live-btn').exists()).toBe(false)
  })

  it('toggles the flow step log fullscreen panel and closes it with Escape', async () => {
    const wrapper = mountHomeView()

    await wrapper.get('.gds-area .flow-log-fullscreen-toggle').trigger('click')
    await flushPromises()

    expect(document.body.querySelector('.flow-log-fullscreen-overlay')).toBeTruthy()
    expect(wrapper.classes()).toContain('flow-log-fullscreen-active')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(document.body.querySelector('.flow-log-fullscreen-overlay')).toBeNull()
    expect(wrapper.classes()).not.toContain('flow-log-fullscreen-active')
  })

  it('does not open the metric chart lightbox when a chart has no image', async () => {
    homeState.analysisCharts.value = [
      {
        imageBlobUrl: '',
        label: 'empty chart',
      },
    ]
    const wrapper = mountHomeView()

    await wrapper.get('.chart-card').trigger('click')
    await flushPromises()

    expect(document.body.querySelector('.chart-lightbox-overlay')).toBeNull()
  })

  it('renders the flow log error state', () => {
    homeState.flowLogError.value = 'Unable to read flow logs'
    const wrapper = mountHomeView()

    expect(wrapper.get('.flow-log-error').text()).toContain('Unable to read flow logs')
  })

  it('renders the flow log loading state when no step logs are available yet', () => {
    homeState.flowLogSegments.value = []
    homeState.flowLogContentByKey.value = {}
    homeState.flowLogLoading.value = true
    const wrapper = mountHomeView()

    expect(wrapper.text()).toContain('Loading flow step logs')
  })

  it('renders the empty flow log state when no logs are loading', () => {
    homeState.flowLogSegments.value = []
    homeState.flowLogContentByKey.value = {}
    homeState.flowLogLoading.value = false
    const wrapper = mountHomeView()

    expect(wrapper.text()).toContain('No flow step log yet')
  })
})
