import type { RemoteContentSourceId } from '@ecos-studio/shared'

export interface RemoteContentSourceConfig {
  provider: 'github'
  owner: string
  repo: string
  ref: string
  rootPath: string
}

export const remoteContentSources: Record<RemoteContentSourceId, RemoteContentSourceConfig> = {
  socTemplateCatalog: {
    provider: 'github',
    owner: 'openecos-projects',
    repo: 'soc-templates',
    ref: 'main',
    rootPath: '',
  },
}
