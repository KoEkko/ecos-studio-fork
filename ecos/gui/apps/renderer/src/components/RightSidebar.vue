<template>
  <div
    class="border-(--border-color) bg-(--bg-sidebar) flex h-full w-8 shrink-0 flex-col items-center border-l py-4"
  >
    <div
      class="vertical-text text-(--text-secondary) py-4 text-[11px] font-medium tracking-widest"
    >
      Inspector
    </div>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.vertical-text {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}
</style>
