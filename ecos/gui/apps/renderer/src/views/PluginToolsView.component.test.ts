import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PluginToolsView from './PluginToolsView.vue'

const router = vi.hoisted(() => ({
  push: vi.fn(),
}))

const desktopApi = vi.hoisted(() => ({
  dialog: {
    pickDirectory: vi.fn(),
  },
  system: {
    openExternal: vi.fn(),
  },
}))

const pdkManager = vi.hoisted(() => ({
  importPdkForResource: vi.fn(),
}))

const pluginStore = vi.hoisted(() => ({
  activatePdk: vi.fn(),
  cancelResource: vi.fn(),
  cleanup: vi.fn(),
  error: null as string | null,
  fetchTools: vi.fn(),
  importLocalResource: vi.fn(),
  installResource: vi.fn(),
  loading: false,
  refresh: vi.fn(),
  refreshing: false,
  removePdkReference: vi.fn(),
  resourceProgress: {} as Record<string, any>,
  resources: [] as any[],
  uninstallResource: vi.fn(),
  updateResource: vi.fn(),
  validatePdk: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => router,
}))

vi.mock('@/stores/pluginStore', () => ({
  usePluginStore: () => pluginStore,
}))

vi.mock('@/composables/usePdkManager', () => ({
  usePdkManager: () => pdkManager,
}))

vi.mock('@/platform/desktop', () => ({
  getOptionalDesktopApi: () => desktopApi,
  hasDesktopApi: () => true,
  waitForDesktopApi: async () => desktopApi,
}))

const mb = 1024 * 1024

const resources = [
  resource({
    actions: ['install'],
    available_versions: ['0.52'],
    category: 'synthesis',
    description: 'Logic synthesis suite',
    display_name: 'Yosys',
    id: 'tool:yosys',
    name: 'yosys',
    size: 75 * mb,
    status: 'available',
    type: 'tool',
  }),
  resource({
    actions: ['update', 'uninstall'],
    available_versions: ['2.1'],
    category: 'place-route',
    description: 'Place and route engine',
    display_name: 'OpenROAD',
    id: 'tool:openroad',
    installed_version: '2.0',
    name: 'openroad',
    size: 512 * mb,
    status: 'update_available',
    type: 'tool',
  }),
  resource({
    actions: ['cancel'],
    available_versions: ['0.29'],
    category: 'layout',
    description: 'Layout viewer',
    display_name: 'KLayout',
    id: 'tool:klayout',
    name: 'klayout',
    size: 120 * mb,
    status: 'installing',
    type: 'tool',
  }),
  resource({
    active: true,
    actions: ['validate', 'remove_reference'],
    available_versions: [],
    category: 'pdk',
    description: 'Reference 55nm process',
    display_name: 'ICS55 PDK',
    id: 'pdk:ics55',
    installed_version: '1.0',
    name: 'ics55',
    path: '/pdks/ics55',
    size: 0,
    status: 'installed',
    type: 'pdk',
  }),
]

function mountPluginToolsView() {
  return mount(PluginToolsView, {
    attachTo: document.body,
  })
}

beforeEach(() => {
  vi.useRealTimers()
  router.push.mockReset()
  desktopApi.dialog.pickDirectory.mockReset()
  desktopApi.dialog.pickDirectory.mockResolvedValue('/local/resource')
  desktopApi.system.openExternal.mockReset()
  desktopApi.system.openExternal.mockResolvedValue(undefined)
  pdkManager.importPdkForResource.mockReset()
  pdkManager.importPdkForResource.mockResolvedValue(undefined)

  pluginStore.activatePdk.mockReset()
  pluginStore.cancelResource.mockReset()
  pluginStore.cancelResource.mockResolvedValue(undefined)
  pluginStore.cleanup.mockReset()
  pluginStore.error = null
  pluginStore.fetchTools.mockReset()
  pluginStore.fetchTools.mockResolvedValue(undefined)
  pluginStore.importLocalResource.mockReset()
  pluginStore.importLocalResource.mockResolvedValue(undefined)
  pluginStore.installResource.mockReset()
  pluginStore.installResource.mockResolvedValue(undefined)
  pluginStore.loading = false
  pluginStore.refresh.mockReset()
  pluginStore.refresh.mockResolvedValue(undefined)
  pluginStore.refreshing = false
  pluginStore.removePdkReference.mockReset()
  pluginStore.removePdkReference.mockResolvedValue(undefined)
  pluginStore.resourceProgress = {
    'tool:klayout': {
      message: 'Downloading KLayout',
      phase: 'downloading',
      progress: 0.42,
      resourceId: 'tool:klayout',
      resourceName: 'klayout',
      tool: 'klayout',
    },
  }
  pluginStore.resources = [...resources]
  pluginStore.uninstallResource.mockReset()
  pluginStore.uninstallResource.mockResolvedValue(undefined)
  pluginStore.updateResource.mockReset()
  pluginStore.updateResource.mockResolvedValue(undefined)
  pluginStore.validatePdk.mockReset()
  pluginStore.validatePdk.mockResolvedValue(undefined)
})

describe('PluginToolsView interactions', () => {
  it('renders resources and preselects update/installing rows for review', async () => {
    const wrapper = mountPluginToolsView()
    await flushPromises()

    expect(pluginStore.fetchTools).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('4 Resources')
    expect(wrapper.text()).toContain('Yosys')
    expect(wrapper.text()).toContain('OpenROAD')
    expect(wrapper.text()).toContain('ICS55 PDK')
    expect(wrapper.get('.selected-panel').text()).toContain('Selected Resources (2)')
    expect(wrapper.get('.selected-panel').text()).toContain('OpenROAD')
    expect(wrapper.get('.selected-panel').text()).toContain('KLayout')
  })

  it('filters by category and debounced search, then clears empty filters', async () => {
    vi.useFakeTimers()
    const wrapper = mountPluginToolsView()
    await flushPromises()

    await getButton(wrapper, 'PDKs').trigger('click')
    expect(resourceRows(wrapper)).toHaveLength(1)
    expect(wrapper.text()).toContain('ICS55 PDK')

    await getButton(wrapper, 'All Resources').trigger('click')
    await wrapper.get('input[aria-label="Search resources"]').setValue('openroad')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    expect(resourceRows(wrapper)).toHaveLength(1)
    expect(wrapper.text()).toContain('OpenROAD')
    expect(wrapper.text()).not.toContain('Yosys')

    await wrapper.get('input[aria-label="Search resources"]').setValue('missing')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    expect(wrapper.text()).toContain('No resources found')

    await getButton(wrapper, 'Clear all filters').trigger('click')
    await flushPromises()

    expect(resourceRows(wrapper)).toHaveLength(4)
  })

  it('downloads selected installable resources with the correct store actions', async () => {
    const wrapper = mountPluginToolsView()
    await flushPromises()

    await getRow(wrapper, 'Yosys').get('.resource-check').trigger('click')
    await getButton(wrapper, 'Download').trigger('click')
    await flushPromises()

    expect(pluginStore.installResource).toHaveBeenCalledWith('tool:yosys')
    expect(pluginStore.updateResource).toHaveBeenCalledWith('tool:openroad')
    expect(pluginStore.installResource).not.toHaveBeenCalledWith('tool:klayout')
  })

  it('runs row-specific cancel and local import actions', async () => {
    const wrapper = mountPluginToolsView()
    await flushPromises()

    await getRow(wrapper, 'KLayout').get('button[data-title="Cancel"]').trigger('click')
    await flushPromises()

    expect(pluginStore.cancelResource).toHaveBeenCalledWith('tool:klayout')

    await getRow(wrapper, 'ICS55 PDK')
      .get('button[data-title="Import Local"]')
      .trigger('click')
    await flushPromises()

    expect(desktopApi.dialog.pickDirectory).toHaveBeenCalledWith({
      title: 'Select Local ICS55 PDK Directory',
    })
    expect(pluginStore.importLocalResource).toHaveBeenCalledWith(
      'pdk:ics55',
      '/local/resource',
      pdkManager.importPdkForResource,
    )
  })

  it('opens documentation through the desktop shell and closes back home', async () => {
    const wrapper = mountPluginToolsView()
    await flushPromises()

    await getButton(wrapper, 'View Documentation').trigger('click')
    await flushPromises()

    expect(desktopApi.system.openExternal).toHaveBeenCalledWith(
      'https://github.com/openecos-projects/ecos-studio/blob/main/ecos/docs/user-guide.md',
    )

    await wrapper.get('button[aria-label="Close resource manager"]').trigger('click')

    expect(router.push).toHaveBeenCalledWith('/')
  })
})

function resource(overrides: Record<string, unknown>) {
  return {
    active: false,
    active_version: null,
    actions: [],
    available_versions: [],
    category: '',
    description: '',
    display_name: '',
    error: null,
    health: {
      managed: true,
      missing: [],
      ok: true,
      warnings: [],
    },
    id: '',
    installed_version: null,
    managed_root: '/managed',
    name: '',
    path: null,
    platform: 'linux-x64',
    size: 0,
    source: 'registry',
    status: 'available',
    type: 'tool',
    ...overrides,
  }
}

function resourceRows(wrapper: ReturnType<typeof mountPluginToolsView>) {
  return wrapper.findAll('.resource-row')
}

function getRow(wrapper: ReturnType<typeof mountPluginToolsView>, text: string) {
  const row = resourceRows(wrapper).find((candidate) => candidate.text().includes(text))
  expect(row, `resource row "${text}" should exist`).toBeTruthy()
  return row!
}

function getButton(wrapper: ReturnType<typeof mountPluginToolsView>, text: string) {
  const button = wrapper
    .findAll('button')
    .find((candidate) => candidate.text().includes(text))
  expect(button, `button "${text}" should exist`).toBeTruthy()
  return button!
}
