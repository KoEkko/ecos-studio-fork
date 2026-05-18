import { waitForDesktopApi } from '@/platform/desktop'
import { listRemoteContentFiles, readRemoteJsonFile } from '@/services/remoteContentClient'
import { buildSocPreviewRects } from './socTemplatePreviewRenderer'
import {
  normalizeSocTemplateDetail,
  toSocTemplateSummary,
  type SocTemplateDetail,
  type SocTemplateSummary,
  type SocTemplateThumbnailLayout,
} from './socTemplateMapper'

const SOC_TEMPLATE_SOURCE = 'socTemplateCatalog' as const
const SOC_TEMPLATE_PATTERN = '**/*.json'
const SELECTED_CORE_SETTING_PREFIX = 'ecos.socTemplate.selectedCore.'

type RemoteSocTemplateIndexEntry = {
  id: string
  path: string
  sourceLabel: string
  detail: SocTemplateDetail
}

function thumbnailLayoutFromDetail(detail: SocTemplateDetail): SocTemplateThumbnailLayout | undefined {
  const { die, coreArea: c } = detail
  const dw = die.width
  const dh = die.height
  if (!dw || !dh) return undefined

  return {
    coreSlotLeftPct: ((c.llx - die.llx) / dw) * 100,
    coreSlotTopPct: ((die.ury - c.ury) / dh) * 100,
    coreSlotWidthPct: (c.width / dw) * 100,
    coreSlotHeightPct: (c.height / dh) * 100,
    cores: buildSocPreviewRects(detail).map(r => ({
      leftPct: r.leftPct,
      topPct: r.topPct,
      widthPct: r.widthPct,
      heightPct: r.heightPct,
    })),
  }
}

function catalogSummaryFromDetail(detail: SocTemplateDetail): SocTemplateSummary {
  return {
    ...toSocTemplateSummary(detail),
    thumbnail: thumbnailLayoutFromDetail(detail),
  }
}

function selectedCoreSettingKey(sourceLabel: string): string {
  return `${SELECTED_CORE_SETTING_PREFIX}${sourceLabel}`
}

function applySelectedCoreOverride(
  detail: SocTemplateDetail,
  selectedCoreId: number | null,
): SocTemplateDetail {
  if (selectedCoreId == null) return detail

  return {
    ...detail,
    cores: detail.cores.map(core => ({
      ...core,
      selected: core.id === selectedCoreId ? 1 : 0,
    })),
  }
}

async function loadRemoteSocTemplateIndex(): Promise<RemoteSocTemplateIndexEntry[]> {
  const files = await listRemoteContentFiles({
    source: SOC_TEMPLATE_SOURCE,
    pattern: SOC_TEMPLATE_PATTERN,
    maxFiles: 200,
  })

  const entries = await Promise.all(files.map(async (file) => {
    const sourceLabel = `remote:${file.source}/${file.path}`
    const raw = await readRemoteJsonFile<Record<string, unknown>>({
      source: file.source,
      path: file.path,
    })
    const detail = normalizeSocTemplateDetail(raw, sourceLabel)

    return {
      id: detail.id,
      path: file.path,
      sourceLabel,
      detail,
    }
  }))

  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new Error(`Duplicate SoC template id from remote catalog: ${entry.id}`)
    }
    seen.add(entry.id)
  }

  return entries
}

export async function loadSocTemplateCatalog(): Promise<SocTemplateSummary[]> {
  const entries = await loadRemoteSocTemplateIndex()
  return entries.map((entry) => catalogSummaryFromDetail(entry.detail))
}

export async function loadSocTemplateDetail(templateId: string): Promise<SocTemplateDetail> {
  const entries = await loadRemoteSocTemplateIndex()
  const entry = entries.find((row) => row.id === templateId)
  if (!entry) {
    throw new Error(`Unknown SoC template: ${templateId}`)
  }

  const api = await waitForDesktopApi()
  const selectedCoreId = await api.settings.get<number>(selectedCoreSettingKey(entry.sourceLabel))
  return applySelectedCoreOverride(entry.detail, selectedCoreId)
}

export async function selectSocTemplateCore(
  templateId: string,
  coreId: number,
): Promise<SocTemplateDetail> {
  const entries = await loadRemoteSocTemplateIndex()
  const entry = entries.find((row) => row.id === templateId)
  if (!entry) {
    throw new Error(`Unknown SoC template: ${templateId}`)
  }
  if (!entry.detail.cores.some(core => core.id === coreId)) {
    throw new Error(`Unknown SoC core: ${coreId}`)
  }

  const api = await waitForDesktopApi()
  await api.settings.set(selectedCoreSettingKey(entry.sourceLabel), coreId)
  return applySelectedCoreOverride(entry.detail, coreId)
}
