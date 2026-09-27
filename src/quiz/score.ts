/** 计分：维度分、心情分、等级文案、本地关键词 */
import {
  DIMENSION_MAP,
  DIMENSIONS,
  type Dimension,
  type QuizAnswer,
  type QuizQuestion,
} from "@/types/mood";
import { average } from "@/utils/dom";

/** 把一次作答落成快照（题干与选项文案都存下来）；填空题传 text */
export function buildAnswer(question: QuizQuestion, optionIds: string[], text?: string): QuizAnswer {
  const picked = question.options.filter((o) => optionIds.includes(o.id));
  const meta = DIMENSION_MAP[question.dimension];
  // 不计分维度与填空记 -1，避免和「真实得 0 分」混淆
  const score = question.type === "text" || !meta?.scored
    ? -1
    : picked.length
      ? average(picked.map((o) => o.score ?? 0))
      : 0;

  const answer: QuizAnswer = {
    questionId: question.id,
    questionText: question.text,
    dimension: question.dimension,
    type: question.type,
    optionIds: picked.map((o) => o.id),
    optionLabels: picked.map((o) => o.label),
    score: Number(score.toFixed(2)),
    tags: Array.from(new Set(picked.flatMap((o) => o.tags || []))),
  };
  const trimmed = (text || "").trim();
  if (trimmed) answer.text = trimmed;
  return answer;
}

/** 作答在界面上的显示文字：填空题用自己的话，其它用选项 */
export function answerText(answer: QuizAnswer): string {
  return answer.text || answer.optionLabels.join("、") || "—";
}

export interface ScoreSummary {
  dimensionScores: Partial<Record<Dimension, number>>;
  moodScore: number;
  keywordLocal: string[];
}

export function summarizeAnswers(answers: QuizAnswer[]): ScoreSummary {
  const dimensionScores: Partial<Record<Dimension, number>> = {};

  for (const meta of DIMENSIONS) {
    if (!meta.scored) continue;
    const items = answers.filter((a) => a.dimension === meta.key);
    if (!items.length) continue;
    // 每道题满分 3 分，维度分归一化到 0-100
    const total = items.reduce((sum, item) => sum + item.score, 0);
    dimensionScores[meta.key] = Math.round((total / (3 * items.length)) * 100);
  }

  const scoredDims = DIMENSIONS.filter((d) => d.scored && dimensionScores[d.key] !== undefined);
  const weightSum = scoredDims.reduce((sum, d) => sum + d.weight, 0);
  const moodScore = weightSum
    ? Math.round(scoredDims.reduce((sum, d) => sum + (dimensionScores[d.key] as number) * d.weight, 0) / weightSum)
    : 0;

  return { dimensionScores, moodScore, keywordLocal: extractKeywords(answers) };
}

/** 本地关键词：选项 tags 按出现次数排序，AI 未跑或失败时也能显示 */
export function extractKeywords(answers: QuizAnswer[], top = 6): string[] {
  const counter = new Map<string, number>();
  for (const answer of answers) {
    for (const tag of answer.tags) counter.set(tag, (counter.get(tag) || 0) + 1);
  }
  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([word]) => word);
}

export interface MoodLevel {
  /** 80plus / stable / wavy / low / veryLow */
  key: string;
  label: string;
  hint: string;
  color: string;
  background: string;
}

/** 只描述此刻状态，不描述人 */
export function moodLevel(score: number): MoodLevel {
  if (score >= 80) {
    return {
      key: "80plus",
      label: "平稳在线",
      hint: "此刻状态挺好，可以顺手记录一下是什么在支持你。",
      color: "var(--b3-card-success-color)",
      background: "var(--b3-card-success-background)",
    };
  }
  if (score >= 60) {
    return {
      key: "stable",
      label: "大体平稳",
      hint: "有一点起伏，通常不用特别处理。",
      color: "var(--b3-card-info-color)",
      background: "var(--b3-card-info-background)",
    };
  }
  if (score >= 40) {
    return {
      key: "wavy",
      label: "有波动",
      hint: "值得停一停，先看看身体哪里紧着。",
      color: "var(--b3-card-warning-color)",
      background: "var(--b3-card-warning-background)",
    };
  }
  if (score >= 20) {
    return {
      key: "low",
      label: "偏低",
      hint: "先照顾身体，别急着解决问题。",
      color: "var(--b3-card-error-color)",
      background: "var(--b3-card-error-background)",
    };
  }
  return {
    key: "veryLow",
    label: "很低",
    hint: "先安抚自己：慢慢呼吸，喝口水。必要时找信任的人待一会儿。",
    color: "var(--b3-theme-error)",
    background: "var(--b3-card-error-background)",
  };
}

export function scoreOfAnswer(answer: QuizAnswer): string {
  return answer.score < 0 ? "—" : String(Math.round(answer.score));
}
