import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBar from './StatusBar.vue'

describe('StatusBar interactions', () => {
  it('emits toggle-terminal when the terminal button is clicked', async () => {
    const wrapper = mount(StatusBar)

    await wrapper.get('button.status-terminal-toggle').trigger('click')

    expect(wrapper.emitted('toggle-terminal')).toHaveLength(1)
  })

  it('updates the terminal button title from the expanded state', async () => {
    const wrapper = mount(StatusBar, {
      props: {
        terminalExpanded: false,
      },
    })

    expect(wrapper.get('button.status-terminal-toggle').attributes('title')).toBe(
      'Show terminal',
    )

    await wrapper.setProps({ terminalExpanded: true })

    expect(wrapper.get('button.status-terminal-toggle').attributes('title')).toBe(
      'Hide terminal',
    )
  })
})
