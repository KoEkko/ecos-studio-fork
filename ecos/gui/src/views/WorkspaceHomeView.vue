<template>
  <FrontendHomeView v-if="currentProject?.designTool === 'frontend'" />
  <HomeView v-else />
</template>

<script setup lang="ts">
import { useWorkspace } from '@/composables/useWorkspace'
import FrontendHomeView from './FrontendHomeView.vue'
import HomeView from './HomeView.vue'

const { currentProject } = useWorkspace()
</script>
