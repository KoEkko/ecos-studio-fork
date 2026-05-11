<template>
  <div class="waveform-panel">
    <header class="waveform-header">
      <div class="waveform-title">
        <i class="ri-pulse-line"></i>
        <div>
          <h3>Waveform</h3>
          <p :title="currentWave?.path || ''">{{ subtitle }}</p>
        </div>
      </div>
      <button
        type="button"
        class="icon-button"
        title="Reload waveform"
        :disabled="!currentWave || loading"
        @click="void loadCurrentWave()"
      >
        <i :class="loading ? 'ri-loader-4-line spin' : 'ri-refresh-line'"></i>
      </button>
    </header>

    <div v-if="!currentWave" class="empty-waveform">
      <i class="ri-pulse-line"></i>
      <span>Select a waveform from frontend simulation results</span>
    </div>

    <div v-else class="waveform-body">
      <div v-if="loading || errorMessage" class="waveform-status" :class="{ error: errorMessage }">
        <i :class="loading ? 'ri-loader-4-line spin' : 'ri-error-warning-line'"></i>
        <span>{{ errorMessage || 'Loading waveform...' }}</span>
      </div>
      <iframe
        ref="surferFrame"
        class="surfer-frame"
        title="Surfer waveform viewer"
        :src="surferUrl"
        @load="handleFrameLoad"
      ></iframe>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getApiBaseUrl, syncApiPort } from '@/api'
import { useWaveformViewerStore } from '@/stores/waveformViewerStore'

const surferUrl = 'https://app.surfer-project.org/'
const waveformStore = useWaveformViewerStore()
const { currentWave, openRequestedAt } = storeToRefs(waveformStore)
const surferFrame = ref<HTMLIFrameElement | null>(null)
const frameReady = ref(false)
const loading = ref(false)
const errorMessage = ref('')
let loadToken = 0

const subtitle = computed(() => {
  if (!currentWave.value) return 'No waveform loaded'
  const name = fileName(currentWave.value.path)
  return currentWave.value.caseName ? `${currentWave.value.caseName} · ${name}` : name
})

watch(
  () => openRequestedAt.value,
  () => {
    if (!frameReady.value) return
    void loadCurrentWave()
  },
)

watch(
  () => currentWave.value?.path,
  () => {
    if (!frameReady.value) return
    void loadCurrentWave()
  },
)

async function handleFrameLoad(): Promise<void> {
  frameReady.value = true
  await loadCurrentWave()
}

async function loadCurrentWave(): Promise<void> {
  const wave = currentWave.value
  if (!wave) return
  const token = ++loadToken
  loading.value = true
  errorMessage.value = ''

  try {
    await syncApiPort()
    await nextTick()

    const iframe = surferFrame.value
    if (!iframe?.contentWindow) return

    const fileUrl = waveformFileUrl(wave.path)
    const response = await fetch(fileUrl, { method: 'HEAD' })
    if (!response.ok) {
      throw new Error(`Cannot load waveform: ${response.status} ${response.statusText}`)
    }

    const message = { command: 'LoadUrl', url: fileUrl }
    const targetOrigin = new URL(surferUrl).origin
    iframe.contentWindow.postMessage(message, targetOrigin)
    window.setTimeout(() => iframe.contentWindow?.postMessage(message, targetOrigin), 600)
    window.setTimeout(() => iframe.contentWindow?.postMessage(message, targetOrigin), 1500)
  } catch (err) {
    if (token === loadToken) {
      errorMessage.value = err instanceof Error ? err.message : String(err)
    }
  } finally {
    if (token === loadToken) {
      loading.value = false
    }
  }
}

function waveformFileUrl(path: string): string {
  const name = encodeURIComponent(fileName(path))
  return `${getApiBaseUrl()}/api/frontend/workspace/waveform/file/${name}?path=${encodeURIComponent(path)}`
}

function fileName(path: string): string {
  return path.split('/').filter(Boolean).pop() || path
}
</script>

<style scoped>
.waveform-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.waveform-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 42px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.waveform-title {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.waveform-title i {
  color: var(--accent-color);
  font-size: 17px;
}

.waveform-title h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 750;
}

.waveform-title p {
  max-width: 720px;
  margin: 2px 0 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-button:hover:not(:disabled) {
  border-color: var(--text-secondary);
  background: var(--bg-hover);
}

.icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.waveform-body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.waveform-status {
  position: absolute;
  top: 10px;
  left: 12px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: calc(100% - 24px);
  padding: 7px 9px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-primary) 88%, transparent);
  color: var(--text-secondary);
  font-size: 11px;
}

.waveform-status.error {
  border-color: rgba(239, 68, 68, 0.5);
  color: #ef4444;
}

.surfer-frame {
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--bg-primary);
}

.empty-waveform {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 18px;
  color: var(--text-secondary);
  text-align: center;
  font-size: 12px;
}

.empty-waveform i {
  color: var(--accent-color);
  font-size: 28px;
}

.spin {
  animation: spin 0.85s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
