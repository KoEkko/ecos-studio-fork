import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { appMenuActionIds } from '@ecos-studio/shared'
import TopBar from './TopBar.vue'

const push = vi.fn()
const route = {
  name: 'Workspace',
}
const desktopApi = vi.hoisted(() => ({
  window: {
    close: vi.fn(),
    isMaximized: vi.fn(() => Promise.resolve(false)),
    minimize: vi.fn(),
    onMaximizedChanged: vi.fn(() => vi.fn()),
    toggleMaximize: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({
    push,
  }),
}))

vi.mock('@/platform/desktop', () => ({
  getOptionalDesktopApi: () => desktopApi,
  waitForDesktopApi: () => Promise.resolve(desktopApi),
}))

function mountTopBar(props?: { hasWorkspace?: boolean; projectName?: string | null }) {
  return mount(TopBar, {
    props: {
      hasWorkspace: props?.hasWorkspace ?? false,
      projectName: props?.projectName ?? 'Demo',
    },
  })
}

async function openMenu(wrapper: ReturnType<typeof mountTopBar>, label: string) {
  await wrapper
    .findAll('button.menu-btn')
    .find((button) => button.text() === label)!
    .trigger('click')
}

beforeEach(() => {
  setActivePinia(createPinia())
  push.mockClear()
  route.name = 'Workspace'
})

describe('TopBar menu interactions', () => {
  it('emits the new workspace menu action from File', async () => {
    const wrapper = mountTopBar()

    await openMenu(wrapper, 'File')
    await wrapper
      .findAll('button.dropdown-item')
      .find((button) => button.text().includes('New Workspace'))!
      .trigger('click')

    expect(wrapper.emitted('menu-action')).toEqual([[appMenuActionIds.newProject]])
  })

  it('hides the Design menu when there is no workspace', () => {
    const wrapper = mountTopBar({ hasWorkspace: false })

    expect(
      wrapper.findAll('button.menu-btn').map((button) => button.text()),
    ).not.toContain('Design')
  })

  it('shows Manage RTL Files when a workspace exists and emits its action', async () => {
    const wrapper = mountTopBar({ hasWorkspace: true })

    await openMenu(wrapper, 'Design')
    await wrapper
      .findAll('button.dropdown-item')
      .find((button) => button.text().includes('Manage RTL Files'))!
      .trigger('click')

    expect(wrapper.emitted('menu-action')).toEqual([[appMenuActionIds.manageDesignFiles]])
  })

  it('closes an open menu from Escape and outside click', async () => {
    const wrapper = mountTopBar()

    await openMenu(wrapper, 'File')
    expect(wrapper.find('.dropdown-menu').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.dropdown-menu').exists()).toBe(false)

    await openMenu(wrapper, 'File')
    expect(wrapper.find('.dropdown-menu').exists()).toBe(true)

    document.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.dropdown-menu').exists()).toBe(false)
  })
})
