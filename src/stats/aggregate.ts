/** 统计聚合：曲线的数据点、移动平均、概览指标、关键词频次、日历热力、CSV */
import type { Dimension, KeywordCount, MoodPoint, MoodSummary, QuizRecord } from "@/types/mood";
import { DIMENSIONS } from "@/types/mood";
import { average, dayStart, formatDateTime, stdDev } from "@/utils/dom";

const DAY = 24 * 60 * 60 * 1000;

/** days = 0 表示全部 */
export function inRange(records: QuizRecord[], days: number): QuizRecord[] {
  if (!days) return records.slice();
  const from = dayStart(Date.now()) - (days - 1) * DAY;
  return records.filter((r) => r.finishedAt >= from);
}

export function moodPoints(records: QuizRecord[]): MoodPoint[] {
  return records
    .slice()
    .sort((a, b) => a.finishedAt - b.finishedAt)
    .map((r) => ({ id: r.id, day: dayStart(r.finishedAt), at: r.finishedAt, score: r.moodScore }));
}

/** 按时间顺序的滑动平均，返回与输入等长的序列 */
export function movingAverage(points: MoodPoint[], window = 7): number[] {
  const result: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const from = Math.max(0, i - window + 1);
    result.push(Math.round(average(points.slice(from, i + 1).map((p) => p.score))));
  }
  return result;
}

export function summarize(records: QuizRecord[], days: number): MoodSummary {
  const current = inRange(records, days).sort((a, b) => b.finishedAt - a.finishedAt);
  const scores = current.map((r) => r.moodScore);
  const length = days || Math.max(1, current.length ? Math.round((Date.now() - current[current.length - 1].finishedAt) / DAY) + 1 : 1);
  const prevFrom = dayStart(Date.now()) - (length * 2 - 1) * DAY;
  const prevTo = dayStart(Date.now()) - (length - 1) * DAY;
  const previous = records.filter((r) => r.finishedAt >= prevFrom && r.finishedAt < prevTo);

  return {
    count: current.length,
    average: Math.round(average(scores)),
    change: previous.length && current.length ? Math.round(average(scores) - average(previous.map((r) => r.moodScore))) : 0,
    volatility: Math.round(stdDev(scores)),
    latest: current[0]?.moodScore,
  };
}

export function dimensionAverages(records: QuizRecord[]): Partial<Record<Dimension, number>> {
  const result: Partial<Record<Dimension, number>> = {};
  for (const meta of DIMENSIONS) {
    const values = records.map((r) => r.dimensionScores[meta.key]).filter((v): v is number => typeof v === "number");
    if (values.length) result[meta.key] = Math.round(average(values));
  }
  return result;
}

export function keywordCounts(records: QuizRecord[], top = 10): KeywordCount[] {
  const counter = new Map<string, number>();
  for (const record of records) {
    const words = record.ai.keywords?.length ? record.ai.keywords : record.keywordLocal;
    for (const word of words) counter.set(word, (counter.get(word) || 0) + 1);
  }
  return Array.from(counter.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, top);
}

export interface CalendarCell {
  day: number;
  score: number | null;
  count: number;
  future: boolean;
}

/** 近 weeks 周的日历格，每列一周，周一起始 */
export function calendarGrid(records: QuizRecord[], weeks = 12): CalendarCell[][] {
  const byDay = new Map<number, number[]>();
  for (const record of records) {
    const day = dayStart(record.finishedAt);
    const list = byDay.get(day) || [];
    list.push(record.moodScore);
    byDay.set(day, list);
  }

  const today = dayStart(Date.now());
  const todayMondayOffset = (new Date(today).getDay() + 6) % 7;
  const weekEnd = today + (6 - todayMondayOffset) * DAY;
  const start = weekEnd - (weeks * 7 - 1) * DAY;

  const columns: CalendarCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const column: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const day = start + (w * 7 + d) * DAY;
      const scores = byDay.get(day) || [];
      column.push({
        day,
        score: scores.length ? Math.round(average(scores)) : null,
        count: scores.length,
        future: day > today,
      });
    }
    columns.push(column);
  }
  return columns;
}

/** 连续记录天数（含今天或昨天） */
export function streakDays(records: QuizRecord[]): number {
  if (!records.length) return 0;
  const days = new Set(records.map((r) => dayStart(r.finishedAt)));
  let streak = 0;
  let cursor = dayStart(Date.now());
  if (!days.has(cursor)) {
    cursor -= DAY;
    if (!days.has(cursor)) return 0;
  }
  while (days.has(cursor)) {
    streak++;
    cursor -= DAY;
  }
  return streak;
}

export function toCsv(records: QuizRecord[]): string {
  const header = ["日期", "心情分", ...DIMENSIONS.filter((d) => d.scored).map((d) => d.name), "关键词", "建议数", "已跟进", "备注"];
  const escape = (value: unknown): string => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = records
    .slice()
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .map((r) =>
      [
        formatDateTime(r.finishedAt),
        r.moodScore,
        ...DIMENSIONS.filter((d) => d.scored).map((d) => r.dimensionScores[d.key] ?? ""),
        (r.ai.keywords?.length ? r.ai.keywords : r.keywordLocal).join("、"),
        r.followUps.length,
        r.followUps.filter((f) => f.done === "yes" || f.done === "partial").length,
        r.note || "",
      ]
        .map(escape)
        .join(","),
    );
  return `\ufeff${header.map(escape).join(",")}\n${rows.join("\n")}`;
}
