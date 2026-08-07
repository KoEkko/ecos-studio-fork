<template>
  <div
    class="bg-(--bg-primary) text-(--text-primary) relative flex min-h-full w-full flex-col items-center overflow-y-auto overflow-x-hidden py-8"
  >
    <div class="relative z-10 my-auto flex w-full flex-col items-center">
      <!-- Logo 和标题 -->
      <div class="mb-12 flex items-center justify-center">
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

      <!-- 操作按钮 -->
      <div class="mb-16 flex gap-5">
        <button
          @click="$emit('open-project')"
          class="border-(--border-color) bg-(--bg-secondary) hover:border-(--accent-color) hover:bg-(--bg-sidebar) hover:shadow-(--accent-color)/5 group flex min-w-[180px] cursor-pointer flex-col items-center gap-3 rounded-xl border px-8 py-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg"
        >
          <div
            class="bg-(--bg-primary) group-hover:bg-(--accent-color)/10 flex h-14 w-14 items-center justify-center rounded-xl transition-colors"
          >
            <i
              class="ri-book-open-line text-(--text-secondary) group-hover:text-(--accent-color) text-2xl transition-colors"
            ></i>
          </div>
          <span class="text-(--text-primary) text-sm font-medium">Open Workspace</span>
        </button>

        <button
          @click="showWizard = true"
          class="border-(--border-color) bg-(--bg-secondary) hover:border-(--accent-color) hover:bg-(--bg-sidebar) hover:shadow-(--accent-color)/5 group flex min-w-[180px] cursor-pointer flex-col items-center gap-3 rounded-xl border px-8 py-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg"
        >
          <div
            class="bg-(--bg-primary) group-hover:bg-(--accent-color)/10 flex h-14 w-14 items-center justify-center rounded-xl transition-colors"
          >
            <i
              class="ri-folder-open-line text-(--text-secondary) group-hover:text-(--accent-color) text-2xl transition-colors"
            ></i>
          </div>
          <span class="text-(--text-primary) text-sm font-medium">New Workspace</span>
        </button>

        <button
          @click="handleImportPdk"
          class="border-(--border-color) bg-(--bg-secondary) hover:border-(--accent-color) hover:bg-(--bg-sidebar) hover:shadow-(--accent-color)/5 group flex min-w-[180px] cursor-pointer flex-col items-center gap-3 rounded-xl border px-8 py-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg"
        >
          <div
            class="bg-(--bg-primary) group-hover:bg-(--accent-color)/10 flex h-14 w-14 items-center justify-center rounded-xl transition-colors"
          >
            <i
              class="ri-database-2-line text-(--text-secondary) group-hover:text-(--accent-color) text-2xl transition-colors"
            ></i>
          </div>
          <span class="text-(--text-primary) text-sm font-medium">Import PDK</span>
        </button>
      </div>

      <!-- 最近项目 -->
      <div class="w-full max-w-3xl px-4">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-(--text-primary) flex items-center gap-2 text-lg font-semibold">
            <i class="ri-time-line text-(--text-secondary)"></i>
            Recent Workspaces
          </h2>
          <button
            v-if="recentProjects.length > 3"
            @click="showAllProjects = !showAllProjects"
            class="text-(--accent-color) flex cursor-pointer items-center gap-1 text-sm transition-opacity hover:opacity-80"
          >
            <template v-if="showAllProjects">
              Collapse
              <i class="ri-arrow-up-s-line"></i>
            </template>
            <template v-else>
              View All ({{ recentProjects.length }})
              <i class="ri-arrow-right-s-line"></i>
            </template>
          </button>
        </div>

        <div
          v-if="recentProjects.length === 0"
          class="border-(--border-color) bg-(--bg-secondary)/50 text-(--text-secondary) rounded-xl border border-dashed py-16 text-center"
        >
          <i class="ri-folder-2-line mb-4 block text-5xl opacity-30"></i>
          <p class="text-sm">No recent workspaces</p>
          <p class="mt-2 text-xs opacity-60">
            Click "New Workspace" to start your chip design journey
          </p>
        </div>

        <div
          v-else
          class="scrollbar-thin max-h-[min(42vh,420px)] space-y-2 overflow-y-auto overscroll-contain pr-1"
        >
          <div
            v-for="project in displayedProjects"
            :key="project.id"
            class="bg-(--bg-secondary) group flex w-full items-center justify-between rounded-xl border px-5 py-4 text-left transition-all duration-200"
            :class="
              project.workspaceRecognized === false
                ? 'border-(--border-color) cursor-default opacity-55'
                : 'border-(--border-color) hover:border-(--accent-color) hover:bg-(--bg-sidebar) cursor-pointer hover:shadow-md'
            "
            @click="
              project.workspaceRecognized !== false && $emit('open-recent', project)
            "
          >
            <div class="flex min-w-0 flex-1 items-center gap-4">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-lg transition-colors"
                :class="
                  project.workspaceRecognized === false
                    ? 'bg-red-500/10'
                    : 'bg-(--accent-color)/10 group-hover:bg-(--accent-color)/20'
                "
              >
                <i
                  :class="
                    project.workspaceRecognized === false
                      ? 'ri-folder-warning-line text-lg text-red-400'
                      : 'ri-folder-line text-(--accent-color) text-lg'
                  "
                ></i>
              </div>
              <div class="min-w-0 flex-1">
                <p
                  class="truncate font-medium"
                  :class="
                    project.workspaceRecognized === false
                      ? 'text-(--text-secondary)'
                      : 'text-(--text-primary)'
                  "
                >
                  {{ project.name }}
                </p>
                <div class="mt-0.5 flex items-center gap-2">
                  <p class="text-(--text-secondary) truncate text-xs">
                    {{ project.path }}
                  </p>
                  <span
                    v-if="project.workspaceRecognized === false"
                    class="shrink-0 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400"
                  >
                    Workspace not recognized
                  </span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="text-(--text-secondary) group-hover:text-(--text-primary) whitespace-nowrap text-xs transition-colors"
              >
                {{ formatDate(project.lastOpened) }}
              </span>
              <!-- 删除按钮 -->
              <button
                @click.stop="$emit('remove-recent', project.id)"
                class="cursor-pointer rounded-lg p-1.5 opacity-0 transition-all hover:bg-red-500/10 group-hover:opacity-100"
                title="Remove from list"
              >
                <i
                  class="ri-close-line text-(--text-secondary) text-sm hover:text-red-500"
                ></i>
              </button>
              <i
                v-if="project.workspaceRecognized !== false"
                class="ri-arrow-right-s-line text-(--text-secondary) opacity-0 transition-opacity group-hover:opacity-100"
              ></i>
            </div>
          </div>
        </div>
      </div>

      <!-- 已导入的 PDK -->
      <div v-if="importedPdks.length > 0" class="mt-8 w-full max-w-3xl px-4">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-(--text-primary) flex items-center gap-2 text-lg font-semibold">
            <i class="ri-database-2-line text-(--text-secondary)"></i>
            Imported PDKS
          </h2>
        </div>
        <div class="scrollbar-thin flex max-h-[120px] flex-wrap gap-3 overflow-y-auto">
          <div
            v-for="pdk in importedPdks"
            :key="pdk.id"
            class="border-(--border-color) bg-(--bg-secondary) group flex shrink-0 items-center gap-3 rounded-xl border px-4 py-3"
          >
            <div
              class="bg-(--accent-color)/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            >
              <i class="ri-cpu-line text-(--accent-color)"></i>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-(--text-primary) text-sm font-medium">{{ pdk.name }}</p>
                <span
                  v-if="pdk.techNode"
                  class="bg-(--accent-color)/10 text-(--accent-color) rounded px-1.5 py-0.5 text-[10px] font-medium"
                >
                  {{ pdk.techNode }}
                </span>
              </div>
              <p
                class="text-(--text-secondary) mt-0.5 max-w-[240px] truncate font-mono text-[11px] opacity-60"
              >
                {{ pdk.path }}
              </p>
            </div>
            <button
              @click.stop="handleRemovePdk(pdk.id)"
              class="ml-2 cursor-pointer rounded-lg p-1.5 opacity-0 transition-all hover:bg-red-500/10 group-hover:opacity-100"
              title="Remove this PDK"
            >
              <i
                class="ri-close-line text-(--text-secondary) text-sm hover:text-red-500"
              ></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- New Project Wizard Modal -->
    <NewProjectWizard
      v-if="showWizard"
      @close="showWizard = false"
      @create="handleWizardCreate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Project, WorkspaceConfig } from '../types'
import NewProjectWizard from './NewProjectWizard.vue'
import { usePdkManager } from '../composables/usePdkManager'

interface Props {
  recentProjects?: Project[]
}

interface Emits {
  (e: 'open-project'): void
  (e: 'new-project', config?: WorkspaceConfig): void
  (e: 'import-project'): void
  (e: 'open-recent', project: Project): void
  (e: 'remove-recent', projectId: string): void
}

const emit = defineEmits<Emits>()

const showWizard = ref(false)
const showAllProjects = ref(false)

const props = withDefaults(defineProps<Props>(), {
  recentProjects: () => [],
})

const displayedProjects = computed(() => {
  return showAllProjects.value ? props.recentProjects : props.recentProjects.slice(0, 3)
})

// PDK 管理
const { importedPdks, loadPdks, importPdk, removePdk } = usePdkManager()

onMounted(async () => {
  await loadPdks()
})

const handleImportPdk = async () => {
  await importPdk()
}

const handleRemovePdk = async (id: string) => {
  await removePdk(id)
}

const handleWizardCreate = (config: WorkspaceConfig) => {
  showWizard.value = false
  emit('new-project', config)
}

const formatDate = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return new Date(date).toLocaleDateString('en-US')
}
</script>

<style scoped>
.welcome-gradient {
  background: radial-gradient(
    ellipse at 50% 30%,
    var(--accent-color) 0%,
    transparent 60%
  );
}
</style>
