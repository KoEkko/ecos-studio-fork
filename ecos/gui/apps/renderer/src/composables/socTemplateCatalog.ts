import { waitForDesktopApi } from '@/platform/desktop'
import { readRemoteJsonFile } from '@/services/remoteContentClient'
import { buildSocPreviewRects } from './socTemplatePreviewRenderer'
import {
  normalizeSocTemplateDetail,
  toSocTemplateSummary,
  type SocTemplateDetail,
  type SocTemplateSummary,
  type SocTemplateThumbnailLayout,
} from './socTemplateMapper'

const SOC_TEMPLATE_SOURCE = 'socTemplateCatalog' as const
const SOC_TEMPLATE_MANIFEST_PATH = 'manifest.json'
const SELECTED_CORE_SETTING_PREFIX = 'ecos.socTemplate.selectedCore.'

type RemoteSocTemplateIndexEntry = {
  id: string
  path: string
  sourceLabel: string
  detail: SocTemplateDetail
}

type SocTemplateManifest = {
  templates?: SocTemplateManifestTemplate[]
}

type SocTemplateManifestTemplate = {
  variants?: SocTemplateManifestVariant[]
}

type SocTemplateManifestVariant = {
  id?: unknown
  display_name?: unknown
  metadata?: unknown
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
  const manifest = await readRemoteJsonFile<SocTemplateManifest>({
    source: SOC_TEMPLATE_SOURCE,
    path: SOC_TEMPLATE_MANIFEST_PATH,
  })

  const variants = (manifest.templates ?? [])
    .flatMap(template => template.variants ?? [])
    .filter((variant): variant is SocTemplateManifestVariant & { id: string; metadata: string } =>
      typeof variant.id === 'string'
      && variant.id.length > 0
      && typeof variant.metadata === 'string'
      && variant.metadata.length > 0,
    )

  const entries = await Promise.all(variants.map(async (variant) => {
    const metadataPath = variant.metadata
    const sourceLabel = `remote:${SOC_TEMPLATE_SOURCE}/${metadataPath}`
    const raw = await readRemoteJsonFile<Record<string, unknown>>({
      source: SOC_TEMPLATE_SOURCE,
      path: metadataPath,
    })
    const detail = normalizeSocTemplateDetail(raw, sourceLabel)
    const displayName = typeof variant.display_name === 'string' && variant.display_name.length > 0
      ? variant.display_name
      : detail.name

    return {
      id: variant.id,
      path: metadataPath,
      sourceLabel,
      detail: {
        ...detail,
        id: variant.id,
        name: displayName,
      },
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
