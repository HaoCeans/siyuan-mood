/** AI 解读：组装提示词 → 调用内核 AI → 解析 JSON → 写回记录 */
import { buildAnalysisPrompt, buildReportPrompt, parseAnalysis } from "@/ai/prompts";
import { askSiyuanAi } from "@/ai/siyuanAi";
import { putRecord, saveReport, sortedRecords, state } from "@/store";
import type { QuizRecord } from "@/types/mood";
import { dayStart } from "@/utils/dom";

export interface AnalyzeOutcome {
  ok: boolean;
  /** disabled=设置里关了；empty=未配置 AI；failed=请求失败；parse=返回不是 JSON */
  reason?: "disabled" | "empty" | "failed" | "parse";
  message?: string;
}

/** 取最近几次「已完成解读」的记录作为对比上下文 */
function historyFor(record: QuizRecord, limit: number): QuizRecord[] {
  if (limit <= 0) return [];
  return sortedRecords()
    .filter((r) => r.id !== record.id && r.finishedAt < record.finishedAt && r.ai.status === "done")
    .slice(0, limit)
    .reverse();
}

export async function analyzeRecord(record: QuizRecord): Promise<AnalyzeOutcome> {
  if (!state.settings.ai.enabled) {
    return { ok: false, reason: "disabled", message: "AI 解读已在设置里关闭" };
  }

  record.ai = { status: "running" };
  state.aiRunning = true;
  try {
    const prompt = buildAnalysisPrompt({
      record,
      history: historyFor(record, state.settings.ai.maxContextRecords),
      extra: state.settings.ai.promptExtra,
    });
    const result = await askSiyuanAi(prompt);

    if (!result.ok) {
      const message = result.reason === "empty" ? "尚未在「设置 → AI」中配置模型" : "AI 请求失败，稍后可以重试";
      record.ai = { status: "failed", error: message, raw: result.markdown || undefined, at: Date.now() };
      await putRecord(record);
      return { ok: false, reason: result.reason === "empty" ? "empty" : "failed", message };
    }

    const parsed = parseAnalysis(result.markdown);
    if (!parsed) {
      const message = "AI 返回的内容不是约定的 JSON，已按原文显示";
      record.ai = { status: "failed", error: message, raw: result.markdown, at: Date.now() };
      await putRecord(record);
      return { ok: false, reason: "parse", message };
    }

    // 同一条建议的文本保持不变时，保留已有的跟进结果
    const previous = new Map(record.followUps.map((f) => [f.adviceText, f]));
    record.ai = {
      status: "done",
      mood: parsed.mood,
      keywords: parsed.keywords,
      analysis: parsed.analysis,
      advice: parsed.advice,
      practice: parsed.practice,
      changes: parsed.changes,
      raw: result.markdown,
      at: Date.now(),
    };
    record.followUps = (parsed.advice || []).map(
      (advice) => previous.get(advice.text) || { adviceId: advice.id, adviceText: advice.text, done: "unset" as const },
    );
    await putRecord(record);
    return { ok: true };
  } finally {
    state.aiRunning = false;
  }
}

/** 一段时间的心情卡片（周报/月报） */
export async function generateReport(rangeDays = 30): Promise<AnalyzeOutcome> {
  if (!state.settings.ai.enabled) {
    return { ok: false, reason: "disabled", message: "AI 解读已在设置里关闭" };
  }
  const from = dayStart(Date.now()) - (rangeDays - 1) * 24 * 60 * 60 * 1000;
  const records = sortedRecords().filter((r) => r.finishedAt >= from);
  if (!records.length) {
    return { ok: false, reason: "failed", message: `最近 ${rangeDays} 天还没有记录` };
  }

  state.reportRunning = true;
  try {
    const result = await askSiyuanAi(buildReportPrompt(records, rangeDays));
    if (!result.ok) {
      const message = result.reason === "empty" ? "尚未在「设置 → AI」中配置模型" : "AI 请求失败，稍后可以重试";
      return { ok: false, reason: result.reason === "empty" ? "empty" : "failed", message };
    }
    const parsed = parseAnalysis(result.markdown);
    if (!parsed) {
      await saveReport({ at: Date.now(), rangeDays, analysis: result.markdown, raw: result.markdown });
      return { ok: false, reason: "parse", message: "AI 返回的内容不是约定的 JSON，已按原文显示" };
    }
    await saveReport({
      at: Date.now(),
      rangeDays,
      mood: parsed.mood,
      keywords: parsed.keywords,
      analysis: parsed.analysis,
      advice: parsed.advice,
      practice: parsed.practice,
      raw: result.markdown,
    });
    return { ok: true };
  } finally {
    state.reportRunning = false;
  }
}
