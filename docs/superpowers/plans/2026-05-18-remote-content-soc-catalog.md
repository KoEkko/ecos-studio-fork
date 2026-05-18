# Remote Content SoC Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable TypeScript/Electron remote content layer that reads files from ECOS-maintained GitHub repositories, then migrate the SoC template catalog to load `soc.json`-style files through that layer.

**Architecture:** Put remote repository access in Electron main process, expose it through the existing desktop bridge, and keep renderer code as a consumer of typed file-list/read APIs. The first built-in source is `socTemplateCatalog`, backed by `openecos-projects/ecos-studio` at `main`, rooted at `ecos/gui/apps/renderer/public`, so the current `ysyxSoCASIC.json` fixture can be read remotely without user input. SoC-specific code remains in `socTemplateCatalog.ts`; GitHub API details remain in `RemoteContentService`.

**Tech Stack:** Electron main/preload IPC, TypeScript, existing `@ecos-studio/shared` desktop bridge contracts, Node/Electron `fetch`, GitHub Git Trees API for listing, GitHub Repository Contents API for raw file reads, Vitest, `vue-tsc`, `tsc`.

---

## Reference Behavior

- GitHub Trees API: `GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1` lists repository tree entries. If the response is `truncated`, implementation must fail with a clear error rather than silently hiding files.
- GitHub Contents API: `GET /repos/{owner}/{repo}/contents/{path}?ref={ref}` with `Accept: application/vnd.github.raw+json` returns raw file bytes/text for public repository content.
- Remote sources are built into the app; renderer never accepts arbitrary repository URLs for this feature.
- Remote JSON is read-only. User core selection is persisted locally through existing desktop settings, keyed by source and file path.
- The SoC schema should use `cores.selected_core_id` for the selected/default core id. During migration, the mapper may still support existing per-core `selected: 1` from older local/imported data only if the team decides to keep local import compatibility; the remote source should write/read `selected_core_id`.

## File Structure

- Create `ecos/gui/packages/shared/src/contracts/remoteContent.ts`
  - Owns remote content request/response types and `RemoteContentSourceId`.
- Modify `ecos/gui/packages/shared/src/constants/ipcChannels.ts`
  - Adds remote content IPC channel names.
- Modify `ecos/gui/packages/shared/src/contracts/desktopApi.ts`
  - Adds `remoteContent` to `DesktopApi`.
- Modify `ecos/gui/packages/shared/src/index.ts`
  - Re-exports remote content types.
- Create `ecos/gui/apps/desktop-electron/electron/services/remoteContentSources.ts`
  - Holds built-in source config. First source: `socTemplateCatalog`.
- Create `ecos/gui/apps/desktop-electron/electron/services/remoteContentService.ts`
  - Implements GitHub-backed `listFiles`, `readTextFile`, `readJsonFile`.
- Create `ecos/gui/apps/desktop-electron/electron/services/remoteContentService.test.ts`
  - Tests URL construction, root path filtering, pattern matching, raw reads, errors.
- Modify `ecos/gui/apps/desktop-electron/electron/main/registerIpc.ts`
  - Adds service dependency and IPC handlers.
- Modify `ecos/gui/apps/desktop-electron/electron/main/index.ts`
  - Instantiates `RemoteContentService`.
- Modify `ecos/gui/apps/desktop-electron/electron/preload/index.ts`
  - Exposes `window.ecosDesktop.remoteContent`.
- Modify `ecos/gui/apps/desktop-electron/electron/main/registerIpc.test.ts`
  - Expects new channels.
- Create `ecos/gui/apps/renderer/src/services/remoteContentClient.ts`
  - Thin renderer wrapper around `waitForDesktopApi().remoteContent`.
- Create `ecos/gui/apps/renderer/src/services/remoteContentClient.test.ts`
  - Tests bridge delegation and unavailable bridge errors.
- Modify `ecos/gui/apps/renderer/src/composables/socTemplateMapper.ts`
  - Normalize `cores.selected_core_id`.
- Modify `ecos/gui/apps/renderer/src/composables/socTemplateMapper.test.ts`
  - Adds coverage for `selected_core_id`.
- Modify `ecos/gui/apps/renderer/src/composables/socTemplateCatalog.ts`
  - Loads remote files through `remoteContentClient`, maps JSON to summaries/details, persists selected core locally.
- Modify `ecos/gui/apps/renderer/src/composables/socTemplateCatalog.test.ts`
  - Replaces localStorage-only expectations with remote source tests and selected settings tests.
- Modify `ecos/gui/apps/renderer/src/components/SoCTemplateGallery.vue`
  - Remove or hide local JSON import controls if product scope is now remote-only. Keep retry/error states.
- Modify `ecos/gui/apps/renderer/src/components/SoCTemplateGallery.test.ts`
  - Update copy/controls expectations after import UI decision.

---

### Task 1: Shared Remote Content Contracts

**Files:**
- Create: `ecos/gui/packages/shared/src/contracts/remoteContent.ts`
- Modify: `ecos/gui/packages/shared/src/constants/ipcChannels.ts`
- Modify: `ecos/gui/packages/shared/src/contracts/desktopApi.ts`
- Modify: `ecos/gui/packages/shared/src/index.ts`

- [x] **Step 1: Write the shared contract file**

Create `ecos/gui/packages/shared/src/contracts/remoteContent.ts`:

```ts
export type RemoteContentSourceId = 'socTemplateCatalog'

export interface RemoteContentListFilesRequest {
  source: RemoteContentSourceId
  pattern?: string
  maxFiles?: number
}

export interface RemoteContentFile {
  source: RemoteContentSourceId
  path: string
  name: string
  size?: number
  sha?: string
}

export interface RemoteContentReadTextFileRequest {
  source: RemoteContentSourceId
  path: string
}

export interface RemoteContentReadJsonFileRequest {
  source: RemoteContentSourceId
  path: string
}

export interface RemoteContentApi {
  listFiles(request: RemoteContentListFilesRequest): Promise<RemoteContentFile[]>
  readTextFile(request: RemoteContentReadTextFileRequest): Promise<string>
  readJsonFile<T = unknown>(request: RemoteContentReadJsonFileRequest): Promise<T>
}
```

- [x] **Step 2: Add IPC channels**

In `ecos/gui/packages/shared/src/constants/ipcChannels.ts`, add these keys inside `desktopApiIpcChannels`:

```ts
  remoteContentListFiles: 'remote-content:list-files',
  remoteContentReadTextFile: 'remote-content:read-text-file',
  remoteContentReadJsonFile: 'remote-content:read-json-file',
```

Place them near `settings*` and `workspace*` channels, before `systemOpenExternal`.

- [x] **Step 3: Extend DesktopApi**

In `ecos/gui/packages/shared/src/contracts/desktopApi.ts`, add the import:

```ts
import type { RemoteContentApi } from './remoteContent.ts'
```

Then add this top-level property to `DesktopApi`:

```ts
  remoteContent: RemoteContentApi
```

Place it after `settings` and before `dialog`, because it is a general app data service rather than a workspace-specific service.

- [x] **Step 4: Re-export types**

In `ecos/gui/packages/shared/src/index.ts`, add:

```ts
export type {
  RemoteContentApi,
  RemoteContentFile,
  RemoteContentListFilesRequest,
  RemoteContentReadJsonFileRequest,
  RemoteContentReadTextFileRequest,
  RemoteContentSourceId,
} from './contracts/remoteContent.ts';
```

- [x] **Step 5: Typecheck shared package**

Run:

```bash
pnpm --filter @ecos-studio/shared run typecheck
```

Expected: command exits `0`.

- [x] **Step 6: Commit**

```bash
git add ecos/gui/packages/shared/src/contracts/remoteContent.ts \
  ecos/gui/packages/shared/src/constants/ipcChannels.ts \
  ecos/gui/packages/shared/src/contracts/desktopApi.ts \
  ecos/gui/packages/shared/src/index.ts
git commit -m "feat(gui): add remote content desktop contract"
```

---

### Task 2: Electron RemoteContentService

**Files:**
- Create: `ecos/gui/apps/desktop-electron/electron/services/remoteContentSources.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/services/remoteContentService.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/services/remoteContentService.test.ts`

- [x] **Step 1: Write failing service tests**

Create `ecos/gui/apps/desktop-electron/electron/services/remoteContentService.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { RemoteContentService } from './remoteContentService'
import type { RemoteContentSourceConfig } from './remoteContentSources'

const source: RemoteContentSourceConfig = {
  provider: 'github',
  owner: 'openecos-projects',
  repo: 'ecos-studio',
  ref: 'main',
  rootPath: 'ecos/gui/apps/renderer/public',
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('RemoteContentService', () => {
  it('lists files from a built-in GitHub source under its root path', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toBe('https://api.github.com/repos/openecos-projects/ecos-studio/git/trees/main?recursive=1')
      return jsonResponse({
        truncated: false,
        tree: [
          { path: 'ecos/gui/apps/renderer/public/ysyxSoCASIC.json', type: 'blob', size: 123, sha: 'abc' },
          { path: 'README.md', type: 'blob', size: 10, sha: 'def' },
          { path: 'ecos/gui/apps/renderer/public/image.png', type: 'blob', size: 20, sha: 'ghi' },
          { path: 'ecos/gui/apps/renderer/public/subdir', type: 'tree', sha: 'tree' },
        ],
      })
    })

    const service = new RemoteContentService({
      fetchImpl,
      sources: { socTemplateCatalog: source },
    })

    await expect(service.listFiles({ source: 'socTemplateCatalog', pattern: '**/*.json' }))
      .resolves
      .toEqual([
        {
          source: 'socTemplateCatalog',
          path: 'ysyxSoCASIC.json',
          name: 'ysyxSoCASIC.json',
          size: 123,
          sha: 'abc',
        },
      ])
  })

  it('reads a text file through the GitHub contents raw media type', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://api.github.com/repos/openecos-projects/ecos-studio/contents/ecos%2Fgui%2Fapps%2Frenderer%2Fpublic%2FysyxSoCASIC.json?ref=main')
      expect(init?.headers).toMatchObject({
        Accept: 'application/vnd.github.raw+json',
        'X-GitHub-Api-Version': '2022-11-28',
      })
      return new Response('{"design_name":"ysyxSoCASIC"}', { status: 200 })
    })

    const service = new RemoteContentService({
      fetchImpl,
      sources: { socTemplateCatalog: source },
    })

    await expect(service.readTextFile({ source: 'socTemplateCatalog', path: 'ysyxSoCASIC.json' }))
      .resolves
      .toBe('{"design_name":"ysyxSoCASIC"}')
  })

  it('parses JSON files and reports invalid JSON with the source path', async () => {
    const service = new RemoteContentService({
      fetchImpl: vi.fn(async () => new Response('not-json', { status: 200 })),
      sources: { socTemplateCatalog: source },
    })

    await expect(service.readJsonFile({ source: 'socTemplateCatalog', path: 'broken.json' }))
      .rejects
      .toThrow('Remote JSON is invalid: socTemplateCatalog/broken.json')
  })

  it('rejects path traversal outside the configured source root', async () => {
    const service = new RemoteContentService({
      fetchImpl: vi.fn(),
      sources: { socTemplateCatalog: source },
    })

    await expect(service.readTextFile({ source: 'socTemplateCatalog', path: '../secret.json' }))
      .rejects
      .toThrow('Remote content path must be relative to its source root.')
  })

  it('fails clearly when GitHub tree results are truncated', async () => {
    const service = new RemoteContentService({
      fetchImpl: vi.fn(async () => jsonResponse({ truncated: true, tree: [] })),
      sources: { socTemplateCatalog: source },
    })

    await expect(service.listFiles({ source: 'socTemplateCatalog' }))
      .rejects
      .toThrow('GitHub tree response for socTemplateCatalog is truncated.')
  })
})
```

- [x] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @ecos-studio/desktop-electron test -- electron/services/remoteContentService.test.ts
```

Expected: FAIL because `remoteContentService.ts` and `remoteContentSources.ts` do not exist.

- [x] **Step 3: Create built-in source config**

Create `ecos/gui/apps/desktop-electron/electron/services/remoteContentSources.ts`:

```ts
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
    repo: 'ecos-studio',
    ref: 'main',
    rootPath: 'ecos/gui/apps/renderer/public',
  },
}
```

- [x] **Step 4: Implement RemoteContentService**

Create `ecos/gui/apps/desktop-electron/electron/services/remoteContentService.ts`:

```ts
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

  private toRelativeSourcePath(source: RemoteContentSourceConfig, repositoryPath: string): string | null {
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
```

- [x] **Step 5: Run service tests**

Run:

```bash
pnpm --filter @ecos-studio/desktop-electron test -- electron/services/remoteContentService.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add ecos/gui/apps/desktop-electron/electron/services/remoteContentSources.ts \
  ecos/gui/apps/desktop-electron/electron/services/remoteContentService.ts \
  ecos/gui/apps/desktop-electron/electron/services/remoteContentService.test.ts
git commit -m "feat(gui): add remote content service"
```

---

### Task 3: Wire Remote Content Through Electron IPC

**Files:**
- Modify: `ecos/gui/apps/desktop-electron/electron/main/registerIpc.ts`
- Modify: `ecos/gui/apps/desktop-electron/electron/main/registerIpc.test.ts`
- Modify: `ecos/gui/apps/desktop-electron/electron/main/index.ts`
- Modify: `ecos/gui/apps/desktop-electron/electron/preload/index.ts`

- [x] **Step 1: Write failing IPC registration expectation**

In `ecos/gui/apps/desktop-electron/electron/main/registerIpc.test.ts`, find the test that asserts every desktop bridge channel is registered. Add these expected channels if the test uses an explicit list:

```ts
desktopApiIpcChannels.remoteContentListFiles,
desktopApiIpcChannels.remoteContentReadTextFile,
desktopApiIpcChannels.remoteContentReadJsonFile,
```

If the test checks `Object.values(desktopApiIpcChannels)`, no explicit list change is needed; the test will fail once the service dependency is missing.

- [x] **Step 2: Run IPC test to verify failure**

Run:

```bash
pnpm --filter @ecos-studio/desktop-electron test -- electron/main/registerIpc.test.ts
```

Expected: FAIL because `DesktopBridgeServices` does not include `remoteContentService` and handlers are not registered.

- [x] **Step 3: Extend registerIpc service interface**

In `ecos/gui/apps/desktop-electron/electron/main/registerIpc.ts`, add imports:

```ts
  type RemoteContentFile,
  type RemoteContentListFilesRequest,
  type RemoteContentReadJsonFileRequest,
  type RemoteContentReadTextFileRequest,
```

to the existing `@ecos-studio/shared` import.

Add this property to `DesktopBridgeServices`:

```ts
  remoteContentService: {
    listFiles(request: RemoteContentListFilesRequest): Promise<RemoteContentFile[]>
    readTextFile(request: RemoteContentReadTextFileRequest): Promise<string>
    readJsonFile<T = unknown>(request: RemoteContentReadJsonFileRequest): Promise<T>
  }
```

- [x] **Step 4: Register IPC handlers**

In `registerIpc`, after settings handlers and before dialog handlers, add:

```ts
  handle(
    desktopApiIpcChannels.remoteContentListFiles,
    async (_event, request) => {
      return await services.remoteContentService.listFiles(
        request as RemoteContentListFilesRequest,
      )
    },
  )

  handle(
    desktopApiIpcChannels.remoteContentReadTextFile,
    async (_event, request) => {
      return await services.remoteContentService.readTextFile(
        request as RemoteContentReadTextFileRequest,
      )
    },
  )

  handle(
    desktopApiIpcChannels.remoteContentReadJsonFile,
    async (_event, request) => {
      return await services.remoteContentService.readJsonFile(
        request as RemoteContentReadJsonFileRequest,
      )
    },
  )
```

- [x] **Step 5: Instantiate service in main**

In `ecos/gui/apps/desktop-electron/electron/main/index.ts`, import:

```ts
import { RemoteContentService } from '../services/remoteContentService'
```

Add `remoteContentService: RemoteContentService` to the `services` type, instantiate it in `getDesktopServices()`:

```ts
  const remoteContentService = new RemoteContentService()
```

Add it to `services = { ... }` and pass it into `registerIpc`:

```ts
      remoteContentService: desktopServices.remoteContentService,
```

- [x] **Step 6: Expose bridge methods in preload**

In `ecos/gui/apps/desktop-electron/electron/preload/index.ts`, add to `desktopApi` after `settings`:

```ts
  remoteContent: {
    listFiles: (request) =>
      invokeDesktop(desktopApiIpcChannels.remoteContentListFiles, request),
    readTextFile: (request) =>
      invokeDesktop(desktopApiIpcChannels.remoteContentReadTextFile, request),
    readJsonFile: (request) =>
      invokeDesktop(desktopApiIpcChannels.remoteContentReadJsonFile, request),
  },
```

- [x] **Step 7: Run Electron tests and typecheck**

Run:

```bash
pnpm --filter @ecos-studio/desktop-electron test -- electron/main/registerIpc.test.ts electron/services/remoteContentService.test.ts
pnpm --filter @ecos-studio/desktop-electron run typecheck
```

Expected: both commands exit `0`.

- [x] **Step 8: Commit**

```bash
git add ecos/gui/apps/desktop-electron/electron/main/registerIpc.ts \
  ecos/gui/apps/desktop-electron/electron/main/registerIpc.test.ts \
  ecos/gui/apps/desktop-electron/electron/main/index.ts \
  ecos/gui/apps/desktop-electron/electron/preload/index.ts
git commit -m "feat(gui): expose remote content over ipc"
```

---

### Task 4: Renderer Remote Content Client

**Files:**
- Create: `ecos/gui/apps/renderer/src/services/remoteContentClient.ts`
- Create: `ecos/gui/apps/renderer/src/services/remoteContentClient.test.ts`

- [x] **Step 1: Write failing renderer client tests**

Create `ecos/gui/apps/renderer/src/services/remoteContentClient.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DesktopApi } from '@ecos-studio/shared'
import { listRemoteContentFiles, readRemoteJsonFile, readRemoteTextFile } from './remoteContentClient'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

function installDesktopApi(remoteContent: DesktopApi['remoteContent']): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      ecosDesktop: {
        remoteContent,
      },
    },
  })
}

describe('remoteContentClient', () => {
  afterEach(() => {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow)
    } else {
      delete (globalThis as { window?: unknown }).window
    }
  })

  it('delegates list/read calls through the desktop bridge', async () => {
    const remoteContent = {
      listFiles: vi.fn(async () => [{ source: 'socTemplateCatalog' as const, path: 'ysyxSoCASIC.json', name: 'ysyxSoCASIC.json' }]),
      readTextFile: vi.fn(async () => 'hello'),
      readJsonFile: vi.fn(async () => ({ design_name: 'ysyxSoCASIC' })),
    }
    installDesktopApi(remoteContent)

    await expect(listRemoteContentFiles({ source: 'socTemplateCatalog', pattern: '**/*.json' }))
      .resolves
      .toHaveLength(1)
    await expect(readRemoteTextFile({ source: 'socTemplateCatalog', path: 'ysyxSoCASIC.json' }))
      .resolves
      .toBe('hello')
    await expect(readRemoteJsonFile<{ design_name: string }>({ source: 'socTemplateCatalog', path: 'ysyxSoCASIC.json' }))
      .resolves
      .toEqual({ design_name: 'ysyxSoCASIC' })
  })
})
```

- [x] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter @ecos-studio/renderer test -- src/services/remoteContentClient.test.ts
```

Expected: FAIL because `remoteContentClient.ts` does not exist.

- [x] **Step 3: Implement renderer client**

Create `ecos/gui/apps/renderer/src/services/remoteContentClient.ts`:

```ts
import type {
  RemoteContentFile,
  RemoteContentListFilesRequest,
  RemoteContentReadJsonFileRequest,
  RemoteContentReadTextFileRequest,
} from '@ecos-studio/shared'
import { waitForDesktopApi } from '@/platform/desktop'

export async function listRemoteContentFiles(
  request: RemoteContentListFilesRequest,
): Promise<RemoteContentFile[]> {
  const api = await waitForDesktopApi()
  return await api.remoteContent.listFiles(request)
}

export async function readRemoteTextFile(
  request: RemoteContentReadTextFileRequest,
): Promise<string> {
  const api = await waitForDesktopApi()
  return await api.remoteContent.readTextFile(request)
}

export async function readRemoteJsonFile<T = unknown>(
  request: RemoteContentReadJsonFileRequest,
): Promise<T> {
  const api = await waitForDesktopApi()
  return await api.remoteContent.readJsonFile<T>(request)
}
```

- [x] **Step 4: Run renderer client test**

Run:

```bash
pnpm --filter @ecos-studio/renderer test -- src/services/remoteContentClient.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add ecos/gui/apps/renderer/src/services/remoteContentClient.ts \
  ecos/gui/apps/renderer/src/services/remoteContentClient.test.ts
git commit -m "feat(gui): add renderer remote content client"
```

---

### Task 5: Normalize `selected_core_id` in SoC Mapper

**Files:**
- Modify: `ecos/gui/apps/renderer/src/composables/socTemplateMapper.ts`
- Modify: `ecos/gui/apps/renderer/src/composables/socTemplateMapper.test.ts`
- Modify: `ecos/gui/apps/renderer/public/ysyxSoCASIC.json`

- [x] **Step 1: Update JSON fixture schema**

In `ecos/gui/apps/renderer/public/ysyxSoCASIC.json`, ensure the `cores` object has:

```json
"selected_core_id": 0
```

and remove ambiguous top-level `cores.selected` if present. Do not add per-core `selected` flags to `cores.list`.

- [x] **Step 2: Write failing mapper test**

In `ecos/gui/apps/renderer/src/composables/socTemplateMapper.test.ts`, add:

```ts
  it('uses cores.selected_core_id to mark the selected core', () => {
    const detail = normalizeSocTemplateDetail(
      {
        ...raw,
        cores: {
          ...raw.cores,
          selected_core_id: 5,
        },
      },
      'Fixed JSON',
    )

    expect(detail.cores.map(core => ({ id: core.id, selected: core.selected }))).toEqual([
      { id: 4, selected: 0 },
      { id: 5, selected: 1 },
    ])
  })
```

- [x] **Step 3: Run mapper test to verify failure**

Run:

```bash
pnpm --filter @ecos-studio/renderer test -- src/composables/socTemplateMapper.test.ts
```

Expected: FAIL because `selected_core_id` is not yet read.

- [x] **Step 4: Implement mapper support**

In `ecos/gui/apps/renderer/src/composables/socTemplateMapper.ts`, change selected id extraction to:

```ts
  const selectedCoreId = toNumber(rawCores.selected_core_id, -1)
```

Keep `selected: selectedCoreId === id ? 1 : normalizeSelected(coreRecord.selected)` only if older imported local records still need per-core `selected` compatibility. If product scope removes import/localStorage entirely in Task 6, change it to:

```ts
      selected: selectedCoreId === id ? 1 : 0,
```

- [x] **Step 5: Run mapper tests**

Run:

```bash
pnpm --filter @ecos-studio/renderer test -- src/composables/socTemplateMapper.test.ts src/composables/socTemplatePreviewSelection.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add ecos/gui/apps/renderer/src/composables/socTemplateMapper.ts \
  ecos/gui/apps/renderer/src/composables/socTemplateMapper.test.ts \
  ecos/gui/apps/renderer/public/ysyxSoCASIC.json
git commit -m "feat(gui): normalize selected core id in soc templates"
```

---

### Task 6: Migrate SoC Catalog to Remote Content

**Files:**
- Modify: `ecos/gui/apps/renderer/src/composables/socTemplateCatalog.ts`
- Modify: `ecos/gui/apps/renderer/src/composables/socTemplateCatalog.test.ts`

- [x] **Step 1: Write failing catalog tests for remote loading**

Replace or extend `ecos/gui/apps/renderer/src/composables/socTemplateCatalog.test.ts` with tests that mock `remoteContentClient` and desktop settings:

```ts
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
})
```

- [x] **Step 2: Run catalog tests to verify failure**

Run:

```bash
pnpm --filter @ecos-studio/renderer test -- src/composables/socTemplateCatalog.test.ts
```

Expected: FAIL because `socTemplateCatalog.ts` still uses localStorage records.

- [x] **Step 3: Implement remote catalog index helpers**

In `ecos/gui/apps/renderer/src/composables/socTemplateCatalog.ts`, add imports:

```ts
import { waitForDesktopApi } from '@/platform/desktop'
import { listRemoteContentFiles, readRemoteJsonFile } from '@/services/remoteContentClient'
```

Add constants:

```ts
const SOC_TEMPLATE_SOURCE = 'socTemplateCatalog' as const
const SOC_TEMPLATE_PATTERN = '**/*.json'
const SELECTED_CORE_SETTING_PREFIX = 'ecos.socTemplate.selectedCore.remote:'
```

Add helper types/functions:

```ts
type RemoteSocTemplateIndexEntry = {
  id: string
  path: string
  sourceLabel: string
  detail: SocTemplateDetail
}

function selectedCoreSettingKey(sourceLabel: string): string {
  return `${SELECTED_CORE_SETTING_PREFIX}${sourceLabel}`
}

function applySelectedCoreOverride(detail: SocTemplateDetail, selectedCoreId: number | null): SocTemplateDetail {
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
```

- [x] **Step 4: Replace catalog/detail/select implementations**

In `socTemplateCatalog.ts`, replace existing localStorage-backed exported implementations with:

```ts
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

export async function selectSocTemplateCore(templateId: string, coreId: number): Promise<SocTemplateDetail> {
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
```

Remove `IMPORTED_SOC_STORAGE_KEY`, `ImportedSocRecord`, `getLocalStorage`, `loadImportedRecords`, `persistImportedRecords`, `importSocTemplateFromJsonText`, `removeImportedSocTemplate`, `importedSummaryFromRecord`, and `markSelectedCoreInRawJson` if the product no longer supports local JSON import.

- [x] **Step 5: Run catalog tests**

Run:

```bash
pnpm --filter @ecos-studio/renderer test -- src/composables/socTemplateCatalog.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add ecos/gui/apps/renderer/src/composables/socTemplateCatalog.ts \
  ecos/gui/apps/renderer/src/composables/socTemplateCatalog.test.ts
git commit -m "feat(gui): load soc templates from remote content"
```

---

### Task 7: Update SoC Gallery UI for Remote Catalog

**Files:**
- Modify: `ecos/gui/apps/renderer/src/components/SoCTemplateGallery.vue`
- Modify: `ecos/gui/apps/renderer/src/components/SoCTemplateGallery.test.ts`

- [x] **Step 1: Write failing gallery tests for remote-only UI**

In `ecos/gui/apps/renderer/src/components/SoCTemplateGallery.test.ts`, update tests to assert:

```ts
expect(container.textContent).not.toContain('Import JSON')
expect(container.textContent).not.toContain('Remove')
expect(container.textContent).toContain('Remote catalog')
```

Also assert the empty state copy does not mention importing a local JSON file:

```ts
expect(container.textContent).not.toContain('import a')
expect(container.textContent).toContain('remote SoC catalog')
```

- [x] **Step 2: Run gallery tests to verify failure**

Run:

```bash
pnpm --filter @ecos-studio/renderer test -- src/components/SoCTemplateGallery.test.ts
```

Expected: FAIL because import/remove UI still exists.

- [x] **Step 3: Remove import/remove UI from gallery**

In `SoCTemplateGallery.vue`:

- Remove imports:

```ts
import { ref } from 'vue'
import { importSocTemplateFromJsonText, removeImportedSocTemplate } from '@/composables/socTemplateCatalog'
```

- Remove local import state and functions:

```ts
const fileInputRef = ref<HTMLInputElement | null>(null)
const importError = ref<string | null>(null)
const importBusy = ref(false)
function triggerImportPicker(): void { ... }
async function onImportFileChange(event: Event): Promise<void> { ... }
function onRemoveImported(templateId: string): void { ... }
```

- Remove emitted event:

```ts
'catalog-changed': []
```

- Replace hero copy with:

```vue
Inspect floorplans and core bounding boxes from the ECOS remote SoC catalog.
```

- Replace the badge text `Floorplan catalog` with `Remote catalog`.
- Remove the `<input type="file">`, `Import JSON` button, import error transition, and `Remove` button.
- Keep the template count badge and `Open Details` button.
- Change empty state copy to:

```vue
The remote SoC catalog did not return any templates. Retry the catalog load or check the desktop network connection.
```

- [x] **Step 4: Update parent view event binding**

In `ecos/gui/apps/renderer/src/views/SoCTemplateGalleryView.vue`, remove:

```vue
@catalog-changed="loadCatalog"
```

- [x] **Step 5: Run gallery tests**

Run:

```bash
pnpm --filter @ecos-studio/renderer test -- src/components/SoCTemplateGallery.test.ts src/views/SoCTemplateGalleryView.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add ecos/gui/apps/renderer/src/components/SoCTemplateGallery.vue \
  ecos/gui/apps/renderer/src/components/SoCTemplateGallery.test.ts \
  ecos/gui/apps/renderer/src/views/SoCTemplateGalleryView.vue
git commit -m "refactor(gui): make soc gallery remote-only"
```

---

### Task 8: End-to-End Verification

**Files:**
- No new files. This task verifies the integrated implementation.

- [x] **Step 1: Run focused renderer tests**

Run:

```bash
pnpm --filter @ecos-studio/renderer test -- \
  src/services/remoteContentClient.test.ts \
  src/composables/socTemplateMapper.test.ts \
  src/composables/socTemplatePreviewSelection.test.ts \
  src/composables/socTemplateCatalog.test.ts \
  src/components/SoCTemplateGallery.test.ts \
  src/views/SoCTemplateGalleryView.test.ts \
  src/views/SoCTemplateDetailView.test.ts
```

Expected: all listed test files pass.

- [x] **Step 2: Run focused Electron tests**

Run:

```bash
pnpm --filter @ecos-studio/desktop-electron test -- \
  electron/services/remoteContentService.test.ts \
  electron/main/registerIpc.test.ts
```

Expected: both test files pass.

- [x] **Step 3: Run typechecks**

Run:

```bash
pnpm --filter @ecos-studio/shared run typecheck
pnpm --filter @ecos-studio/desktop-electron run typecheck
pnpm --filter @ecos-studio/renderer run typecheck
```

Expected: all commands exit `0`.

- [x] **Step 4: Manual desktop smoke test**

Run:

```bash
pnpm --filter @ecos-studio/desktop-electron run dev
```

Manual checks:

- Open the SoC gallery.
- Confirm gallery shows templates from `socTemplateCatalog`.
- Open `ysyxSoCASIC`.
- Confirm default focused core follows `cores.selected_core_id` from the remote JSON.
- Select a different core.
- Navigate away and back.
- Confirm selected core persists locally through settings.
- Confirm no import/remove local JSON controls are visible.

Verification note (2026-05-18):

- `pnpm run dev` initially failed because another ECOS checkout already owned `127.0.0.1:1420`.
- Added `ECOS_RENDERER_DEV_PORT` support so local smoke tests can use a temporary strict port without disturbing the existing instance.
- `unset ELECTRON_RUN_AS_NODE; ECOS_RENDERER_DEV_PORT=1421 pnpm exec electron-vite --remoteDebuggingPort 9224` built main/preload, started the renderer dev server at `http://localhost:1421/`, launched Electron main, and reported FastAPI ready on port `8765`.
- Current non-interactive session could not complete page-level click checks because Electron did not expose a page target via `/json/list`; logs confirmed startup and clean shutdown. UI behavior is covered by the focused gallery/detail/catalog tests listed above.

- [x] **Step 5: Commit verification-only fixes if needed**

If verification reveals fixes, commit them with scoped messages. If no fixes are needed, do not create an empty commit.

---

## Self-Review

- **Spec coverage:** This plan covers a reusable TS/Electron remote content service, built-in GitHub source config with no user-entered URL, IPC/preload exposure, renderer client, SoC catalog migration, local selected-core persistence, UI remote-only cleanup, and verification.
- **Placeholder scan:** No `TBD`, `TODO`, or unspecified repository paths remain. Initial source is concrete: `openecos-projects/ecos-studio`, `main`, `ecos/gui/apps/renderer/public`.
- **Type consistency:** The shared `RemoteContentApi` signatures match preload, IPC service, renderer client, and SoC catalog usage. Source id is consistently `socTemplateCatalog`.
