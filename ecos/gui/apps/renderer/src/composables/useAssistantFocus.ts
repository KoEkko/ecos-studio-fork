import { readonly, ref } from 'vue'

/**
 * StatusBar 等全局入口要跳到 Assistant 的 LiveBlock 时发一次信号。
 * AgentPanel 监听并滚到 feed 顶部。数值单调递增，避免丢重复点击。
 */
const focusToken = ref(0)

export function requestAssistantFocus(): void {
  focusToken.value += 1
}

export function useAssistantFocus() {
  return { focusToken: readonly(focusToken) }
}
