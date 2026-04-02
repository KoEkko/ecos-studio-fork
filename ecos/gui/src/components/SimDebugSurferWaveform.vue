<template>
  <div class="sd-surfer-host h-full min-h-[80px] min-w-0 w-full relative bg-(--bg-secondary)/40">
    <iframe
      ref="iframeRef"
      :src="iframeSrc"
      class="absolute inset-0 z-0 h-full w-full border-0"
      title="Surfer waveform viewer"
      sandbox="allow-scripts allow-same-origin allow-downloads"
      @load="onIframeLoad"
    />
    <Transition name="sd-surfer-overlay">
      <div
        v-if="showLoadingOverlay"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-4 text-center bg-(--bg-secondary)/95 backdrop-blur-[2px] border border-(--border-color)/40">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-full border border-(--border-color) bg-(--bg-primary)/80 shadow-sm">
          <i class="ri-loader-4-line text-xl text-(--accent-color) animate-spin" aria-hidden="true" />
        </div>
        <div class="max-w-[18rem] space-y-1">
          <p class="text-sm font-medium text-(--text-primary)">Loading waveform viewer</p>
        </div>
        <p class="text-[10px] text-(--text-secondary)/70">The waveform will be displayed automatically after loading.</p>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

const iframeRef = ref<HTMLIFrameElement | null>(null)
const showLoadingOverlay = ref(true)
let hideOverlayTimer: ReturnType<typeof setTimeout> | null = null

function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL
  const prefix = base.endsWith('/') ? base : `${base}/`
  return new URL(`${prefix}${path}`, window.location.href).href
}

/** Same-origin Surfer bundle from `public/surfer/` (CI `pages_build` artifact). */
const iframeSrc = computed(() => publicUrl('surfer/index.html'))

function sampleWaveUrl(): string {
  return publicUrl('surfer/picorv32.vcd')
}

function postLoadWaveform() {
  const win = iframeRef.value?.contentWindow
  if (!win) return
  try {
    win.postMessage({ command: 'LoadUrl', url: sampleWaveUrl() }, '*')
  } catch (e) {
    console.warn('[SimDebugSurferWaveform] postMessage failed:', e)
  }
}

/**
 * Surfer WASM boots asynchronously after iframe `load`; retry LoadUrl a few times.
 * TODO(sim): replace with explicit ready handshake from Surfer when integrating Tauri file paths.
 */
function onIframeLoad() {
  postLoadWaveform()
  const delays = [400, 1200, 2500]
  delays.forEach((ms) => setTimeout(postLoadWaveform, ms))

  if (hideOverlayTimer) clearTimeout(hideOverlayTimer)
  hideOverlayTimer = setTimeout(() => {
    showLoadingOverlay.value = false
    hideOverlayTimer = null
  }, 3200)
}

onBeforeUnmount(() => {
  if (hideOverlayTimer) {
    clearTimeout(hideOverlayTimer)
    hideOverlayTimer = null
  }
})
</script>

<style scoped>
.sd-surfer-overlay-enter-active,
.sd-surfer-overlay-leave-active {
  transition: opacity 0.35s ease;
}
.sd-surfer-overlay-enter-from,
.sd-surfer-overlay-leave-to {
  opacity: 0;
}
</style>
