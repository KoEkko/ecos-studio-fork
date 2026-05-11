import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface WaveformSelection {
  path: string
  caseName?: string
  step?: string
}

export const useWaveformViewerStore = defineStore('waveformViewer', () => {
  const currentWave = ref<WaveformSelection | null>(null)
  const openRequestedAt = ref(0)

  function openWave(wave: WaveformSelection): void {
    currentWave.value = wave
    openRequestedAt.value += 1
  }

  function clearWave(): void {
    currentWave.value = null
  }

  return {
    currentWave,
    openRequestedAt,
    openWave,
    clearWave,
  }
})
