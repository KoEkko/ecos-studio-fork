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
    const fetchImpl = vi.fn(async (...args: Parameters<typeof fetch>) => {
      expect(String(args[0])).toBe('https://api.github.com/repos/openecos-projects/ecos-studio/git/trees/main?recursive=1')
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
    const fetchImpl = vi.fn(async (...args: Parameters<typeof fetch>) => {
      const [url, init] = args
      expect(String(url)).toBe('https://api.github.com/repos/openecos-projects/ecos-studio/contents/ecos%2Fgui%2Fapps%2Frenderer%2Fpublic%2FysyxSoCASIC.json?ref=main')
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

  it('reports non-OK GitHub responses with status and request URL', async () => {
    const service = new RemoteContentService({
      fetchImpl: vi.fn(async () => new Response('Not Found', { status: 404 })),
      sources: { socTemplateCatalog: source },
    })

    await expect(service.readTextFile({ source: 'socTemplateCatalog', path: 'missing.json' }))
      .rejects
      .toThrow(
        'GitHub request failed with 404: https://api.github.com/repos/openecos-projects/ecos-studio/contents/ecos%2Fgui%2Fapps%2Frenderer%2Fpublic%2Fmissing.json?ref=main',
      )
  })
})
