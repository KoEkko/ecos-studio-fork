<template>
  <div
    class="sim-debug-root flex flex-col h-full min-h-0 w-full text-(--text-primary) relative z-10 overflow-hidden bg-(--bg-primary)">
    <!-- Unified header: brand + sim controls + time & status -->
    <header
      class="sd-header-unified shrink-0 border-b border-(--border-color) bg-[color-mix(in_srgb,var(--bg-secondary)_90%,#0c1220)]">
      <div
        class="flex flex-wrap items-center gap-x-2 gap-y-2 px-2 sm:px-3 py-2 min-h-[3.25rem]">
        <!-- Left: back + brand -->
        <div class="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-0">
          <button type="button" @click="goBack"
            class="sd-back flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-(--border-color)/60 bg-(--bg-primary)/50 text-(--text-secondary) hover:text-(--text-primary) hover:border-(--accent-color)/50 hover:bg-(--bg-primary) transition-colors duration-200 cursor-pointer"
            aria-label="Back to ECOS">
            <i class="ri-arrow-left-s-line text-lg" aria-hidden="true" />
          </button>
          <div
            class="sd-app-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/20 to-violet-500/15 border border-sky-500/25">
            <i class="ri-bug-line text-xl text-sky-400" aria-hidden="true" />
          </div>
          <div class="min-w-0 max-w-[min(100%,14rem)] sm:max-w-none">
            <div class="flex items-baseline gap-2 flex-wrap">
              <span class="text-sm font-semibold tracking-tight text-(--text-primary) leading-none">SimDebug</span>
            </div>
          </div>
        </div>

        <span class="sd-header-vsep hidden sm:block h-8 w-px shrink-0 bg-(--border-color)/90" aria-hidden="true" />

        <!-- Center: sim controls (scroll on narrow) -->
        <div
          class="sd-header-tools flex flex-1 items-center gap-0.5 min-w-0 basis-full sm:basis-auto order-last sm:order-none rounded-lg border border-(--border-color)/50 bg-(--bg-primary)/35 px-1 py-0.5 sm:px-1.5 overflow-x-auto scrollbar-thin">
          <button type="button" disabled
            class="sd-tb-primary inline-flex items-center gap-1 shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-medium cursor-not-allowed opacity-85"
            title="Simulation not connected">
            <i class="ri-play-fill text-sm" aria-hidden="true" />
            <span>Run</span>
          </button>
          <span class="mx-0.5 h-5 w-px shrink-0 bg-(--border-color)/70" aria-hidden="true" />
          <button v-for="item in toolbarSecondary" :key="item.label" type="button" disabled
            class="sd-tb-secondary inline-flex items-center gap-1 shrink-0 rounded-md px-2 py-1.5 text-[11px] font-medium cursor-not-allowed opacity-55"
            :title="item.title">
            <i :class="[item.icon, 'text-[15px] leading-none']" aria-hidden="true" />
            <span class="hidden sm:inline">{{ item.label }}</span>
          </button>
        </div>

        <span class="sd-header-vsep hidden lg:block h-8 w-px shrink-0 bg-(--border-color)/90" aria-hidden="true" />

        <!-- Right: Sim time + local results + Idle -->
        <div class="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-auto sm:ml-0">
          <button type="button" disabled
            class="sd-simtime inline-flex items-center gap-1.5 shrink-0 rounded-md border border-(--border-color) bg-(--bg-primary)/30 px-2 py-1.5 text-[10px] font-medium text-(--text-secondary) cursor-not-allowed opacity-60 transition-colors duration-200"
            title="Simulation not connected">
            <span class="uppercase tracking-wide">Sim time</span>
            <span class="sd-mono text-[11px] tabular-nums text-(--text-primary)">—</span>
            <i class="ri-arrow-down-s-line text-sm opacity-80" aria-hidden="true" />
          </button>
          <span
            class="hidden sm:inline text-[10px] text-(--text-secondary) whitespace-nowrap border-l border-(--border-color)/70 pl-2 sm:pl-2.5">
            Local results
          </span>
          <span
            class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400/95">
            <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" aria-hidden="true" />
            Idle
          </span>
        </div>
      </div>
    </header>

    <!-- 交互区：纵向 Splitter — 主工作区 | 底部日志 -->
    <Splitter layout="vertical" class="flex-1 min-h-0 border-none">
      <SplitterPanel :size="72" :minSize="38" class="flex flex-col min-h-0 min-w-0 overflow-hidden">
        <!-- 横向 Splitter — 左 | 中 | 右 -->
        <Splitter class="h-full min-h-0 border-none">
          <SplitterPanel :size="20" :minSize="10" class="min-w-0 overflow-hidden">
            <aside
              class="sd-side sd-side-signals h-full flex flex-col min-h-0 overflow-hidden bg-[#0d1117] border-r border-(--border-color)/60">
              <!-- 顶栏：两行 Tab -->
              <div class="shrink-0 border-b border-(--border-color)/80 px-1 pt-1.5 pb-0">
                <div class="flex items-center justify-between gap-0.5">
                  <button
                    v-for="t in leftTabsRow1"
                    :key="t.id"
                    type="button"
                    class="sd-left-tab flex-1 px-1 py-1.5 text-[10px] font-medium transition-colors"
                    :class="activeLeftTab === t.id ? 'sd-left-tab--active text-sky-400' : 'text-(--text-secondary) hover:text-(--text-primary)/90'"
                    @click="activeLeftTab = t.id"
                  >
                    {{ t.label }}
                  </button>
                </div>
                <div class="mt-0.5 flex items-center justify-start gap-2 px-0.5">
                  <button
                    v-for="t in leftTabsRow2"
                    :key="t.id"
                    type="button"
                    class="sd-left-tab px-1 py-1.5 text-[10px] font-medium transition-colors"
                    :class="activeLeftTab === t.id ? 'sd-left-tab--active text-sky-400' : 'text-(--text-secondary) hover:text-(--text-primary)/90'"
                    @click="activeLeftTab = t.id"
                  >
                    {{ t.label }}
                  </button>
                </div>
              </div>

              <!-- Signals：筛选 + 分组树 -->
              <template v-if="activeLeftTab === 'signals'">
                <div class="shrink-0 border-b border-(--border-color)/70 px-2 py-2">
                  <div class="relative">
                    <input
                      v-model="signalFilter"
                      type="text"
                      autocomplete="off"
                      placeholder="Filter signals…"
                      class="sd-signal-filter w-full rounded border border-slate-700/90 bg-[#0d1117] py-1.5 pl-2 pr-8 text-[11px] text-(--text-primary) placeholder:text-slate-500 font-mono outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/25"
                    />
                    <i
                      class="ri-filter-3-line pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
                      aria-hidden="true"
                    />
                  </div>
                </div>
                <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin sd-side-scroll">
                  <div
                    v-for="group in filteredSignalGroups"
                    :key="group.id"
                    class="border-b border-(--border-color)/50"
                  >
                    <button
                      type="button"
                      class="flex w-full items-center gap-1 px-2 py-1.5 text-left text-[10px] text-(--text-primary) hover:bg-(--bg-primary)/25"
                      @click="toggleSignalGroup(group.id)"
                    >
                      <i
                        class="text-(--text-secondary) text-xs shrink-0"
                        :class="expandedSignalGroups[group.id] !== false ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'"
                        aria-hidden="true"
                      />
                      <span class="font-medium tracking-tight">{{ group.name }}</span>
                      <span class="ml-auto tabular-nums text-slate-500">({{ group.count }})</span>
                    </button>
                    <ul v-show="expandedSignalGroups[group.id] !== false" class="pb-1.5 pl-1 pr-0.5">
                      <li v-for="sig in group.items" :key="sig.name">
                        <button
                          type="button"
                          class="sd-signal-row group flex w-full items-center gap-2 rounded px-2 py-1 text-left sd-mono text-[10px] leading-snug text-slate-200 transition-colors"
                          :class="
                            selectedSignalName === sig.name
                              ? 'bg-sky-950/80 ring-1 ring-sky-500/35'
                              : 'hover:bg-(--bg-primary)/30'
                          "
                          @click="selectedSignalName = sig.name"
                        >
                          <span
                            class="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/20"
                            :class="signalDotClass(sig.dot)"
                            aria-hidden="true"
                          />
                          <span class="min-w-0 flex-1 truncate">{{ sig.name }}</span>
                          <i
                            v-if="selectedSignalName === sig.name"
                            class="ri-close-line shrink-0 text-rose-400/95 text-xs opacity-90 group-hover:opacity-100"
                            aria-hidden="true"
                            @click.stop.prevent="selectedSignalName = ''"
                          />
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </template>

              <!-- 其它 Tab：占位 -->
              <div
                v-else
                class="flex-1 min-h-0 overflow-y-auto px-2.5 py-3 text-[10px] leading-relaxed text-(--text-secondary) scrollbar-thin"
              >
                {{ leftTabPlaceholder }}
              </div>
            </aside>
          </SplitterPanel>

          <SplitterPanel :size="58" :minSize="28" class="min-w-0 overflow-hidden flex flex-col">
            <div class="h-full flex flex-col min-h-0 bg-(--bg-primary) min-w-0">
              <!-- 中间 2×2：纵向 Splitter 包两排，每排横向 Splitter -->
              <Splitter layout="vertical" class="flex-1 min-h-0 border-none">
                <SplitterPanel :size="50" :minSize="18" class="min-h-0 overflow-hidden">
                  <Splitter class="h-full min-h-0 border-none">
                    <SplitterPanel :size="50" :minSize="20" class="min-w-0 overflow-hidden">
                      <div class="h-full bg-(--bg-secondary)/60 flex flex-col min-h-0 overflow-hidden border border-(--border-color)/50">
                        <div
                          class="shrink-0 px-2 py-1 text-[11px] font-semibold text-(--text-primary) border-b border-(--border-color)/80">
                          {{ centerTiles[0].title }}
                        </div>
                        <div class="flex-1 min-h-0 min-w-0">
                          <SimDebugMonacoEditor />
                        </div>
                      </div>
                    </SplitterPanel>
                    <SplitterPanel :size="50" :minSize="20" class="min-w-0 overflow-hidden">
                      <div class="h-full bg-(--bg-secondary)/60 flex flex-col min-h-0 overflow-hidden border border-(--border-color)/50">
                        <div
                          class="shrink-0 px-2 py-1 text-[11px] font-semibold text-(--text-primary) border-b border-(--border-color)/80">
                          {{ waveTile.title }}
                        </div>
                        <div class="flex-1 min-h-0 min-w-0">
                          <SimDebugSurferWaveform />
                        </div>
                      </div>
                    </SplitterPanel>
                  </Splitter>
                </SplitterPanel>
                <SplitterPanel :size="50" :minSize="18" class="min-h-0 overflow-hidden">
                  <Splitter class="h-full min-h-0 border-none">
                    <SplitterPanel v-for="tile in centerRow2" :key="tile.id" :size="50" :minSize="20" class="min-w-0 overflow-hidden">
                      <div
                        class="h-full bg-(--bg-secondary)/60 flex flex-col min-h-0 overflow-hidden border border-(--border-color)/50">
                        <div
                          class="shrink-0 px-2 py-1 text-[11px] font-semibold text-(--text-primary) border-b border-(--border-color)/80">
                          {{ tile.title }}
                        </div>
                        <div v-if="tile.id === 'sch'" class="flex-1 min-h-0 min-w-0">
                          <SimDebugSchematicView />
                        </div>
                        <div v-else-if="tile.id === 'fsm'" class="flex-1 min-h-0 min-w-0">
                          <SimDebugFsmView />
                        </div>
                        <p
                          v-else
                          class="text-[10px] text-(--text-secondary) leading-relaxed flex-1 overflow-y-auto scrollbar-thin p-2">
                          {{ tile.body }}
                        </p>
                      </div>
                    </SplitterPanel>
                  </Splitter>
                </SplitterPanel>
              </Splitter>
            </div>
          </SplitterPanel>

          <SplitterPanel :size="22" :minSize="10" class="min-w-0 overflow-hidden">
            <aside
              class="sd-side sd-side-props flex h-full min-h-0 flex-col overflow-hidden border-l border-(--border-color)/50 bg-[#0d1117]"
            >
              <!-- Properties / X-State / Protocol -->
              <div class="shrink-0 border-b border-(--border-color)/80 px-1 pt-1">
                <div class="flex items-stretch justify-between gap-0.5">
                  <button
                    v-for="t in rightTabs"
                    :key="t.id"
                    type="button"
                    class="sd-right-tab flex flex-1 flex-col items-center gap-0.5 px-1 py-1.5 text-[10px] font-medium transition-colors"
                    :class="
                      activeRightTab === t.id
                        ? 'sd-right-tab--active text-sky-400'
                        : 'text-(--text-secondary) hover:text-(--text-primary)/90'
                    "
                    @click="activeRightTab = t.id"
                  >
                    <i :class="[t.icon, 'text-[13px]']" aria-hidden="true" />
                    <span class="leading-none">{{ t.label }}</span>
                  </button>
                </div>
              </div>

              <template v-if="activeRightTab === 'properties'">
                <div
                  class="shrink-0 border-b border-(--border-color)/60 px-2.5 py-1.5 flex items-center gap-1.5 text-[10px] text-(--text-secondary)"
                >
                  <i class="ri-checkbox-circle-line text-emerald-500/90 text-sm shrink-0" aria-hidden="true" />
                  <span>Assertions</span>
                </div>
                <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin sd-side-scroll">
                  <!-- 信号元数据 -->
                  <div class="m-2 rounded border border-slate-700/80 bg-[#0a0e14]/90 p-2 shadow-inner">
                    <div class="mb-2 flex items-center gap-2">
                      <span class="h-2 w-2 shrink-0 rounded-full bg-violet-500 ring-1 ring-violet-400/30" aria-hidden="true" />
                      <span class="sd-mono text-[11px] font-medium text-slate-100">{{ propertyPanel.signalName }}</span>
                    </div>
                    <dl class="grid grid-cols-[5rem_1fr] gap-x-2 gap-y-1.5 text-[10px] leading-snug">
                      <dt class="text-slate-500">Full Path</dt>
                      <dd class="sd-mono text-sky-300/95 break-all">{{ propertyPanel.fullPath }}</dd>
                      <dt class="text-slate-500">Width</dt>
                      <dd class="sd-mono text-sky-300/95">{{ propertyPanel.width }}</dd>
                      <dt class="text-slate-500">Type</dt>
                      <dd class="sd-mono text-sky-300/95 break-all">{{ propertyPanel.type }}</dd>
                      <dt class="text-slate-500">Format</dt>
                      <dd class="sd-mono text-sky-300/95">{{ propertyPanel.format }}</dd>
                      <dt class="text-slate-500">Group</dt>
                      <dd class="sd-mono text-sky-300/95">{{ propertyPanel.group }}</dd>
                    </dl>
                  </div>

                  <!-- Value @ cursor -->
                  <div class="mx-2 mb-2 rounded border border-slate-700/80 bg-[#0a0e14]/90 p-2">
                    <div class="mb-1.5 text-[9px] text-slate-500">
                      Value @ cursor (t={{ propertyPanel.cursorNs }}ns)
                    </div>
                    <div
                      class="flex min-h-[4rem] items-center justify-center rounded border border-rose-900/60 bg-rose-950/85"
                    >
                      <span
                        v-if="propertyPanel.cursorValue === 'X'"
                        class="text-[2.25rem] font-bold leading-none text-orange-500 drop-shadow-sm"
                        >X</span>
                      <span v-else class="sd-mono text-xl text-sky-300">{{ propertyPanel.cursorValue }}</span>
                    </div>
                  </div>

                  <!-- Transitions -->
                  <div class="px-2 pb-3">
                    <div class="mb-1 text-[9px] text-slate-500">Transitions</div>
                    <div v-if="propertyPanel.transitions.length === 0" class="rounded border border-slate-800/80 px-2 py-3 text-center text-[10px] text-slate-500">
                      无转移记录（mock）
                    </div>
                    <div v-else class="overflow-hidden rounded border border-slate-700/70 bg-black/25">
                      <div
                        v-for="(tr, idx) in propertyPanel.transitions"
                        :key="idx"
                        class="flex items-center gap-1 border-b border-slate-800/80 px-1.5 py-1 last:border-b-0"
                        :class="
                          tr.ns === propertyPanel.activeTransitionNs ? 'bg-sky-950/70 ring-1 ring-inset ring-sky-500/25' : ''
                        "
                      >
                        <span class="sd-mono w-[2.75rem] shrink-0 text-[10px] text-slate-400">{{ tr.ns }}ns</span>
                        <span class="shrink-0 text-slate-600">→</span>
                        <span
                          class="sd-mono min-w-0 flex-1 text-right text-[10px]"
                          :class="tr.isX ? 'font-semibold text-orange-500' : 'text-sky-300/95'"
                          >{{ tr.value }}</span>
                        <button
                          type="button"
                          class="shrink-0 rounded p-0.5 text-slate-500 hover:bg-(--bg-primary)/40 hover:text-slate-300"
                          title="Jump (placeholder)"
                          disabled
                        >
                          <i class="ri-arrow-right-s-line text-xs" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <div
                v-else
                class="flex-1 overflow-y-auto px-2.5 py-3 text-[10px] leading-relaxed text-(--text-secondary) scrollbar-thin"
              >
                {{ rightSecondaryTabHint }}
              </div>
            </aside>
          </SplitterPanel>
        </Splitter>
      </SplitterPanel>

      <SplitterPanel :size="28" :minSize="14" class="min-h-0 overflow-hidden flex flex-col">
        <footer class="sd-console h-full min-h-[120px] border-t border-(--border-color) flex flex-col bg-[color-mix(in_srgb,var(--bg-secondary)_75%,#0a0e14)]">
          <div class="sd-console-tabs flex shrink-0 border-b border-(--border-color) bg-(--bg-primary)/30">
            <button v-for="(tab, i) in bottomTabs" :key="tab.id" type="button" disabled
              class="sd-console-tab px-3 py-2 text-[11px] font-medium cursor-not-allowed border-r border-(--border-color)/80 transition-colors duration-150"
              :class="i === 0 ? 'sd-console-tab-active text-(--text-primary)' : 'text-(--text-secondary) opacity-70'">
              <i :class="[tab.icon, 'mr-1.5 text-[13px] align-text-bottom opacity-90']" aria-hidden="true" />
              {{ tab.label }}
            </button>
          </div>
          <div
            class="selectable flex-1 min-h-0 flex flex-col sd-terminal p-2 font-mono text-[11px] leading-relaxed overflow-y-auto scrollbar-thin">
            <p class="sd-log-line">
              <span class="sd-log-ts">[00:00:00]</span>
              <span class="sd-log-lvl sd-log-info"> INFO</span>
              <span class="text-(--text-secondary)"> SimDebug shell ready (placeholder).</span>
            </p>
            <p class="sd-log-line">
              <span class="sd-log-ts">[00:00:00]</span>
              <span class="sd-log-lvl sd-log-warn"> WARN</span>
              <span class="text-(--text-secondary)"> No simulation engine attached.</span>
            </p>
            <p class="sd-log-line">
              <span class="sd-log-ts">[00:00:00]</span>
              <span class="sd-log-lvl sd-log-err"> ERR</span>
              <span class="text-(--text-secondary)"> Example error line (placeholder).</span>
            </p>
          </div>
        </footer>
      </SplitterPanel>
    </Splitter>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import SimDebugFsmView from '@/components/SimDebugFsmView.vue'
import SimDebugMonacoEditor from '@/components/SimDebugMonacoEditor.vue'
import SimDebugSchematicView from '@/components/SimDebugSchematicView.vue'
import SimDebugSurferWaveform from '@/components/SimDebugSurferWaveform.vue'

const router = useRouter()

let isResizing = false

const handleMouseDown = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  const gutter = target.closest('.p-splitter-gutter')
  if (gutter) {
    isResizing = true
    document.body.classList.add('splitter-resizing')

    const splitter = gutter.closest('.p-splitter')
    if (splitter?.classList.contains('p-splitter-vertical')) {
      document.body.classList.add('splitter-resizing-vertical')
    }

    window.getSelection()?.removeAllRanges()
  }
}

const handleMouseUp = () => {
  if (isResizing) {
    isResizing = false
    document.body.classList.remove('splitter-resizing')
    document.body.classList.remove('splitter-resizing-vertical')
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleMouseDown)
  document.addEventListener('mouseup', handleMouseUp)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleMouseDown)
  document.removeEventListener('mouseup', handleMouseUp)
  document.body.classList.remove('splitter-resizing')
  document.body.classList.remove('splitter-resizing-vertical')
})

const goBack = () => {
  router.push('/')
}

const toolbarSecondary = [
  { label: 'Pause', icon: 'ri-pause-line', title: 'Simulation not connected' },
  { label: 'Stop', icon: 'ri-stop-line', title: 'Simulation not connected' },
  { label: 'Step', icon: 'ri-skip-forward-line', title: 'Simulation not connected' },
  { label: 'Restart', icon: 'ri-restart-line', title: 'Simulation not connected' },
  { label: 'Breakpoints', icon: 'ri-bug-line', title: 'Simulation not connected' },
  { label: 'Config', icon: 'ri-settings-3-line', title: 'Simulation not connected' },
  { label: 'Log', icon: 'ri-file-list-3-line', title: 'Simulation not connected' },
] as const

/** 左侧栏顶栏 Tab（与参考 UI 两行布局一致） */
const leftTabsRow1 = [
  { id: 'signals', label: 'Signals' },
  { id: 'hierarchy', label: 'Hierarchy' },
  { id: 'breakpoints', label: 'Breakpoints' },
] as const
const leftTabsRow2 = [
  { id: 'search', label: 'Search' },
  { id: 'coverage', label: 'Coverage' },
] as const

type LeftTabId = (typeof leftTabsRow1)[number]['id'] | (typeof leftTabsRow2)[number]['id']

const activeLeftTab = ref<LeftTabId>('signals')
const signalFilter = ref('')
const selectedSignalName = ref('state[2:0]')

type SignalDot = 'grey' | 'orange' | 'purple' | 'green' | 'cyan' | 'pink' | 'coral'

type SignalGroupMock = {
  id: string
  name: string
  count: number
  items: { name: string; dot: SignalDot }[]
}

/** Mock：分组信号树（后续可换 API） */
const signalGroupsMock: SignalGroupMock[] = [
  {
    id: 'system',
    name: 'System',
    count: 2,
    items: [
      { name: 'clk', dot: 'grey' },
      { name: 'rst_n', dot: 'orange' },
    ],
  },
  {
    id: 'fsm',
    name: 'FSM',
    count: 1,
    items: [{ name: 'state[2:0]', dot: 'purple' }],
  },
  {
    id: 'axi_w_addr',
    name: 'AXI-W Addr',
    count: 3,
    items: [
      { name: 'awvalid', dot: 'green' },
      { name: 'awready', dot: 'green' },
      { name: 'awaddr[31:0]', dot: 'green' },
    ],
  },
  {
    id: 'axi_w_data',
    name: 'AXI-W Data',
    count: 3,
    items: [
      { name: 'wvalid', dot: 'cyan' },
      { name: 'wready', dot: 'cyan' },
      { name: 'wdata[31:0]', dot: 'cyan' },
    ],
  },
  {
    id: 'axi_w_resp',
    name: 'AXI-W Resp',
    count: 3,
    items: [
      { name: 'bvalid', dot: 'pink' },
      { name: 'bready', dot: 'pink' },
      { name: 'bresp[1:0]', dot: 'coral' },
    ],
  },
]

const expandedSignalGroups = ref<Record<string, boolean>>({})

function toggleSignalGroup(id: string) {
  const open = expandedSignalGroups.value[id] !== false
  expandedSignalGroups.value[id] = !open
}

const filteredSignalGroups = computed(() => {
  const q = signalFilter.value.trim().toLowerCase()
  return signalGroupsMock
    .map((g) => ({
      ...g,
      items: g.items.filter((s) => !q || s.name.toLowerCase().includes(q)),
    }))
    .filter((g) => g.items.length > 0)
})

function signalDotClass(dot: SignalDot): string {
  const map: Record<SignalDot, string> = {
    grey: 'bg-slate-400',
    orange: 'bg-orange-400',
    purple: 'bg-violet-500',
    green: 'bg-emerald-500',
    cyan: 'bg-cyan-400',
    pink: 'bg-pink-400',
    coral: 'bg-orange-300',
  }
  return map[dot] ?? 'bg-slate-500'
}

const leftTabPlaceholder = computed(() => {
  const labels: Record<string, string> = {
    hierarchy: '层次结构（模块树）为占位，后续接入设计层次与实例浏览。',
    breakpoints: '断点列表为占位，后续接入仿真断点协议。',
    search: '全局搜索为占位，后续支持实例 / 信号 / 端口检索。',
    coverage: '覆盖率为占位，后续接入覆盖率数据库与跳转。',
  }
  return labels[activeLeftTab.value] ?? ''
})

const centerTiles = [
  {
    id: 'src',
    title: 'Source Code',
    body: '',
  },
  {
    id: 'wave',
    title: 'Waveform',
    body: '',
  },
  {
    id: 'sch',
    title: 'Schematic',
    body: '',
  },
  {
    id: 'fsm',
    title: 'FSM View',
    body: '',
  },
] as const

const waveTile = computed(() => centerTiles[1])
const centerRow2 = computed(() => centerTiles.slice(2, 4))

/** 右侧栏：Properties / X-State / Protocol */
const rightTabs = [
  { id: 'properties', label: 'Properties', icon: 'ri-bar-chart-horizontal-line' },
  { id: 'xstate', label: 'X-State', icon: 'ri-error-warning-line' },
  { id: 'protocol', label: 'Protocol', icon: 'ri-file-list-3-line' },
] as const

type RightTabId = (typeof rightTabs)[number]['id']

const activeRightTab = ref<RightTabId>('properties')

type PropTransition = { ns: number; value: string; isX?: boolean }

type PropertyPanelModel = {
  signalName: string
  fullPath: string
  width: string
  type: string
  format: string
  group: string
  cursorNs: number
  cursorValue: string
  transitions: PropTransition[]
  activeTransitionNs: number | null
}

const PROPERTY_MOCK_BY_SIGNAL: Record<string, PropertyPanelModel> = {
  'state[2:0]': {
    signalName: 'state[2:0]',
    fullPath: 'tb.dut.state',
    width: '3 bits',
    type: 'reg [2:0]',
    format: 'HEX',
    group: 'FSM',
    cursorNs: 270,
    cursorValue: 'X',
    transitions: [
      { ns: 120, value: '0' },
      { ns: 200, value: '1' },
      { ns: 220, value: '2' },
      { ns: 270, value: 'X', isX: true },
      { ns: 295, value: '3' },
      { ns: 315, value: '0' },
    ],
    activeTransitionNs: 270,
  },
}

function propertyPanelForSignal(name: string): PropertyPanelModel {
  if (!name.trim()) {
    return {
      signalName: '（未选择）',
      fullPath: '—',
      width: '—',
      type: '—',
      format: 'HEX',
      group: '—',
      cursorNs: 0,
      cursorValue: '—',
      transitions: [],
      activeTransitionNs: null,
    }
  }
  if (PROPERTY_MOCK_BY_SIGNAL[name]) {
    return { ...PROPERTY_MOCK_BY_SIGNAL[name] }
  }
  return {
    signalName: name,
    fullPath: '—',
    width: '—',
    type: '—',
    format: 'HEX',
    group: '—',
    cursorNs: 0,
    cursorValue: '—',
    transitions: [],
    activeTransitionNs: null,
  }
}

const propertyPanel = computed(() => propertyPanelForSignal(selectedSignalName.value))

const rightSecondaryTabHint = computed(() => {
  const map: Record<string, string> = {
    xstate: 'X 态传播与源头分析为占位，后续接入仿真结果。',
    protocol: '协议事务解析为占位，后续接入 AXI 等解码器。',
  }
  return map[activeRightTab.value] ?? ''
})

const bottomTabs = [
  { id: 'log', label: 'Log', icon: 'ri-terminal-box-line' },
  { id: 'debug', label: 'Debug Console', icon: 'ri-code-s-slash-line' },
  { id: 'errors', label: 'Problems', icon: 'ri-error-warning-fill' },
] as const
</script>

<style scoped>
/* Unified header: single bottom edge + subtle top highlight */
.sd-header-unified {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045);
}

/* 左侧栏 Signals：顶栏 Tab 下划线 */
.sd-left-tab {
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.sd-left-tab--active {
  border-bottom-color: #38bdf8;
}

/* 右侧 Properties 顶栏 Tab */
.sd-right-tab {
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.sd-right-tab--active {
  border-bottom-color: #38bdf8;
}

/* —— SimDebug 外壳（中间 2×2 区域未改） —— */
.sd-mono {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}

.sd-tb-primary {
  color: #ecfdf5;
  background: linear-gradient(180deg, #059669 0%, #047857 100%);
  border: 1px solid rgba(16, 185, 129, 0.45);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2) inset;
}

.sd-tb-secondary {
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-primary) 88%, transparent);
  border: 1px solid rgba(128, 128, 128, 0.12);
}

.sd-console-tab-active {
  background: color-mix(in srgb, var(--bg-primary) 70%, #0c1220);
  border-bottom: 2px solid var(--accent-color) !important;
  margin-bottom: -1px;
}

.sd-terminal {
  background: rgba(13, 17, 23, 0.72);
  color: var(--text-secondary);
}

.dark .sd-terminal {
  background: rgba(10, 14, 20, 0.9);
}

.sd-log-line {
  margin: 0 0 0.35rem;
}

.sd-log-ts {
  color: var(--text-secondary);
  opacity: 0.75;
}

.sd-log-info {
  color: #38bdf8;
}

.sd-log-warn {
  color: #fbbf24;
}

.sd-log-err {
  color: #f87171;
}

.sim-debug-root :deep(.p-splitter) {
  background: transparent;
  border: none;
  contain: layout style;
}

.sim-debug-root :deep(.p-splitter-panel) {
  contain: layout style paint;
  min-width: 0;
  overflow: hidden;
}

.sim-debug-root :deep(.p-splitter-gutter) {
  background: var(--border-color);
  transition: background-color 0.15s ease-out;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sim-debug-root :deep(.p-splitter-gutter:hover) {
  background: var(--accent-color);
  opacity: 0.5;
}

.sim-debug-root :deep(.p-splitter-gutter-handle) {
  display: none !important;
}

.sim-debug-root :deep(.p-splitter-horizontal > .p-splitter-gutter) {
  width: 2px !important;
  cursor: col-resize;
}

.sim-debug-root :deep(.p-splitter-vertical > .p-splitter-gutter) {
  height: 2px !important;
  cursor: row-resize;
}

@media (prefers-reduced-motion: reduce) {
  .sd-console-tab,
  .sd-back,
  .sd-toolbar button {
    transition: none !important;
  }
}
</style>
