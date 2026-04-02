<template>
  <div ref="containerRef" class="monaco-host h-full min-h-[120px] min-w-0 w-full overflow-hidden" />
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, watch } from 'vue'
import * as monaco from 'monaco-editor'
import { useThemeStore } from '@/stores/themeStore'
import { storeToRefs } from 'pinia'

/** Sample buffer until workspace file API exists */
const SAMPLE_SYSTEMVERILOG = `// SimDebug sample buffer (not connected to project files yet)
module counter #(
  parameter int WIDTH = 8
) (
  input  logic             clk,
  input  logic             rst_n,
  output logic [WIDTH-1:0] count
);
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n)
      count <= '0;
    else
      count <= count + 1'b1;
  end
endmodule
`

const containerRef = ref<HTMLElement | null>(null)
const editorRef = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null)
const themeStore = useThemeStore()
const { themeName } = storeToRefs(themeStore)

function monacoThemeId(): string {
  return themeStore.isDark() ? 'vs-dark' : 'vs'
}

onMounted(() => {
  const el = containerRef.value
  if (!el) return

  const editor = monaco.editor.create(el, {
    value: SAMPLE_SYSTEMVERILOG,
    language: 'systemverilog',
    theme: monacoThemeId(),
    automaticLayout: true,
    minimap: { enabled: true, scale: 0.85 },
    fontSize: 12,
    scrollBeyondLastLine: false,
    tabSize: 2,
    wordWrap: 'on',
    padding: { top: 4, bottom: 4 },
  })
  editorRef.value = editor
})

watch(themeName, () => {
  monaco.editor.setTheme(monacoThemeId())
})

onBeforeUnmount(() => {
  editorRef.value?.dispose()
  editorRef.value = null
})
</script>

<style scoped>
.monaco-host :deep(.monaco-editor),
.monaco-host :deep(.monaco-editor-background) {
  border-radius: 0;
}
</style>
