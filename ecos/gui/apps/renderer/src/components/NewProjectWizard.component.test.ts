import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import NewProjectWizard from './NewProjectWizard.vue'

const desktopApi = vi.hoisted(() => ({
  dialog: {
    pickDirectory: vi.fn(),
    pickRtlSources: vi.fn(),
  },
  workspace: {
    scanRtlDirectory: vi.fn(),
  },
}))

const pdkManager = vi.hoisted(() => ({
  importPdk: vi.fn(),
  importedPdks: {
    __v_isRef: true,
    value: [] as any[],
  },
  loadPdks: vi.fn(),
  removePdk: vi.fn(),
}))

const workspaceState = vi.hoisted(() => ({
  showToast: vi.fn(),
}))

vi.mock('@/platform/desktop', () => ({
  getDesktopApi: () => desktopApi,
}))

vi.mock('../composables/usePdkManager', () => ({
  usePdkManager: () => pdkManager,
}))

vi.mock('../composables/useWorkspace', () => ({
  useWorkspace: () => workspaceState,
}))

const importedPdk = {
  description: 'Reference 55nm process',
  detectedFiles: {
    directories: ['libs.ref', 'libs.tech'],
    files: ['README.md'],
  },
  id: 'pdk-ics55',
  importedAt: '2026-07-02T00:00:00.000Z',
  name: 'ICS55 PDK',
  path: '/pdks/ics55',
  pdkId: 'ics55',
  techNode: '55nm',
}

const importedSky130Pdk = {
  description: 'Open source 130nm process',
  detectedFiles: {
    directories: ['libs.ref', 'libs.tech'],
    files: ['README.md', 'sky130_fd_sc_hd.tlef'],
  },
  id: 'pdk-sky130',
  importedAt: '2026-07-02T00:00:00.000Z',
  name: 'Sky130 PDK',
  path: '/pdks/sky130',
  pdkId: 'sky130',
  techNode: '130nm',
}

function mountWizard() {
  return mount(NewProjectWizard)
}

function getButton(wrapper: VueWrapper, label: string): DOMWrapper<Element> {
  const button = wrapper
    .findAll('button')
    .find((candidate) => candidate.text().includes(label))
  expect(button, `button "${label}" should exist`).toBeTruthy()
  return button!
}

async function completeBasicInfo(wrapper: VueWrapper, options?: { directory?: string }) {
  desktopApi.dialog.pickDirectory.mockResolvedValueOnce(
    options?.directory ?? '/workspace/chip_demo',
  )

  await wrapper.get('input[placeholder="e.g. my_chip_design"]').setValue('chip_demo')
  await getButton(wrapper, 'Browse').trigger('click')
  await flushPromises()

  expect(
    (wrapper.get('input[placeholder="Choose a folder..."]').element as HTMLInputElement)
      .value,
  ).toBe(options?.directory ?? '/workspace/chip_demo')
}

async function goToDesignFiles(wrapper: VueWrapper) {
  await completeBasicInfo(wrapper)
  await getButton(wrapper, 'Continue').trigger('click')
  await flushPromises()

  expect(wrapper.text()).toContain('Design Files')
}

async function chooseBrowseAction(wrapper: VueWrapper, label: string) {
  await getButton(wrapper, 'Browse').trigger('click')
  await getButton(wrapper, label).trigger('click')
  await flushPromises()
}

async function fillDesignInputs(wrapper: VueWrapper) {
  await wrapper.get('input[placeholder="e.g. top_module"]').setValue('chip_top')
  await wrapper.get('input[placeholder="e.g. clk"]').setValue('clk_i')
}

async function goToTechnologySetup(wrapper: VueWrapper) {
  desktopApi.dialog.pickRtlSources.mockResolvedValue({
    directories: [],
    files: ['/rtl/chip_top.sv'],
  })

  await goToDesignFiles(wrapper)
  await chooseBrowseAction(wrapper, 'Select RTL files')
  await fillDesignInputs(wrapper)
  await getButton(wrapper, 'Continue').trigger('click')
  await flushPromises()

  expect(wrapper.text()).toContain('Technology Setup')
}

async function goToReview(wrapper: VueWrapper) {
  await goToTechnologySetup(wrapper)
  await getButton(wrapper, 'Continue').trigger('click')
  await flushPromises()

  expect(wrapper.text()).toContain('Review & Create')
}

beforeEach(() => {
  workspaceState.showToast.mockClear()

  pdkManager.importPdk.mockReset()
  pdkManager.importedPdks = ref([importedPdk]) as any
  pdkManager.loadPdks.mockReset()
  pdkManager.loadPdks.mockResolvedValue(undefined)
  pdkManager.removePdk.mockReset()

  desktopApi.dialog.pickDirectory.mockReset()
  desktopApi.dialog.pickDirectory.mockResolvedValue(null)
  desktopApi.dialog.pickRtlSources.mockReset()
  desktopApi.dialog.pickRtlSources.mockResolvedValue(null)
  desktopApi.workspace.scanRtlDirectory.mockReset()
  desktopApi.workspace.scanRtlDirectory.mockResolvedValue({
    files: [],
    rootPath: '',
  })
})

describe('NewProjectWizard interactions', () => {
  it('keeps Continue disabled until required project basics are valid', async () => {
    const wrapper = mountWizard()

    expect(getButton(wrapper, 'Continue').attributes('disabled')).toBeDefined()

    await wrapper.get('input[placeholder="e.g. my_chip_design"]').setValue('bad name')
    expect(wrapper.text()).toContain('Project name cannot contain spaces')

    await wrapper.get('input[placeholder="e.g. my_chip_design"]').setValue('chip_demo')
    await completeBasicInfo(wrapper)

    expect(getButton(wrapper, 'Continue').attributes('disabled')).toBeUndefined()
  })

  it('filters picked RTL sources and emits a create payload from the review step', async () => {
    desktopApi.dialog.pickRtlSources.mockResolvedValue({
      directories: [],
      files: ['/rtl/chip_top.sv', '/rtl/notes.txt'],
    })
    const wrapper = mountWizard()

    await goToDesignFiles(wrapper)
    await chooseBrowseAction(wrapper, 'Select RTL files')
    await fillDesignInputs(wrapper)

    expect(desktopApi.dialog.pickRtlSources).toHaveBeenCalledWith({
      multiple: false,
      title: 'Select RTL Design Files',
    })
    expect(wrapper.text()).toContain('chip_top.sv')
    expect(wrapper.text()).not.toContain('notes.txt')

    await getButton(wrapper, 'Continue').trigger('click')
    await flushPromises()

    expect(pdkManager.loadPdks).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Technology Setup')
    expect(wrapper.text()).toContain('ICS55 PDK')

    await getButton(wrapper, 'Continue').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Review & Create')

    await getButton(wrapper, 'Create Project').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('create')).toHaveLength(1)
    expect(wrapper.emitted('create')![0]![0]).toMatchObject({
      directory: '/workspace/chip_demo',
      pdk: 'ics55',
      pdk_root: '/pdks/ics55',
      parameters: {
        clock: 'clk_i',
        design: 'chip_demo',
        top_module: 'chip_top',
      },
      rtl_list: ['/rtl/chip_top.sv'],
    })
  })

  it('syncs scanned directory selections with the Design Files step validation', async () => {
    desktopApi.dialog.pickDirectory.mockResolvedValueOnce('/workspace/chip_demo')
    desktopApi.dialog.pickDirectory.mockResolvedValueOnce('/rtl')
    desktopApi.workspace.scanRtlDirectory.mockResolvedValue({
      rootPath: '/rtl',
      files: ['/rtl/core/top.sv', '/rtl/core/defs.vh'],
    })
    const wrapper = mountWizard()

    await goToDesignFiles(wrapper)
    await chooseBrowseAction(wrapper, 'Select design folder')
    await fillDesignInputs(wrapper)

    expect(desktopApi.workspace.scanRtlDirectory).toHaveBeenCalledWith('/rtl')
    expect(wrapper.text()).toContain('2 / 2 selected')
    expect(getButton(wrapper, 'Continue').attributes('disabled')).toBeUndefined()

    await wrapper.get('button[title="Remove all files"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('0 / 2 selected')
    expect(getButton(wrapper, 'Continue').attributes('disabled')).toBeDefined()
  })

  it('warns when the file picker returns a directory instead of RTL files', async () => {
    desktopApi.dialog.pickRtlSources.mockResolvedValue({
      directories: ['/rtl'],
      files: [],
    })
    const wrapper = mountWizard()

    await goToDesignFiles(wrapper)
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

  it('imports a PDK from the empty state and selects it for review', async () => {
    pdkManager.importedPdks.value = []
    pdkManager.importPdk.mockImplementation(async () => {
      pdkManager.importedPdks.value = [importedSky130Pdk]
      return importedSky130Pdk
    })
    const wrapper = mountWizard()

    await goToTechnologySetup(wrapper)

    expect(wrapper.text()).toContain('No PDK Imported')
    expect(getButton(wrapper, 'Continue').attributes('disabled')).toBeDefined()

    await getButton(wrapper, 'Select PDK Directory').trigger('click')
    await flushPromises()
    await wrapper.vm.$forceUpdate()
    await wrapper.vm.$nextTick()

    expect(pdkManager.importPdk).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Sky130 PDK')
    expect(getButton(wrapper, 'Continue').attributes('disabled')).toBeUndefined()

    await getButton(wrapper, 'Continue').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Review & Create')
    expect(wrapper.text()).toContain('Sky130 PDK')
  })

  it('removes an imported PDK from the technology step', async () => {
    pdkManager.importedPdks.value = [importedPdk, importedSky130Pdk]
    const wrapper = mountWizard()

    await goToTechnologySetup(wrapper)

    const removeButtons = wrapper.findAll('[title="Remove PDK"]')
    expect(removeButtons).toHaveLength(2)

    await removeButtons[1]!.trigger('click')
    await flushPromises()

    expect(pdkManager.removePdk).toHaveBeenCalledWith('pdk-sky130')
  })

  it('backs up from review and saves edited project basics back to review', async () => {
    const wrapper = mountWizard()

    await goToReview(wrapper)

    await getButton(wrapper, 'Back').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Technology Setup')

    await getButton(wrapper, 'Save & Return').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Review & Create')

    const editButtons = wrapper
      .findAll('button')
      .filter((button) => button.text().trim() === 'Edit')
    expect(editButtons).toHaveLength(2)

    await editButtons[0]!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Project Basics')

    await wrapper
      .get('input[placeholder="e.g. my_chip_design"]')
      .setValue('chip_revision')
    await getButton(wrapper, 'Save & Return').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Review & Create')
    expect(wrapper.text()).toContain('chip_revision')
  })
})
