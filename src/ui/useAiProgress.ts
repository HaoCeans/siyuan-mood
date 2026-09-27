/**
 * AI 解读期间的轮播文案。
 * 一次解读要等好几秒，光转圈会让人怀疑是不是卡住了；换成「正在读你的回答 → 正在找关键词 → 正在想可以做什么」，
 * 等待就有了进展感，也顺带说明了 AI 在读什么。
 */
import { computed, onUnmounted, ref, watch, type Ref } from "vue";
import { t } from "@/plugin";

const DEFAULT_STEPS = ["aiStepRead", "aiStepKeywords", "aiStepAdvice"];

export function useAiProgress(
  active: Ref<boolean> | (() => boolean),
  steps: string[] = DEFAULT_STEPS,
  interval = 2600,
) {
  const index = ref(0);
  let timer: number | undefined;

  const stop = (): void => {
    if (timer) window.clearInterval(timer);
    timer = undefined;
  };

  const start = (): void => {
    stop();
    index.value = 0;
    timer = window.setInterval(() => {
      index.value = (index.value + 1) % steps.length;
    }, interval);
  };

  watch(active, (on) => (on ? start() : stop()), { immediate: true });
  onUnmounted(stop);

  return computed(() => t(steps[index.value] || steps[0]));
}
