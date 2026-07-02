import { describe, expect, it } from 'vitest'
import { mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import DesignFileTransfer from './DesignFileTransfer.vue'

const allFiles = [
  '/workspace/rtl/core/top.sv',
  '/workspace/rtl/core/defs.vh',
  '/workspace/rtl/periph/uart.v',
]

function mountTransfer(options?: { selectedFiles?: string[] }) {
  return mount(DesignFileTransfer, {
    props: {
      allFiles,
      rootPath: '/workspace/rtl',
      selectedFiles: options?.selectedFiles ?? ['/workspace/rtl/core/top.sv'],
    },
  })
}

function getButton(wrapper: VueWrapper, label: string): DOMWrapper<Element> {
  const button = wrapper
    .findAll('button')
    .find((candidate) => candidate.text().includes(label))
  expect(button, `button "${label}" should exist`).toBeTruthy()
  return button!
}

describe('DesignFileTransfer interactions', () => {
  it('moves a selected available file into the selected file list', async () => {
    const wrapper = mountTransfer()

    expect(wrapper.text()).toContain('1 / 3 selected')
    expect(wrapper.text()).toContain('defs.vh')
    expect(wrapper.text()).toContain('uart.v')

    await getButton(wrapper, 'defs.vh').trigger('click')
    await wrapper.get('button[title="Add selected files"]').trigger('click')

    expect(wrapper.emitted('update:selectedFiles')).toEqual([
      [['/workspace/rtl/core/top.sv', '/workspace/rtl/core/defs.vh']],
    ])
  })

  it('adds all remaining files and preserves the source file order', async () => {
    const wrapper = mountTransfer()

    await wrapper.get('button[title="Add all files"]').trigger('click')

    expect(wrapper.emitted('update:selectedFiles')).toEqual([[allFiles]])
  })

  it('adds an available file on double click', async () => {
    const wrapper = mountTransfer()

    await getButton(wrapper, 'uart.v').trigger('dblclick')

    expect(wrapper.emitted('update:selectedFiles')).toEqual([
      [['/workspace/rtl/core/top.sv', '/workspace/rtl/periph/uart.v']],
    ])
  })

  it('removes selected files through single and bulk remove actions', async () => {
    const wrapper = mountTransfer({
      selectedFiles: ['/workspace/rtl/core/top.sv', '/workspace/rtl/core/defs.vh'],
    })

    await getButton(wrapper, 'core/defs.vh').trigger('click')
    await wrapper.get('button[title="Remove selected files"]').trigger('click')

    expect(wrapper.emitted('update:selectedFiles')).toEqual([
      [['/workspace/rtl/core/top.sv']],
    ])

    await wrapper.setProps({ selectedFiles: allFiles })
    await wrapper.get('button[title="Remove all files"]').trigger('click')

    const emittedUpdates = wrapper.emitted('update:selectedFiles') ?? []
    expect(emittedUpdates[emittedUpdates.length - 1]).toEqual([[]])
  })

  it('removes a selected file on double click', async () => {
    const wrapper = mountTransfer({
      selectedFiles: ['/workspace/rtl/core/top.sv', '/workspace/rtl/core/defs.vh'],
    })

    await getButton(wrapper, 'core/top.sv').trigger('dblclick')

    expect(wrapper.emitted('update:selectedFiles')).toEqual([
      [['/workspace/rtl/core/defs.vh']],
    ])
  })
})
