import type {
  RemoteContentFile,
  RemoteContentListFilesRequest,
  RemoteContentReadJsonFileRequest,
  RemoteContentReadTextFileRequest,
  RemoteContentSourceId,
} from '@ecos-studio/shared'
import { remoteContentSources, type RemoteContentSourceConfig } from './remoteContentSources'

type FetchLike = typeof fetch

interface GitHubTreeEntry {
  path?: string
  type?: string
  size?: number
  sha?: string
}

interface GitHubTreeResponse {
  tree?: GitHubTreeEntry[]
  truncated?: boolean
}

export interface RemoteContentServiceOptions {
  fetchImpl?: FetchLike
  sources?: Record<RemoteContentSourceId, RemoteContentSourceConfig>
}

export class RemoteContentService {
  private readonly fetchImpl: FetchLike
  private readonly sources: Record<RemoteContentSourceId, RemoteContentSourceConfig>

  constructor(options: RemoteContentServiceOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.sources = options.sources ?? remoteContentSources
  }

  async listFiles(request: RemoteContentListFilesRequest): Promise<RemoteContentFile[]> {
    const source = this.getSource(request.source)
    const url = `https://api.github.com/repos/${source.owner}/${source.repo}/git/trees/${encodeURIComponent(source.ref)}?recursive=1`
    const response = await this.fetchGitHub(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    const body = await response.json() as GitHubTreeResponse

    if (body.truncated) {
      throw new Error(`GitHub tree response for ${request.source} is truncated.`)
    }

    const maxFiles = request.maxFiles ?? 500
    const pattern = request.pattern ?? '**/*'
    return (body.tree ?? [])
      .filter((entry) => entry.type === 'blob' && typeof entry.path === 'string')
      .map((entry) => ({
        entry,
        relativePath: this.toRelativeSourcePath(source, entry.path!),
      }))
      .filter((row): row is { entry: GitHubTreeEntry; relativePath: string } => row.relativePath !== null)
      .filter((row) => matchesRemotePattern(row.relativePath, pattern))
      .slice(0, maxFiles)
      .map(({ entry, relativePath }) => ({
        source: request.source,
        path: relativePath,
        name: relativePath.split('/').pop() ?? relativePath,
        size: entry.size,
        sha: entry.sha,
      }))
      .sort((a, b) => a.path.localeCompare(b.path))
  }

  async readTextFile(request: RemoteContentReadTextFileRequest): Promise<string> {
    const source = this.getSource(request.source)
    const repositoryPath = this.resolveRepositoryPath(source, request.path)
    const url = `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${encodePath(repositoryPath)}?ref=${encodeURIComponent(source.ref)}`
    const response = await this.fetchGitHub(url, {
      headers: {
        Accept: 'application/vnd.github.raw+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    return await response.text()
  }

  async readJsonFile<T = unknown>(request: RemoteContentReadJsonFileRequest): Promise<T> {
    const text = await this.readTextFile(request)
    try {
      return JSON.parse(text) as T
    } catch {
      throw new Error(`Remote JSON is invalid: ${request.source}/${request.path}`)
    }
  }

  private getSource(sourceId: RemoteContentSourceId): RemoteContentSourceConfig {
    const source = this.sources[sourceId]
    if (!source) {
      throw new Error(`Unknown remote content source: ${sourceId}`)
    }
    return source
  }

  private async fetchGitHub(url: string, init: RequestInit): Promise<Response> {
    const response = await this.fetchImpl(url, init)
    if (!response.ok) {
      throw new Error(`GitHub request failed with ${response.status}: ${url}`)
    }
    return response
  }

  private toRelativeSourcePath(
    source: RemoteContentSourceConfig,
    repositoryPath: string,
  ): string | null {
    const root = normalizeRemotePath(source.rootPath)
    const path = normalizeRemotePath(repositoryPath)
    if (path === root) return ''
    const prefix = `${root}/`
    return path.startsWith(prefix) ? path.slice(prefix.length) : null
  }

  private resolveRepositoryPath(source: RemoteContentSourceConfig, relativePath: string): string {
    const normalizedRelativePath = normalizeRelativeRemotePath(relativePath)
    return `${normalizeRemotePath(source.rootPath)}/${normalizedRelativePath}`
  }
}

function normalizeRemotePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function normalizeRelativeRemotePath(path: string): string {
  const normalized = normalizeRemotePath(path)
  if (!normalized || normalized.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error('Remote content path must be relative to its source root.')
  }
  return normalized
}

function encodePath(path: string): string {
  return normalizeRemotePath(path).split('/').map(encodeURIComponent).join('%2F')
}

export function matchesRemotePattern(path: string, pattern: string): boolean {
  const normalizedPath = normalizeRemotePath(path)
  const normalizedPattern = normalizeRemotePath(pattern)
  if (normalizedPattern === '**/*') return true
  if (normalizedPattern.startsWith('**/*.')) {
    return normalizedPath.endsWith(normalizedPattern.slice(4))
  }
  if (normalizedPattern.startsWith('*.')) {
    return !normalizedPath.includes('/') && normalizedPath.endsWith(normalizedPattern.slice(1))
  }
  return normalizedPath === normalizedPattern
}
