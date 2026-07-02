import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FlowLogStepChooser, { type FlowLogStepChooserItem } from './FlowLogStepChooser.vue'

const items: FlowLogStepChooserItem[] = [
  {
    failed: false,
    key: 'synthesis:yosys',
    live: false,
    state: 'Success',
    stepName: 'Synthesis',
  },
  {
    failed: false,
    key: 'floorplan:openroad',
    live: true,
    state: 'Running',
    stepName: 'Floorplan',
  },
]

function mountChooser(options?: {
  liveKey?: string | null
  selectedKey?: string | null
}) {
  return mount(FlowLogStepChooser, {
    global: {
      stubs: {
        VirtualScroller: {
          props: ['items'],
          template:
            '<div class="flow-log-step-chooser-scroller"><slot v-for="item in items" name="item" :item="item" /></div>',
        },
      },
    },
    props: {
      items,
      liveKey: options?.liveKey ?? null,
      selectedKey: options?.selectedKey ?? 'synthesis:yosys',
    },
  })
}

describe('FlowLogStepChooser interactions', () => {
  it('emits close when the close button is clicked', async () => {
    const wrapper = mountChooser()

    await wrapper.get('button.flow-log-step-chooser-close').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('shows jump to live for a different live step and emits jumpLive', async () => {
    const wrapper = mountChooser({
      liveKey: 'floorplan:openroad',
      selectedKey: 'synthesis:yosys',
    })

    const liveButton = wrapper.get('button.flow-log-step-chooser-live-btn')
    expect(liveButton.text()).toContain('Jump to live')

    await liveButton.trigger('click')

    expect(wrapper.emitted('jumpLive')).toHaveLength(1)
  })

  it('emits select with the clicked step key', async () => {
    const wrapper = mountChooser()

    await wrapper
      .findAll('button.flow-log-step-chooser-item')
      .find((button) => button.text().includes('Floorplan'))!
      .trigger('click')

    expect(wrapper.emitted('select')).toEqual([['floorplan:openroad']])
  })
})
