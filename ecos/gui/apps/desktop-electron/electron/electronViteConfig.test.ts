import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import electronViteConfig from '../electron.vite.config'

describe('desktop electron build config', () => {
  it('bundles workspace packages into main and preload builds instead of externalizing them', () => {
    const resolvedConfig = typeof electronViteConfig === 'function'
      ? electronViteConfig({
          command: 'build',
          isPreview: false,
          mode: 'production',
        })
      : electronViteConfig

    expect(resolvedConfig.main?.build?.externalizeDeps).toEqual(expect.objectContaining({
      exclude: expect.arrayContaining([
        '@ecos-studio/shared',
        '@ecos-studio/tile-helper',
      ]),
    }))
    expect(resolvedConfig.preload?.build?.externalizeDeps).toEqual(expect.objectContaining({
      exclude: expect.arrayContaining([
        '@ecos-studio/shared',
      ]),
    }))
    expect(resolvedConfig.main?.resolve?.alias).toMatchObject({
      '@ecos-studio/shared': expect.stringContaining('/packages/shared/src/index.ts'),
      '@ecos-studio/tile-helper': expect.stringContaining('/packages/tile-helper/src/index.ts'),
    })
    expect(resolvedConfig.preload?.resolve?.alias).toMatchObject({
      '@ecos-studio/shared': expect.stringContaining('/packages/shared/src/index.ts'),
      '@ecos-studio/tile-helper': expect.stringContaining('/packages/tile-helper/src/index.ts'),
    })
  })

  it('cleans the release directory before packaging so stale artifact names are removed', () => {
    const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url))
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>
    }

    expect(packageJson.scripts?.package).toContain('rm -rf release')
  })

  it('allows overriding the renderer dev port for local smoke tests', () => {
    const originalPort = process.env.ECOS_RENDERER_DEV_PORT
    process.env.ECOS_RENDERER_DEV_PORT = '1421'

    try {
      const resolvedConfig = typeof electronViteConfig === 'function'
        ? electronViteConfig({
            command: 'serve',
            isPreview: false,
            mode: 'development',
          })
        : electronViteConfig

      expect(resolvedConfig.renderer?.server?.port).toBe(1421)
      expect(resolvedConfig.renderer?.server?.strictPort).toBe(true)
    } finally {
      if (originalPort == null) {
        delete process.env.ECOS_RENDERER_DEV_PORT
      } else {
        process.env.ECOS_RENDERER_DEV_PORT = originalPort
      }
    }
  })
})
