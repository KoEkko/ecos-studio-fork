import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ProjectsView from './ProjectsView.vue'

const router = vi.hoisted(() => ({
  push: vi.fn(),
}))

const workspaceState = vi.hoisted(() => ({
  loadRecentProjects: vi.fn(),
  openProject: vi.fn(),
  recentProjects: {
    __v_isRef: true,
    value: [] as any[],
  },
  removeRecentProject: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => router,
}))

vi.mock('../composables/useWorkspace', () => ({
  useWorkspace: () => workspaceState,
}))

const now = new Date('2026-07-02T08:00:00.000Z')

const projectFixtures = [
  {
    cellCount: 4200,
    completedSteps: 4,
    coreUtilization: 0.42,
    frequencyTarget: 100,
    id: 'demo-success',
    lastOpened: now,
    name: 'chip_demo',
    path: '/workspace/chip_demo',
    pdk: 'ics55',
    status: 'success',
    topModule: 'chip_top',
    totalRuntime: '12m',
    totalSteps: 4,
  },
  {
    completedSteps: 1,
    id: 'demo-running',
    lastOpened: new Date('2026-06-30T08:00:00.000Z'),
    name: 'router_block',
    path: '/workspace/router_block',
    pdk: 'sky130',
    status: 'running',
    topModule: 'router_top',
    totalSteps: 4,
  },
  {
    id: 'legacy-broken',
    lastOpened: new Date('2026-06-20T08:00:00.000Z'),
    name: 'legacy_project',
    path: '/workspace/legacy_project',
    pdk: 'ics55',
    status: 'failed',
    workspaceRecognized: false,
  },
]

function mountProjectsView() {
  return mount(ProjectsView)
}

beforeEach(() => {
  router.push.mockReset()
  workspaceState.loadRecentProjects.mockReset()
  workspaceState.loadRecentProjects.mockResolvedValue(undefined)
  workspaceState.openProject.mockReset()
  workspaceState.openProject.mockResolvedValue(true)
  workspaceState.removeRecentProject.mockReset()
  workspaceState.removeRecentProject.mockResolvedValue(undefined)
  workspaceState.recentProjects.value = [...projectFixtures]
})

describe('ProjectsView interactions', () => {
  it('loads and renders recent project metadata', async () => {
    const wrapper = mountProjectsView()
    await flushPromises()

    expect(workspaceState.loadRecentProjects).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('3 projects')
    expect(wrapper.text()).toContain('chip_demo')
    expect(wrapper.text()).toContain('chip_top')
    expect(wrapper.text()).toContain('100MHz')
    expect(wrapper.text()).toContain('42% util')
    expect(wrapper.text()).toContain('4,200 cells')
  })

  it('filters by PDK, status, and search query and can clear filters', async () => {
    const wrapper = mountProjectsView()
    await flushPromises()

    const selects = wrapper.findAll('select')
    await selects[0]!.setValue('sky130')
    expect(wrapper.text()).toContain('router_block')
    expect(wrapper.text()).not.toContain('chip_demo')

    await selects[1]!.setValue('running')
    expect(wrapper.text()).toContain('router_block')

    await wrapper.get('input[placeholder="Search projects..."]').setValue('missing')
    expect(wrapper.text()).toContain('No matching projects')

    await getButton(wrapper, 'Clear Filters').trigger('click')

    expect(wrapper.text()).toContain('chip_demo')
    expect(wrapper.text()).toContain('router_block')
  })

  it('opens a recognized recent project and navigates to the workspace', async () => {
    const wrapper = mountProjectsView()
    await flushPromises()

    await getProjectRow(wrapper, 'chip_demo').trigger('click')
    await flushPromises()

    expect(workspaceState.openProject).toHaveBeenCalledWith(projectFixtures[0])
    expect(router.push).toHaveBeenCalledWith('/workspace')
  })

  it('does not open an unrecognized workspace entry', async () => {
    const wrapper = mountProjectsView()
    await flushPromises()

    await getProjectRow(wrapper, 'legacy_project').trigger('click')
    await flushPromises()

    expect(workspaceState.openProject).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Workspace not recognized')
  })

  it('removes a recent project without opening it', async () => {
    const wrapper = mountProjectsView()
    await flushPromises()

    await getProjectRow(wrapper, 'router_block')
      .get('button[title="Remove from list"]')
      .trigger('click')
    await flushPromises()

    expect(workspaceState.removeRecentProject).toHaveBeenCalledWith('demo-running')
    expect(workspaceState.openProject).not.toHaveBeenCalled()
  })

  it('routes empty project management to Backend Design', async () => {
    workspaceState.recentProjects.value = []
    const wrapper = mountProjectsView()
    await flushPromises()

    expect(wrapper.text()).toContain('No projects yet')

    await getButton(wrapper, 'Go to Backend Design').trigger('click')

    expect(router.push).toHaveBeenCalledWith('/ecc')
  })
})

function getProjectRow(wrapper: ReturnType<typeof mountProjectsView>, text: string) {
  const row = wrapper
    .findAll('.group')
    .find((candidate) => candidate.text().includes(text))
  expect(row, `project row "${text}" should exist`).toBeTruthy()
  return row!
}

function getButton(wrapper: ReturnType<typeof mountProjectsView>, text: string) {
  const button = wrapper
    .findAll('button')
    .find((candidate) => candidate.text().includes(text))
  expect(button, `button "${text}" should exist`).toBeTruthy()
  return button!
}
