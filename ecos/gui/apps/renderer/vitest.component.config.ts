import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'
import { configDefaults } from 'vitest/config'
import { createRendererViteConfig } from './vite.shared'

export default defineConfig(({ command, mode }) => ({
  ...createRendererViteConfig({
    command,
    mode,
    aliasTarget: fileURLToPath(new URL('./src', import.meta.url)),
    fsAllow: ['../../..'],
  }),
  test: {
    environment: 'happy-dom',
    exclude: configDefaults.exclude,
    globals: true,
    include: ['src/**/*.component.test.ts'],
    setupFiles: ['src/test/componentSetup.ts'],
  },
}))
