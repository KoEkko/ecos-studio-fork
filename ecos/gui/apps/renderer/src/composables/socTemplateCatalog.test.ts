import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadSocTemplateCatalog,
  loadSocTemplateDetail,
  selectSocTemplateCore,
} from './socTemplateCatalog'

vi.mock('@/services/remoteContentClient', () => ({
  listRemoteContentFiles: vi.fn(),
  readRemoteJsonFile: vi.fn(),
}))

vi.mock('@/platform/desktop', () => ({
  waitForDesktopApi: vi.fn(),
}))

const { listRemoteContentFiles, readRemoteJsonFile } = await import('@/services/remoteContentClient')
const { waitForDesktopApi } = await import('@/platform/desktop')

const remoteJson = {
  design_name: 'ysyxSoCASIC',
  dbu: 1000,
  die: { llx: 0, lly: 0, urx: 100, ury: 100, width: 100, height: 100, area: 10000 },
  core: { llx: 10, lly: 10, urx: 90, ury: 90, width: 80, height: 80, area: 6400 },
  io_pins: { number: 0, list: [] },
  cores: {
    selected_core_id: 2,
    number: 2,
    list: [
      { core_id: 2, name: 'core2', info: '', io_align: 'left', orient: 'N', bounding_box: { llx: 10, lly: 10, urx: 30, ury: 30, width: 20, height: 20, area: 400 } },
      { core_id: 3, name: 'core3', info: '', io_align: 'right', orient: 'N', bounding_box: { llx: 40, lly: 40, urx: 60, ury: 60, width: 20, height: 20, area: 400 } },
    ],
  },
}

describe('socTemplateCatalog remote source', () => {
  const settings = new Map<string, unknown>()

  beforeEach(() => {
    settings.clear()
    vi.mocked(listRemoteContentFiles).mockReset()
    vi.mocked(readRemoteJsonFile).mockReset()
    vi.mocked(waitForDesktopApi).mockResolvedValue({
      settings: {
        get: vi.fn(async (key: string) => settings.get(key) ?? null),
        set: vi.fn(async (key: string, value: unknown) => {
          settings.set(key, value)
        }),
        delete: vi.fn(async (key: string) => {
          settings.delete(key)
        }),
      },
    } as never)
  })

  it('loads SoC summaries from the built-in remote content source', async () => {
    vi.mocked(listRemoteContentFiles).mockResolvedValue([
      { source: 'socTemplateCatalog', path: 'ysyxSoCASIC.json', name: 'ysyxSoCASIC.json' },
    ])
    vi.mocked(readRemoteJsonFile).mockResolvedValue(remoteJson)

    const items = await loadSocTemplateCatalog()

    expect(listRemoteContentFiles).toHaveBeenCalledWith({
      source: 'socTemplateCatalog',
      pattern: '**/*.json',
      maxFiles: 200,
    })
    expect(items[0]).toMatchObject({
      id: 'ysyxSoCASIC',
      name: 'ysyxSoCASIC',
      sourceLabel: 'remote:socTemplateCatalog/ysyxSoCASIC.json',
    })
    expect(items[0]?.thumbnail).toBeDefined()
  })

  it('loads detail by template id and applies locally persisted selected core', async () => {
    vi.mocked(listRemoteContentFiles).mockResolvedValue([
      { source: 'socTemplateCatalog', path: 'ysyxSoCASIC.json', name: 'ysyxSoCASIC.json' },
    ])
    vi.mocked(readRemoteJsonFile).mockResolvedValue(remoteJson)
    settings.set('ecos.socTemplate.selectedCore.remote:socTemplateCatalog/ysyxSoCASIC.json', 3)

    const detail = await loadSocTemplateDetail('ysyxSoCASIC')

    expect(detail.cores.map(core => ({ id: core.id, selected: core.selected }))).toEqual([
      { id: 2, selected: 0 },
      { id: 3, selected: 1 },
    ])
  })

  it('persists selected core locally instead of writing remote JSON', async () => {
    vi.mocked(listRemoteContentFiles).mockResolvedValue([
      { source: 'socTemplateCatalog', path: 'ysyxSoCASIC.json', name: 'ysyxSoCASIC.json' },
    ])
    vi.mocked(readRemoteJsonFile).mockResolvedValue(remoteJson)

    const detail = await selectSocTemplateCore('ysyxSoCASIC', 3)

    expect(settings.get('ecos.socTemplate.selectedCore.remote:socTemplateCatalog/ysyxSoCASIC.json')).toBe(3)
    expect(detail.cores.find(core => core.id === 3)?.selected).toBe(1)
  })

  it('rejects unknown template ids from the remote index', async () => {
    vi.mocked(listRemoteContentFiles).mockResolvedValue([
      { source: 'socTemplateCatalog', path: 'ysyxSoCASIC.json', name: 'ysyxSoCASIC.json' },
    ])
    vi.mocked(readRemoteJsonFile).mockResolvedValue(remoteJson)

    await expect(loadSocTemplateDetail('missing-id')).rejects.toThrow('Unknown SoC template: missing-id')
  })
})
