<template>
  <div :class="['home-view', { 'layout-fullscreen-active': isLayoutFullscreen }]">
    <Splitter class="home-splitter" :gutterSize="6">
      <!-- ================= 左栏：设计信息 ================= -->
      <SplitterPanel :size="58" :minSize="30" class="home-panel">
        <div class="home-info-column">
          <div class="home-info-grid">
            <section class="section-card design-area">
              <div class="section-header">
                <h2>{{ config.design || 'Design' }}</h2>
                <span class="header-badge" v-if="config.pdk">{{ config.pdk }}</span>
                <div class="header-actions">
                  <button
                    class="action-btn"
                    @click="toggleLayoutFullscreen"
                    :title="isLayoutFullscreen ? 'Exit full screen' : 'Full screen'"
                  >
                    <i
                      :class="
                        isLayoutFullscreen
                          ? 'ri-fullscreen-exit-line'
                          : 'ri-fullscreen-line'
                      "
                    ></i>
                  </button>
                </div>
              </div>

              <div class="design-body">
                <dl class="info-grid">
                  <div class="info-item">
                    <dt>Top module</dt>
                    <dd class="mono">{{ config.topModule || '--' }}</dd>
                  </div>
                  <div class="info-item">
                    <dt>Clock</dt>
                    <dd>{{ config.clock || '--' }}</dd>
                  </div>
                  <div class="info-item">
                    <dt>Target freq.</dt>
                    <dd>
                      {{ config.frequencyMax || '--' }}<span class="unit">MHz</span>
                    </dd>
                  </div>
                  <div class="info-item">
                    <dt>Utilization</dt>
                    <dd>{{ ((config.core?.utilization || 0) * 100).toFixed(0) }}%</dd>
                  </div>
                  <div class="info-item">
                    <dt>Die size</dt>
                    <dd class="mono">{{ config.die?.Size.join(' × ') || '--' }}</dd>
                  </div>
                  <div class="info-item">
                    <dt>Core size</dt>
                    <dd class="mono">{{ config.core?.Size.join(' × ') || '--' }}</dd>
                  </div>
                  <div class="info-item">
                    <dt>Layers</dt>
                    <dd>{{ config.bottomLayer }} – {{ config.topLayer }}</dd>
                  </div>
                </dl>

                <div class="design-layout">
                  <span class="design-layout-label">Layout · final step</span>
                  <div class="layout-content">
                    <img
                      v-if="layoutBlobUrl"
                      :src="layoutBlobUrl"
                      alt="Layout Preview"
                      class="layout-image"
                      draggable="false"
                    />
                    <div v-else class="layout-placeholder">
                      <i class="ri-image-2-line"></i>
                      <p>Run the flow to generate a layout</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <HomeChecklistSummaryCard :items="checklistItems" />

            <HomeQorSummaryCard
              :overall-score="qorOverallScore"
              :gate-status="qorGateStatus"
              :blocking-issues="qorBlockingIssues"
              :gate-tally="qorGateTally"
              :loading="qorMetricsLoading"
              :error="qorMetricsError"
            />

            <HomeMetricsSnapshotCard
              :tiles="qorMetricTiles"
              :charts="analysisCharts"
              :loading="qorMetricsLoading"
              :error="qorMetricsError"
              :has-metrics="hasQorMetrics"
              @preview="onAnalysisChartClick"
            />
          </div>
        </div>
      </SplitterPanel>

      <!-- ================= 右栏：Agent ================= -->
      <SplitterPanel :size="42" :minSize="25" class="home-panel">
        <AgentPanel />
      </SplitterPanel>
    </Splitter>

    <!-- ===== Layout Fullscreen Overlay ===== -->
    <Teleport to="body">
      <Transition name="lightbox">
        <div
          v-if="isLayoutFullscreen"
          class="layout-fullscreen-overlay"
          @click="closeLayoutFullscreen"
        >
          <section class="section-card layout-fullscreen-card" @click.stop>
            <div class="section-header section-header--divided">
              <h2>Layout</h2>
              <span class="header-hint">Scroll to zoom, drag to pan</span>
              <div class="header-actions">
                <button
                  class="action-btn"
                  @click="closeLayoutFullscreen"
                  title="Exit full screen"
                >
                  <i class="ri-fullscreen-exit-line"></i>
                </button>
              </div>
            </div>
            <div
              ref="layoutContentRef"
              class="layout-content layout-fullscreen-content"
              @wheel.prevent="onLayoutWheel"
              @mousedown="onLayoutMouseDown"
              @mousemove="onLayoutMouseMove"
              @mouseup="onLayoutMouseUp"
              @mouseleave="onLayoutMouseUp"
            >
              <img
                v-if="layoutBlobUrl"
                :src="layoutBlobUrl"
                alt="Layout Preview"
                class="layout-image layout-fullscreen-image"
                :style="layoutImageTransform"
                draggable="false"
              />
              <div v-else class="layout-placeholder">
                <i class="ri-image-2-line"></i>
                <p>Layout Preview</p>
                <span>Waiting for layout data...</span>
              </div>
              <div v-if="layoutBlobUrl" class="zoom-indicator">
                {{ Math.round(layoutScale * 100) }}%
              </div>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>

    <!-- ===== 图表预览 Lightbox ===== -->
    <Teleport to="body">
      <Transition name="lightbox">
        <div
          v-if="chartPreview.visible"
          class="chart-lightbox-overlay"
          @click="closeChartPreview"
        >
          <div class="chart-lightbox-content" @click.stop>
            <div class="chart-lightbox-header">
              <span class="chart-lightbox-title">{{ chartPreview.label }}</span>
              <button class="chart-lightbox-close" @click="closeChartPreview">
                <i class="ri-close-line"></i>
              </button>
            </div>
            <div class="chart-lightbox-body">
              <img :src="chartPreview.url" :alt="chartPreview.label" />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import AgentPanel from '@/components/AgentPanel.vue'
import HomeChecklistSummaryCard from '@/components/HomeChecklistSummaryCard.vue'
import HomeMetricsSnapshotCard from '@/components/HomeMetricsSnapshotCard.vue'
import HomeQorSummaryCard from '@/components/HomeQorSummaryCard.vue'
import { useParameters } from '@/composables/useParameters'
import { useHomeData, type AnalysisChartItem } from '@/composables/useHomeData'
import { useHomeQorMetrics } from '@/composables/useHomeQorMetrics'

const { config } = useParameters()
const {
  metricTiles: qorMetricTiles,
  hasMetrics: hasQorMetrics,
  overallScore: qorOverallScore,
  gateStatus: qorGateStatus,
  blockingIssues: qorBlockingIssues,
  gateTally: qorGateTally,
  isLoading: qorMetricsLoading,
  error: qorMetricsError,
} = useHomeQorMetrics()
const { checklistItems, layoutBlobUrl, analysisCharts } = useHomeData()

// QoR freshness is owned by workspace-observation (step-advance / run-finished / poll).

// ============ Layout 全屏 & 缩放平移 ============
const layoutContentRef = ref<HTMLElement>()
const isLayoutFullscreen = ref(false)

const layoutScale = ref(1)
const layoutTranslateX = ref(0)
const layoutTranslateY = ref(0)
// isDragging 必须是 ref，否则 layoutImageTransform 的 computed 不会在拖动时重算，
// cursor 会卡在 'grab' 上。
const isDragging = ref(false)
let dragStartX = 0
let dragStartY = 0
let dragStartTX = 0
let dragStartTY = 0

const layoutImageTransform = computed(() => {
  if (!isLayoutFullscreen.value) return {}
  return {
    transform: `translate(${layoutTranslateX.value}px, ${layoutTranslateY.value}px) scale(${layoutScale.value})`,
    transformOrigin: 'center center',
    cursor: isDragging.value ? 'grabbing' : layoutScale.value > 1 ? 'grab' : 'default',
    // 拖动时关闭 transition：每帧 mousemove 都会设置新 transform，
    // 留着 transition 反而让手感"延迟一帧"
    transition: isDragging.value ? 'none' : undefined,
    willChange: 'transform',
  }
})

function resetLayoutTransform() {
  layoutScale.value = 1
  layoutTranslateX.value = 0
  layoutTranslateY.value = 0
}

function toggleLayoutFullscreen() {
  isLayoutFullscreen.value = !isLayoutFullscreen.value
  if (!isLayoutFullscreen.value) {
    resetLayoutTransform()
  }
}

function closeLayoutFullscreen() {
  if (!isLayoutFullscreen.value) return
  isLayoutFullscreen.value = false
  resetLayoutTransform()
}

function onFullscreenKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (chartPreview.value.visible) {
    closeChartPreview()
    e.preventDefault()
    return
  }
  if (isLayoutFullscreen.value) {
    closeLayoutFullscreen()
    e.preventDefault()
  }
}

function onLayoutWheel(e: WheelEvent) {
  if (!isLayoutFullscreen.value) return

  const delta = e.deltaY > 0 ? -0.1 : 0.1
  const newScale = Math.min(Math.max(layoutScale.value + delta, 0.1), 20)

  // 以鼠标位置为中心缩放
  const container = layoutContentRef.value
  if (container) {
    const rect = container.getBoundingClientRect()
    const mouseX = e.clientX - rect.left - rect.width / 2
    const mouseY = e.clientY - rect.top - rect.height / 2

    const scaleFactor = newScale / layoutScale.value
    layoutTranslateX.value = mouseX - scaleFactor * (mouseX - layoutTranslateX.value)
    layoutTranslateY.value = mouseY - scaleFactor * (mouseY - layoutTranslateY.value)
  }

  layoutScale.value = newScale
}

function onLayoutMouseDown(e: MouseEvent) {
  if (!isLayoutFullscreen.value || layoutScale.value <= 1) return
  isDragging.value = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragStartTX = layoutTranslateX.value
  dragStartTY = layoutTranslateY.value
}

function onLayoutMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  layoutTranslateX.value = dragStartTX + (e.clientX - dragStartX)
  layoutTranslateY.value = dragStartTY + (e.clientY - dragStartY)
}

function onLayoutMouseUp() {
  isDragging.value = false
}

onMounted(() => {
  document.addEventListener('keydown', onFullscreenKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onFullscreenKeydown)
})

// ============ 指标图表预览 Lightbox ============
const chartPreview = ref<{ visible: boolean; url: string; label: string }>({
  visible: false,
  url: '',
  label: '',
})

function onAnalysisChartClick(chart: AnalysisChartItem) {
  if (!chart.imageBlobUrl) return
  chartPreview.value = { visible: true, url: chart.imageBlobUrl, label: chart.label }
}

function closeChartPreview() {
  chartPreview.value.visible = false
}
</script>

<style scoped src="@/components/sectionCard.css"></style>

<style scoped>
/* ==================== 基础布局 ==================== */
.home-view {
  height: 100%;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  box-sizing: border-box;
  background: var(--bg-primary);
}

/* ==================== 两列布局 ==================== */
.home-splitter {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  background: transparent;
  border: none;
  border-radius: 0;
}

.home-splitter :deep(.p-splitterpanel.home-panel) {
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.home-splitter :deep(.p-splitterpanel.home-panel) > * {
  flex: 1;
  min-width: 0;
}

/*
 * 左栏是一屏到底的看板：五张卡片按 2×2＋1 排布，行高按比例分配，
 * 卡片内部只放摘要，明细一律走底部面板。堆叠成一列再滚动的版本
 * 会让用户为了看一眼 QoR 分数先滚过一张版图。
 */
.home-info-column {
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.home-info-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  /*
   * 前两行按内容定高，富余高度全部交给最后一行的 Snapshot，由其中的图表网格吃掉。
   * 按 fr 平摊给每一行会把参数、圆环这些定长内容抻开；Snapshot 内的缩略图则会随高度
   * 等比放大并在白底 plate 内居中，而不是只占底部一条。
   */
  grid-template-rows: min-content min-content minmax(0, 1fr);
  gap: 8px;
  height: 100%;
  box-sizing: border-box;
}

.home-info-grid > .design-area,
.home-info-grid > .snapshot-card {
  grid-column: 1 / -1;
}

/* Splitter 拖拽条：窄、低调，hover 时变为主题色 */
.home-splitter :deep(.p-splitter-gutter) {
  width: 6px;
  background: transparent;
  position: relative;
  transition: background 0.15s ease;
}

.home-splitter :deep(.p-splitter-gutter::after) {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 48px;
  transform: translate(-50%, -50%);
  background: var(--border-color);
  border-radius: 2px;
  transition: background 0.15s ease;
}

.home-splitter :deep(.p-splitter-gutter:hover::after),
.home-splitter :deep(.p-splitter-gutter[data-p-gutter-resizing='true']::after) {
  background: var(--accent-color);
}

.home-splitter :deep(.p-splitter-gutter-handle) {
  display: none;
}

/* ==================== Design ==================== */
/*
 * Configuration and layout share one card because they answer the same question:
 * what is this chip. As two cards they sat side by side in one grid row, which forced
 * a seven-item list to match the height of a square image — that mismatch was the
 * empty lower half of the info card, not anything missing from the content.
 */
.design-body {
  display: grid;
  /*
   * 版图列可伸缩，由它吃掉富余宽度，而不是让富余堆成参数与版图之间的一条间隙。
   * 上限 280 是因为井是正方的：宽度涨多少高度就涨多少，再宽下去卡片会高过参数
   * 那一侧一大截，横向的空反而变成纵向的空。
   */
  grid-template-columns: minmax(0, 1fr) minmax(200px, 280px);
  gap: 16px;
  padding: 0 14px 12px;
  min-height: 0;
}

/*
 * Label/value pairs, no boxes. Eight bordered tiles inside a bordered card inside a
 * bordered panel was three frames deep for what is really just a definition list.
 */
/*
 * Two columns, so the seven pairs run four rows deep and stand as tall as the
 * thumbnail beside them. Spread wider they collapse to two or three rows and the
 * card's height comes entirely from the image, which is what strands the parameters
 * in the middle of an over-tall row. The columns stretch rather than being capped:
 * whatever width is left over trails inside the second column instead of collecting
 * into a visible gutter against the image.
 */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: center;
  gap: 16px;
  margin: 0;
  min-width: 0;
  overflow: hidden;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

/*
 * Sized up from 10/13px: seven pairs spread over the full card width read as empty
 * space at that scale. These are the parameters the whole run was configured with,
 * so they can carry the weight — filling the column is cheaper than inventing
 * content to fill it with.
 */
.info-item dt {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  opacity: 0.75;
  white-space: nowrap;
}

.info-item dd {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-item dd.mono {
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 14px;
}

.info-item .unit {
  margin-left: 3px;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-secondary);
}

/* ==================== Layout Preview ==================== */
/*
 * A glance-level thumbnail, not the subject of the page: full screen is one click
 * away in the header, so this only has to be big enough to confirm the shape came
 * out right. Square well because the die usually is; object-fit handles the rest.
 */
.design-layout {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.design-layout-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-secondary);
  opacity: 0.75;
  white-space: nowrap;
}

.design-layout .layout-content {
  flex: 0 0 auto;
  aspect-ratio: 1;
  margin: 0;
}

.layout-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Recessed neutral well: the layout renders in saturated colour, so the frame
     around it must not add any of its own. */
  background: color-mix(in srgb, var(--text-secondary) 6%, var(--bg-primary));
  margin: 0 10px 10px;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);
  overflow: hidden;
  position: relative;
}

.layout-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: var(--text-secondary);
}

.layout-placeholder i {
  font-size: 26px;
  opacity: 0.35;
}

.layout-placeholder p {
  font-size: 12px;
  margin: 0;
  opacity: 0.7;
}

.layout-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  /* 让浏览器尽量为这张图建立独立合成层，resize 时不会反复重采样 */
  will-change: transform;
}

/* ==================== Layout 全屏 ==================== */
.layout-fullscreen-overlay {
  position: fixed;
  inset: 0;
  z-index: 19990;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  padding: 12px;
  background: rgba(0, 0, 0, 0.78);
  box-sizing: border-box;
}

.layout-fullscreen-card {
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: var(--bg-primary);
}

.layout-fullscreen-card .layout-content {
  height: auto;
  margin: 0;
  border: none;
  border-radius: 0;
  overflow: hidden;
  position: relative;
}

.layout-fullscreen-image {
  object-fit: contain;
  /*
   * 仅在滚轮缩放时给 50ms 缓动，拖动时由 inline style 设为 'none'，
   * 避免 transition 打断每帧 mousemove 造成视觉拖尾。
   */
  transition: transform 0.05s ease-out;
  user-select: none;
  will-change: transform;
}

.zoom-indicator {
  position: absolute;
  bottom: 12px;
  right: 12px;
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.6);
  color: #e5e5e5;
  font-size: 11px;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  border-radius: 4px;
  pointer-events: none;
  z-index: 10;
}

/* ==================== 指标图表预览 Lightbox ==================== */
.chart-lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 20000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.72);
  box-sizing: border-box;
}

.chart-lightbox-content {
  max-width: min(96vw, 1200px);
  max-height: min(90vh, 900px);
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.35);
}

.chart-lightbox-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.chart-lightbox-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-lightbox-close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.chart-lightbox-close:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.chart-lightbox-body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #ffffff;
}

.chart-lightbox-body img {
  max-width: 100%;
  max-height: min(80vh, 820px);
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}

.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.2s ease;
}

.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}

.lightbox-enter-active .chart-lightbox-content,
.lightbox-leave-active .chart-lightbox-content {
  transition: transform 0.2s ease;
}

.lightbox-enter-from .chart-lightbox-content,
.lightbox-leave-to .chart-lightbox-content {
  transform: scale(0.96);
}
</style>
