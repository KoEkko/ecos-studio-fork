import { afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  setActivePinia(createPinia())
})

setActivePinia(createPinia())

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }))
}
