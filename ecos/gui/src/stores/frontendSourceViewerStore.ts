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
  const focusRequestedAt = ref(0)
  const isDirty = ref(false)

  function openSource(source: FrontendSourceSelection, options: { force?: boolean } = {}): boolean {
    const samePath = currentSource.value?.path === source.path
    if (isDirty.value && !samePath && !options.force && !confirmDiscardChanges()) {
      return false
    }

    currentSource.value = source
    focusRequestedAt.value += 1
    if (!samePath || !isDirty.value || options.force) {
      isDirty.value = false
      openRequestedAt.value += 1
    }
    return true
  }

  function clearSource(): void {
    currentSource.value = null
    isDirty.value = false
  }

  function setDirty(value: boolean): void {
    isDirty.value = value
  }

  function confirmDiscardChanges(): boolean {
    if (!isDirty.value) return true
    if (typeof window === 'undefined') return true
    return window.confirm('Discard unsaved source changes?')
  }

  return {
    currentSource,
    openRequestedAt,
    focusRequestedAt,
    isDirty,
    openSource,
    clearSource,
    setDirty,
    confirmDiscardChanges,
  }
})
