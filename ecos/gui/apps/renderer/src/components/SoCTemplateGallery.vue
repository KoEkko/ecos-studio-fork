<script setup lang="ts">
import { ref } from 'vue'
import { importSocTemplateFromJsonText } from '@/composables/socTemplateCatalog'
import type { SocTemplateSummary } from '@/composables/socTemplateMapper'

const props = defineProps<{
  items: SocTemplateSummary[]
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  back: []
  open: [templateId: string]
  retry: []
  'catalog-changed': []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const importError = ref<string | null>(null)
const importBusy = ref(false)

function coreDots(count: number): number[] {
  const n = Math.max(1, Math.min(count, 9))
  return Array.from({ length: n }, (_, i) => i)
}

function triggerImportPicker(): void {
  importError.value = null
  fileInputRef.value?.click()
}

async function onImportFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  importBusy.value = true
  importError.value = null

  try {
    const text = await file.text()
    const label = file.name.replace(/\.json$/i, '') || file.name
    await importSocTemplateFromJsonText(text, label)
    emit('catalog-changed')
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Unable to import template.'
  } finally {
    importBusy.value = false
  }
}

</script>

<template>
  <section class="soc-gallery flex flex-col gap-6" aria-label="SoC template catalog">
    <header class="flex flex-col gap-4 border-b border-(--border-color) pb-4">
      <button
        type="button"
        class="inline-flex w-max items-center gap-2 text-sm font-medium text-(--text-secondary) transition-colors duration-200 hover:text-(--text-primary)"
        @click="$emit('back')"
      >
        <i class="ri-arrow-left-line text-base" aria-hidden="true"></i>
        Back
      </button>

      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h1 class="text-[clamp(1.75rem,3vw,2.15rem)] font-semibold tracking-tight text-(--text-primary)">Templates</h1>
        </div>

        <div class="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
          <input
            ref="fileInputRef"
            type="file"
            accept=".json,application/json"
            class="sr-only"
            aria-hidden="true"
            tabindex="-1"
            @change="onImportFileChange"
          />
          <button
            type="button"
            class="inline-flex items-center justify-center gap-2 rounded-xl bg-(--accent-color) px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-14px_color-mix(in_srgb,var(--accent-color)_72%,transparent)] transition-[transform,opacity] duration-200 hover:-translate-y-px hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="importBusy"
            @click="triggerImportPicker"
          >
            <i class="ri-upload-cloud-2-line text-base" aria-hidden="true"></i>
            Import Template
          </button>
        </div>
      </div>

      <Transition name="soc-gallery-fade">
        <p
          v-if="importError"
          class="rounded-xl border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-sm leading-relaxed text-red-600 dark:text-red-400"
          role="alert"
        >
          {{ importError }}
        </p>
      </Transition>
    </header>

    <div
      v-if="loading"
      class="soc-gallery__panel rounded-2xl border border-(--border-color) bg-(--bg-secondary)/92 p-8"
      aria-busy="true"
    >
      <div class="soc-gallery__shimmer mx-auto max-w-3xl space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="soc-gallery__bone h-32 rounded-2xl" />
          <div class="soc-gallery__bone h-32 rounded-2xl opacity-85" />
        </div>
        <p class="text-center text-sm font-medium text-(--text-secondary)">Loading templates…</p>
      </div>
    </div>

    <div
      v-else-if="error"
      class="soc-gallery__panel flex flex-col gap-5 rounded-2xl border border-red-500/30 bg-red-500/[0.07] p-6 sm:flex-row sm:items-center"
      role="alert"
    >
      <div
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-500/35 bg-red-500/15 font-mono text-lg font-bold text-red-600"
        aria-hidden="true"
      >
        !
      </div>
      <div class="min-w-0 flex-1">
        <h2 class="text-base font-semibold tracking-tight text-(--text-primary)">Could not load templates</h2>
        <p class="mt-1.5 text-sm leading-relaxed text-(--text-secondary)">{{ error }}</p>
      </div>
      <button
        type="button"
        class="inline-flex shrink-0 items-center justify-center rounded-xl bg-(--accent-color) px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-14px_color-mix(in_srgb,var(--accent-color)_72%,transparent)] transition-opacity hover:opacity-95"
        @click="$emit('retry')"
      >
        Retry
      </button>
    </div>

    <div
      v-else-if="props.items.length === 0"
      class="soc-gallery__panel rounded-2xl border border-dashed border-(--border-color) bg-(--bg-secondary)/72 px-8 py-14 text-center"
    >
      <div
        class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-(--border-color) bg-(--bg-primary) font-mono text-xl font-semibold text-(--text-secondary)"
        aria-hidden="true"
      >
        ∅
      </div>
      <h2 class="text-lg font-semibold tracking-tight text-(--text-primary)">No templates yet</h2>
      <p class="mx-auto mt-2 max-w-md text-sm leading-relaxed text-(--text-secondary)">
        Import a template to start browsing floorplans and core layouts here.
      </p>
    </div>

    <ul v-else class="grid list-none gap-4 p-0 md:grid-cols-2">
      <li v-for="item in props.items" :key="item.id" class="soc-gallery__li">
        <article
          class="group flex h-full flex-col rounded-2xl border border-(--border-color) bg-(--bg-secondary)/96 p-4 shadow-[0_2px_14px_-8px_rgba(0,0,0,0.28)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-(--accent-color)/40 hover:shadow-[0_14px_28px_-20px_color-mix(in_srgb,var(--accent-color)_30%,transparent)]"
        >
          <div class="flex items-start gap-4">
            <div
              class="soc-gallery__thumb relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-primary) shadow-inner"
              aria-hidden="true"
            >
              <div class="soc-gallery__die-pattern pointer-events-none absolute inset-0 opacity-[0.32]" aria-hidden="true" />
              <template v-if="item.thumbnail">
                <div class="pointer-events-none absolute inset-0">
                  <div
                    class="absolute box-border overflow-hidden rounded-md border border-(--accent-color)/24 bg-(--accent-color)/10"
                    :style="{
                      left: `${item.thumbnail.coreSlotLeftPct}%`,
                      top: `${item.thumbnail.coreSlotTopPct}%`,
                      width: `${item.thumbnail.coreSlotWidthPct}%`,
                      height: `${item.thumbnail.coreSlotHeightPct}%`,
                    }"
                  >
                    <div
                      v-for="(core, tidx) in item.thumbnail.cores"
                      :key="`${item.id}-thumb-core-${tidx}`"
                      class="soc-gallery__thumb-core pointer-events-none absolute min-h-[2px] min-w-[2px] rounded-[3px] bg-(--accent-color) shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent-color)_40%,transparent)]"
                      :style="{
                        left: `${core.leftPct}%`,
                        top: `${core.topPct}%`,
                        width: `${core.widthPct}%`,
                        height: `${core.heightPct}%`,
                      }"
                    />
                  </div>
                </div>
              </template>
              <div v-else class="relative flex h-full w-full items-center justify-center">
                <div class="grid grid-cols-3 gap-1">
                  <span
                    v-for="i in coreDots(item.coreCount)"
                    :key="`${item.id}-c-${i}`"
                    class="h-2 w-2 rounded-sm bg-(--accent-color) shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent-color)_35%,transparent)]"
                  />
                </div>
              </div>
            </div>

            <div class="min-w-0 flex-1 py-1">
              <h2 class="truncate text-lg font-semibold tracking-tight text-(--text-primary)">{{ item.name }}</h2>
              <p class="mt-2 text-sm text-(--text-secondary)">{{ item.coreCount }} cores</p>
            </div>
          </div>

          <div class="mt-4 flex items-center border-t border-(--border-color)/80 pt-3">
            <button
              type="button"
              class="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl bg-(--accent-color) px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-14px_color-mix(in_srgb,var(--accent-color)_72%,transparent)] transition-[transform,opacity] duration-200 hover:-translate-y-px hover:opacity-95"
              @click="$emit('open', item.id)"
            >
              Open Details
            </button>
          </div>
        </article>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.soc-gallery__bone {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--border-color) 52%, transparent) 0%,
    color-mix(in srgb, var(--bg-primary) 88%, var(--border-color)) 50%,
    color-mix(in srgb, var(--border-color) 52%, transparent) 100%
  );
  background-size: 200% 100%;
  animation: soc-shimmer 1.25s ease-in-out infinite;
}

.soc-gallery__panel {
  box-shadow: 0 2px 16px -10px color-mix(in srgb, var(--text-primary) 12%, transparent);
}

.soc-gallery__die-pattern {
  background-image: repeating-linear-gradient(
    -12deg,
    transparent,
    transparent 5px,
    color-mix(in srgb, var(--border-color) 55%, transparent) 5px,
    color-mix(in srgb, var(--border-color) 55%, transparent) 6px
  );
}

.soc-gallery__li {
  animation: soc-rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

.soc-gallery__li:nth-child(2) {
  animation-delay: 40ms;
}
.soc-gallery__li:nth-child(3) {
  animation-delay: 80ms;
}
.soc-gallery__li:nth-child(4) {
  animation-delay: 120ms;
}
.soc-gallery__li:nth-child(5) {
  animation-delay: 160ms;
}
.soc-gallery__li:nth-child(6) {
  animation-delay: 200ms;
}

.soc-gallery-fade-enter-active,
.soc-gallery-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.soc-gallery-fade-enter-from,
.soc-gallery-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@keyframes soc-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

@keyframes soc-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .soc-gallery__bone {
    animation: none;
    background: color-mix(in srgb, var(--border-color) 35%, transparent);
  }

  .soc-gallery__li {
    animation: none;
  }
}
</style>
