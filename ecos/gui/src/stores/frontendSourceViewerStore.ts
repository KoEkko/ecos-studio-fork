import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface FrontendSourceSelection {
  path: string
  label?: string
  step?: string
}

export const useFrontendSourceViewerStore = defineStore('frontendSourceViewer', () => {
  const currentSource = ref<FrontendSourceSelection | null>(null)
  const openRequestedAt = ref(0)

  function openSource(source: FrontendSourceSelection): void {
    currentSource.value = source
    openRequestedAt.value += 1
  }

  function clearSource(): void {
    currentSource.value = null
  }

  return {
    currentSource,
    openRequestedAt,
    openSource,
    clearSource,
  }
})

