/**
 * 借用思源内置 AI（内核 /api/ai/chatGPT）。
 *
 * 三个必须遵守的约束，都在这里收口：
 * 1. 内核的会话上下文是进程级全局变量，每次请求前必须先发 "Clear context"，否则会串入别人的历史；
 * 2. 未配置 AI 时内核返回 code 0 且 data 为空，只能按 data 判失败；
 * 3. 请求是内核内部接口，不进插件 API 文档，跨版本可能变，所以异常一律吞掉并降级为 { ok: false }。
 */
import { fetchSyncPost } from "siyuan";

export interface SiyuanAiResult {
  ok: boolean;
  markdown: string;
  /** empty = 未配置 AI 或返回为空；failed = 请求本身出错 */
  reason?: "empty" | "failed";
}

const activeObservers = new Set<MutationObserver>();

function killNativeProgress(): () => void {
  const observer = new MutationObserver(() => {
    document.getElementById("progress")?.remove();
  });
  observer.observe(document.body, { childList: true, subtree: false });
  document.getElementById("progress")?.remove();
  activeObservers.add(observer);
  return () => {
    observer.disconnect();
    activeObservers.delete(observer);
  };
}

/** 插件卸载时统一收尾，避免观察者残留 */
export function disposeAiObservers(): void {
  for (const observer of activeObservers) observer.disconnect();
  activeObservers.clear();
}

async function ask(prompt: string): Promise<SiyuanAiResult> {
  const release = killNativeProgress();
  try {
    await fetchSyncPost("/api/ai/chatGPT", { msg: "Clear context" });
    const resp = await fetchSyncPost("/api/ai/chatGPT", { msg: prompt });
    if (!resp || resp.code !== 0) return { ok: false, markdown: "", reason: "failed" };
    const markdown = typeof resp.data === "string" ? resp.data : String(resp.data ?? "");
    return markdown.trim() ? { ok: true, markdown } : { ok: false, markdown: "", reason: "empty" };
  } catch (err) {
    console.error("[mood] ask siyuan ai failed", err);
    return { ok: false, markdown: "", reason: "failed" };
  } finally {
    release();
  }
}

let chain: Promise<unknown> = Promise.resolve();

/**
 * 串行队列：并发调用会互相冲掉内核的全局上下文，所以排队执行。
 */
export function askSiyuanAi(prompt: string): Promise<SiyuanAiResult> {
  const run = chain.then(() => ask(prompt), () => ask(prompt));
  chain = run.catch(() => undefined);
  return run;
}
