/** AI 解读：组装提示词 → 调用内核 AI → 解析 JSON → 写回记录 */
import { buildAnalysisPrompt, buildCheckinSuggestionPrompt, buildFollowReviewPrompt, buildReportPrompt, parseAnalysis, parseFollowReview } from "@/ai/prompts";
import { askSiyuanAi } from "@/ai/siyuanAi";
import { beginAi, endAi } from "@/ai/busy";
import { cleanKramdown, getBlockKramdown } from "@/api";
import { putRecord, rememberCheckinSuggestion, saveReport, sortedRecords, state } from "@/store";
import type { CheckIn, QuizRecord } from "@/types/mood";
import { dayStart } from "@/utils/dom";

export interface AnalyzeOutcome {
  ok: boolean;
  /** disabled=设置里关了；empty=未配置 AI；failed=请求失败；parse=返回不是 JSON；nothing=还没有可复盘的内容 */
  reason?: "disabled" | "empty" | "failed" | "parse" | "nothing";
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

/** 绑定块的读数上限：笔记可能很长，超出部分截断 */
const BLOCK_CONTEXT_LIMIT = 6000;

async function loadBoundBlock(record: QuizRecord): Promise<string | undefined> {
  if (!record.boundBlockId) return undefined;
  try {
    const res = await getBlockKramdown(record.boundBlockId);
    const markdown = cleanKramdown(res?.kramdown || "");
    if (!markdown) return undefined;
    return markdown.length > BLOCK_CONTEXT_LIMIT ? `${markdown.slice(0, BLOCK_CONTEXT_LIMIT)}…` : markdown;
  } catch (err) {
    console.error("[mood] read bound block failed", err);
    return undefined;
  }
}

export async function analyzeRecord(record: QuizRecord): Promise<AnalyzeOutcome> {
  if (!state.settings.ai.enabled) {
    return { ok: false, reason: "disabled", message: "AI 解读已在设置里关闭" };
  }

  record.ai = { status: "running" };
  beginAi();
  try {
    const prompt = buildAnalysisPrompt({
      record,
      history: historyFor(record, state.settings.ai.maxContextRecords),
      checkins: state.checkins.filter((c) => c.at <= record.finishedAt).slice(0, 6),
      blockContext: await loadBoundBlock(record),
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

    // 同一条建议的文本保持不变时，保留已有的跟进结果；用户自己写的做法始终留着
    const previous = new Map(record.followUps.map((f) => [f.adviceText, f]));
    const own = record.followUps.filter((f) => f.source === "user");
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
    record.followUps = [
      ...(parsed.advice || []).map(
        (advice) => previous.get(advice.text) || { adviceId: advice.id, adviceText: advice.text, done: "unset" as const },
      ),
      ...own,
    ];
    await putRecord(record);
    return { ok: true };
  } finally {
    endAi();
  }
}

/**
 * 跟进复盘：把「每条建议做了没有 + 做完之后什么感觉」交给 AI 看效果。
 * 这是「建议 → 实际执行 → 调整建议」闭环里当场就能拿到反馈的一环，
 * 不必等下一次做问卷时才被带进提示词。
 */
export async function reviewFollowUps(record: QuizRecord): Promise<AnalyzeOutcome> {
  if (!state.settings.ai.enabled) {
    return { ok: false, reason: "disabled", message: "AI 解读已在设置里关闭" };
  }
  if (!record.followUps.some((f) => f.done !== "unset")) {
    return { ok: false, reason: "nothing", message: "先标一下建议的执行情况，再来复盘" };
  }

  record.followReview = { status: "running" };
  beginAi();
  try {
    const result = await askSiyuanAi(
      buildFollowReviewPrompt(
        record,
        // 测评之后的打卡轨迹：做完建议后状态是好转、持平还是回落，全靠它看
        state.checkins.filter((c) => c.at > record.finishedAt).slice(0, 8).reverse(),
      ),
    );

    if (!result.ok) {
      const message = result.reason === "empty" ? "尚未在「设置 → AI」中配置模型" : "AI 请求失败，稍后可以重试";
      record.followReview = { status: "failed", error: message, raw: result.markdown || undefined, at: Date.now() };
      await putRecord(record);
      return { ok: false, reason: result.reason === "empty" ? "empty" : "failed", message };
    }

    const parsed = parseFollowReview(result.markdown);
    if (!parsed) {
      const message = "AI 返回的内容不是约定的 JSON，已按原文显示";
      record.followReview = { status: "failed", error: message, raw: result.markdown, at: Date.now() };
      await putRecord(record);
      return { ok: false, reason: "parse", message };
    }

    record.followReview = {
      status: "done",
      analysis: parsed.analysis,
      works: parsed.works,
      next: parsed.next,
      raw: result.markdown,
      at: Date.now(),
    };
    await putRecord(record);
    return { ok: true };
  } finally {
    endAi();
  }
}

/** 打卡后的 AI 小建议：短文本，失败返回 null 由调用方退回本地文案 */
export async function fetchCheckinSuggestion(entries: CheckIn[], justNow: CheckIn[]): Promise<string | null> {
  if (!state.settings.ai.enabled) return null;
  const latest = sortedRecords()[0];
  beginAi();
  try {
    const result = await askSiyuanAi(
      buildCheckinSuggestionPrompt({
        entries,
        justNow,
        recent: state.checkinSuggestLog.map((s) => s.text),
        latestScore: latest?.moodScore,
      }),
    );
    if (!result.ok) return null;
    const text = result.markdown.trim();
    if (text) void rememberCheckinSuggestion(text);
    return text || null;
  } catch (err) {
    console.error("[mood] checkin suggestion failed", err);
    return null;
  } finally {
    endAi();
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
    const result = await askSiyuanAi(
      buildReportPrompt(
        records,
        rangeDays,
        // 这段时间的快速打卡（最多 20 条，转成时间正序），补上一天内的起伏细节
        state.checkins.filter((c) => c.at >= from).slice(0, 20).reverse(),
      ),
    );
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
