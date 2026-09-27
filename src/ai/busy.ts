/**
 * AI 忙碌计数。
 * 请求是排队执行的，可能同时有解读、复盘、题库整理在等；
 * 用计数而不是布尔，避免先完成的那次把「正在忙」提前熄掉。
 */
import { state } from "@/store";

let running = 0;

export function beginAi(): void {
  running++;
  state.aiRunning = true;
}

export function endAi(): void {
  running = Math.max(0, running - 1);
  state.aiRunning = running > 0;
}
