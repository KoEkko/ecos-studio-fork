/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import type { UserConfig } from 'vite'

export interface RendererViteBuildOptions {
  emptyOutDir?: boolean
  input?: string
  outDir?: string
}

export interface RendererViteConfigOptions {
  aliasTarget: string
  build?: RendererViteBuildOptions
  command: string
  fsAllow: string[]
  includeTestConfig?: boolean
  mode: string
  root?: string
}

type RendererVitestConfig = NonNullable<UserConfig['test']>
type RendererUserConfig = UserConfig & {
  test?: RendererVitestConfig
}

function resolveRendererDevPort(): number {
  const rawPort = process.env.ECOS_RENDERER_DEV_PORT
  if (!rawPort) return 1420

  const parsedPort = Number(rawPort)
  return Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
    ? parsedPort
    : 1420
}

export function createRendererViteConfig({
  aliasTarget,
  build,
  command,
  fsAllow,
  includeTestConfig = false,
  mode,
  root,
}: RendererViteConfigOptions): RendererUserConfig {
  const isProd = command === 'build' && mode !== 'development'
  const buildConfig: NonNullable<UserConfig['build']> = {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router'],
          'primevue-vendor': ['primevue'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 4096,
  }

  if (build?.input) {
    buildConfig.rollupOptions = {
      ...buildConfig.rollupOptions,
      input: build.input,
    }
  }

  if (build?.outDir) {
    buildConfig.outDir = build.outDir
  }

  if (build?.emptyOutDir != null) {
    buildConfig.emptyOutDir = build.emptyOutDir
  }

  const config: RendererUserConfig = {
    base: './',
    resolve: {
      alias: {
        '@': aliasTarget,
      },
    },
    plugins: [
      vue({
        template: {
          compilerOptions: {
            hoistStatic: true,
            cacheHandlers: true,
          },
        },
      }),
      tailwindcss(),
    ],
    clearScreen: false,
    server: {
      port: resolveRendererDevPort(),
      strictPort: true,
      fs: {
        allow: fsAllow,
      },
    },
    esbuild: {
      drop: isProd ? ['console', 'debugger'] : [],
      pure: isProd ? ['console.log', 'console.info', 'console.debug', 'console.trace'] : [],
      legalComments: 'none',
    },
    build: buildConfig,
    optimizeDeps: {
      include: ['vue', 'vue-router', 'primevue'],
    },
  }

  if (root) {
    config.root = root
  }

  if (includeTestConfig) {
    config.test = {
      environment: 'node',
      globals: true,
    }
  }

  return config
}
