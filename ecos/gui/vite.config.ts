import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
/** Monaco workers: `vite-plugin-monaco-editor-esm` is validated against monaco-editor 0.52.x; 0.55+ worker paths differ. */
import monacoEditorPlugin from 'vite-plugin-monaco-editor-esm'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // 优化编译性能
          hoistStatic: true,
          cacheHandlers: true
        }
      }
    }),
    tailwindcss(),
    monacoEditorPlugin(),
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**']
    },
    // 配置 /data 路径服务 feature 图片等静态资源
    fs: {
      allow: ['..']
    }
  },
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    // Tauri 环境优化
    target: 'esnext',
    minify: 'esbuild',
    // 减少代码分割来提升加载速度
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router'],
          'primevue-vendor': ['primevue'],
          'monaco-vendor': ['monaco-editor'],
        }
      }
    },
    // 减少 chunk 大小警告阈值
    chunkSizeWarningLimit: 1000,
    // 优化资源内联
    assetsInlineLimit: 4096
  },
  optimizeDeps: {
    include: ['vue', 'vue-router', 'primevue', 'monaco-editor'],
  },
})

