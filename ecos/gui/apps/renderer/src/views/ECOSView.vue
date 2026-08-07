<template>
  <div
    class="text-(--text-primary) relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
  >
    <div class="relative z-10 flex w-full max-w-4xl flex-col items-center px-8">
      <!-- Logo + Title -->
      <div class="mb-10 flex items-center justify-center">
        <div class="relative">
          <div
            class="bg-(--accent-color)/10 absolute -inset-4 rounded-full blur-xl"
          ></div>
          <i class="ri-cpu-line text-(--accent-color) relative text-6xl"></i>
        </div>
        <div class="ml-5 flex flex-col">
          <h1 class="text-(--text-primary) text-4xl font-bold tracking-tight">
            ECOS Studio
          </h1>
        </div>
      </div>

      <!-- Design Tools -->
      <div class="mb-8 w-full max-w-2xl">
        <h3
          class="text-(--text-secondary) mb-3 px-1 text-xs font-semibold uppercase tracking-wider"
        >
          Design Tools
        </h3>
        <div class="grid grid-cols-2 gap-4">
          <!-- Frontend Design -->
          <div
            class="border-(--border-color) bg-(--bg-secondary) group relative flex cursor-default flex-col items-center justify-center overflow-hidden rounded-xl border py-8 opacity-50 transition-all duration-200"
          >
            <div
              class="bg-(--bg-primary) mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
            >
              <i class="ri-code-s-slash-line text-(--text-secondary) text-2xl"></i>
            </div>
            <span class="text-(--text-primary) mb-1 text-sm font-medium"
              >Frontend Design</span
            >
            <span class="text-(--text-secondary) text-xs"
              >RTL / Verilog / SystemVerilog</span
            >
            <div
              class="bg-(--bg-primary)/60 absolute inset-0 flex items-center justify-center"
            >
              <span
                class="border-(--border-color) bg-(--bg-secondary) text-(--text-secondary) rounded-full border px-3 py-1 text-xs font-medium"
                >Coming Soon</span
              >
            </div>
          </div>
          <!-- Backend Design -->
          <button
            @click="navigateToECC"
            class="border-(--border-color) bg-(--bg-secondary) hover:border-(--accent-color) hover:shadow-(--accent-color)/5 group flex cursor-pointer flex-col items-center justify-center rounded-xl border py-8 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
          >
            <div
              class="bg-(--bg-primary) group-hover:bg-(--accent-color)/10 mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition-colors"
            >
              <i
                class="ri-cpu-line text-(--text-secondary) group-hover:text-(--accent-color) text-2xl transition-colors"
              ></i>
            </div>
            <span class="text-(--text-primary) mb-1 text-sm font-medium"
              >Backend Design</span
            >
            <span class="text-(--text-secondary) text-xs">Synthesis → P&R → GDS</span>
          </button>
        </div>
      </div>

      <!-- Quick links -->
      <div class="mb-8 w-full max-w-2xl">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="space-y-2">
              <button
                @click="navigateToTools"
                class="border-(--border-color) bg-(--bg-secondary) hover:border-(--accent-color) group flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all duration-200"
              >
                <i class="ri-tools-line text-(--accent-color) text-lg"></i>
                <span class="min-w-0 flex-1">
                  <span class="text-(--text-primary) block text-sm font-medium"
                    >Resource Manager</span
                  >
                  <span class="text-(--text-secondary) block truncate text-xs"
                    >EDA tools and PDKs</span
                  >
                </span>
                <i
                  class="ri-arrow-right-s-line text-(--text-secondary) group-hover:text-(--accent-color) text-lg transition-colors"
                ></i>
              </button>

              <button
                @click="handleNotReady"
                class="border-(--border-color) bg-(--bg-secondary) hover:border-(--accent-color) group flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left opacity-50 transition-all duration-200"
              >
                <i class="ri-puzzle-line text-(--text-secondary) text-lg"></i>
                <span class="text-(--text-primary) text-sm">IP Catalog</span>
              </button>
            </div>
          </div>

          <div>
            <div class="space-y-2">
              <button
                @click="navigateToMpcResources"
                class="border-(--border-color) bg-(--bg-secondary) hover:border-(--accent-color) group flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all duration-200"
              >
                <i class="ri-layout-grid-line text-(--accent-color) text-lg"></i>
                <span class="min-w-0 flex-1">
                  <span class="text-(--text-primary) block text-sm font-medium"
                    >MPC Resources</span
                  >
                  <span class="text-(--text-secondary) block truncate text-xs"
                    >Templates and core constraints</span
                  >
                </span>
                <i
                  class="ri-arrow-right-s-line text-(--text-secondary) group-hover:text-(--accent-color) text-lg transition-colors"
                ></i>
              </button>

              <button
                @click="handleNotReady"
                class="border-(--border-color) bg-(--bg-secondary) hover:border-(--accent-color) group flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left opacity-50 transition-all duration-200"
              >
                <i class="ri-bar-chart-box-line text-(--text-secondary) text-lg"></i>
                <span class="text-(--text-primary) text-sm">Benchmarks</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <!-- Project Management entry -->
      <button
        @click="navigateToProjects"
        class="border-(--border-color) text-(--text-secondary) hover:border-(--accent-color) hover:text-(--accent-color) group flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-6 py-3 transition-all duration-200"
      >
        <i
          class="ri-folder-settings-line group-hover:text-(--accent-color) text-lg transition-colors"
        ></i>
        <span class="text-sm font-medium">Project Management</span>
        <i
          class="ri-arrow-right-s-line text-lg transition-transform group-hover:translate-x-0.5"
        ></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const navigateToECC = () => router.push('/ecc')
const navigateToProjects = () => router.push('/projects')
const navigateToTools = () => router.push('/tools')
const navigateToMpcResources = () => router.push('/mpc')
const handleNotReady = () => {
  /* placeholder */
}
</script>
