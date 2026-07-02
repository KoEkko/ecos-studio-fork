import { describe, expect, it, beforeEach, vi } from 'vitest'
import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import DesignFilesManageDialog from './DesignFilesManageDialog.vue'

const workspaceState = vi.hoisted(() => ({
  currentProject: {
    value: {
      id: 'demo',
      name: 'Demo Workspace',
      path: '/workspace/demo',
    },
  },
  invalidateWorkspaceResources: vi.fn(),
  showToast: vi.fn(),
}))

const desktopApi = vi.hoisted(() => ({
  dialog: {
    pickDirectory: vi.fn(),
    pickRtlSources: vi.fn(),
  },
  workspace: {
    addDesignFiles: vi.fn(),
    listDesignFiles: vi.fn(),
    removeDesignFile: vi.fn(),
    scanRtlDirectory: vi.fn(),
  },
}))

const resetFlowApi = vi.hoisted(() => vi.fn())
const requestHomeRunArtifactReset = vi.hoisted(() => vi.fn())

vi.mock('@/composables/useWorkspace', () => ({
  useWorkspace: () => workspaceState,
}))

vi.mock('@/platform/desktop', () => ({
  getDesktopApi: () => desktopApi,
}))

vi.mock('@/api/flow', () => ({
  resetFlowApi,
}))

vi.mock('@/composables/homeRunArtifacts', () => ({
  requestHomeRunArtifactReset,
}))

function designEntry(path: string) {
  return {
    basename: path.split('/').pop() ?? path,
    exists: true,
    filelistEntry: path,
    managedInWorkspace: false,
    resolvedPath: path,
  }
}

function mountDialog() {
  return mount(DesignFilesManageDialog, {
    props: {
      modelValue: false,
    },
  })
}

async function openDialog(wrapper: VueWrapper) {
  await wrapper.setProps({ modelValue: true })
  await flushPromises()
}

function getButton(wrapper: VueWrapper, label: string): DOMWrapper<Element> {
  const button = wrapper
    .findAll('button')
    .find((candidate) => candidate.text().includes(label))
  expect(button, `button "${label}" should exist`).toBeTruthy()
  return button!
}

async function chooseBrowseAction(wrapper: VueWrapper, label: string) {
  await getButton(wrapper, 'Browse').trigger('click')
  await getButton(wrapper, label).trigger('click')
  await flushPromises()
}

beforeEach(() => {
  workspaceState.currentProject.value = {
    id: 'demo',
    name: 'Demo Workspace',
    path: '/workspace/demo',
  }
  workspaceState.invalidateWorkspaceResources.mockClear()
  workspaceState.showToast.mockClear()
  requestHomeRunArtifactReset.mockClear()
  resetFlowApi.mockReset()
  resetFlowApi.mockResolvedValue({ response: 'success' })

  desktopApi.dialog.pickDirectory.mockReset()
  desktopApi.dialog.pickRtlSources.mockReset()
  desktopApi.workspace.addDesignFiles.mockReset()
  desktopApi.workspace.listDesignFiles.mockReset()
  desktopApi.workspace.removeDesignFile.mockReset()
  desktopApi.workspace.scanRtlDirectory.mockReset()

  desktopApi.dialog.pickDirectory.mockResolvedValue(null)
  desktopApi.dialog.pickRtlSources.mockResolvedValue(null)
  desktopApi.workspace.addDesignFiles.mockResolvedValue({ added: [], skipped: [] })
  desktopApi.workspace.listDesignFiles.mockResolvedValue([
    designEntry('/workspace/demo/src/top.sv'),
  ])
  desktopApi.workspace.removeDesignFile.mockResolvedValue(
    designEntry('/workspace/demo/src/top.sv'),
  )
  desktopApi.workspace.scanRtlDirectory.mockResolvedValue({
    files: [],
    rootPath: '/workspace/demo/src',
  })
})

describe('DesignFilesManageDialog interactions', () => {
  it('loads workspace RTL files when opened and emits close from Cancel', async () => {
    const wrapper = mountDialog()

    expect(wrapper.text()).not.toContain('Manage RTL Design Files')

    await openDialog(wrapper)

    expect(desktopApi.workspace.listDesignFiles).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Manage RTL Design Files')
    expect(wrapper.text()).toContain('top.sv')

    await getButton(wrapper, 'Cancel').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('adds HDL files from the RTL picker and saves workspace changes', async () => {
    desktopApi.dialog.pickRtlSources.mockResolvedValue({
      directories: [],
      files: ['/outside/alu.sv', '/outside/readme.txt'],
    })
    const wrapper = mountDialog()
    await openDialog(wrapper)

    await chooseBrowseAction(wrapper, 'Select RTL files')

    expect(desktopApi.dialog.pickRtlSources).toHaveBeenCalledWith({
      multiple: false,
      title: 'Add RTL Design Files',
    })
    expect(wrapper.text()).toContain('alu.sv')
    expect(wrapper.text()).not.toContain('readme.txt')

    await getButton(wrapper, 'Save Changes').trigger('click')
    await flushPromises()

    expect(desktopApi.workspace.addDesignFiles).toHaveBeenCalledWith(['/outside/alu.sv'])
    expect(workspaceState.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'RTL Files Updated',
      }),
    )
    expect(wrapper.text()).toContain('Keep Current Run Results?')

    await getButton(wrapper, 'Keep Results').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('scans a design folder and lets the transfer panel add all scanned RTL files', async () => {
    desktopApi.workspace.listDesignFiles.mockResolvedValue([])
    desktopApi.dialog.pickDirectory.mockResolvedValue('/design/rtl')
    desktopApi.workspace.scanRtlDirectory.mockResolvedValue({
      rootPath: '/design/rtl',
      files: ['/design/rtl/core/top.sv', '/design/rtl/core/defs.vh'],
    })
    const wrapper = mountDialog()
    await openDialog(wrapper)

    await chooseBrowseAction(wrapper, 'Select design folder')

    expect(desktopApi.dialog.pickDirectory).toHaveBeenCalledWith({
      title: 'Select RTL Design Folder',
    })
    expect(desktopApi.workspace.scanRtlDirectory).toHaveBeenCalledWith('/design/rtl')
    expect(wrapper.text()).toContain('Directory Selection')
    expect(wrapper.text()).toContain('0 / 2 selected')

    await wrapper.get('button[title="Add all files"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('2 / 2 selected')
    await getButton(wrapper, 'Save Changes').trigger('click')
    await flushPromises()

    expect(desktopApi.workspace.addDesignFiles).toHaveBeenCalledWith([
      '/design/rtl/core/top.sv',
      '/design/rtl/core/defs.vh',
    ])
  })

  it('shows a warning when the file picker returns a directory', async () => {
    desktopApi.dialog.pickRtlSources.mockResolvedValue({
      directories: ['/design/rtl'],
      files: [],
    })
    const wrapper = mountDialog()
    await openDialog(wrapper)

    await chooseBrowseAction(wrapper, 'Select RTL files')

    expect(wrapper.text()).toContain(
      'Folders cannot be uploaded from Select RTL files. Use Select design folder to scan a folder.',
    )
    expect(workspaceState.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warn',
        summary: 'Folder Upload Failed',
      }),
    )
  })

  it('clears run results from the confirmation dialog after saving design changes', async () => {
    desktopApi.dialog.pickRtlSources.mockResolvedValue({
      directories: [],
      files: ['/outside/alu.sv'],
    })
    const wrapper = mountDialog()
    await openDialog(wrapper)

    await chooseBrowseAction(wrapper, 'Select RTL files')
    await getButton(wrapper, 'Save Changes').trigger('click')
    await flushPromises()

    await getButton(wrapper, 'Clear and Reset').trigger('click')
    await flushPromises()

    expect(resetFlowApi).toHaveBeenCalledWith({
      cmd: 'reset_flow',
      data: { directory: '/workspace/demo' },
    })
    expect(requestHomeRunArtifactReset).toHaveBeenCalledWith('/workspace/demo')
    expect(workspaceState.invalidateWorkspaceResources).toHaveBeenCalledWith('all')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})
