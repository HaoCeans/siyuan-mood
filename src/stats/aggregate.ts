/** 统计聚合：曲线的数据点、移动平均、概览指标、关键词频次、日历热力、CSV */
import type { CheckIn, Dimension, KeywordCount, MoodPoint, MoodSummary, QuizRecord } from "@/types/mood";
import { DIMENSIONS } from "@/types/mood";
import { levelIconFile, wordIconFile } from "@/quiz/emotions";
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

// **************************************** 心情日历（真实月历） ****************************************

export interface CalendarDay {
  /** 当天 0 点时间戳；补位格为 0 */
  day: number;
  dayNum: number;
  inMonth: boolean;
  future: boolean;
  score: number | null;
  count: number;
  /** 当天打卡 / 测评的图标文件名（icons/blob/<file>.svg），最多 2 个 */
  iconFiles: string[];
  /** 当天最后一次打卡记的天气（可能有） */
  weather?: string;
  /** 当天是否有可打开的记录 */
  hasRecord: boolean;
}

export interface CalendarMonth {
  label: string;
  weeks: CalendarDay[][];
}

/** 某一个月的真实月历（周一起始）；offset = 距今往前几个月，0 = 本月 */
export function monthCalendarAt(records: QuizRecord[], checkins: CheckIn[], offset = 0): CalendarMonth {
  const scoresByDay = new Map<number, number[]>();
  for (const record of records) {
    const day = dayStart(record.finishedAt);
    const list = scoresByDay.get(day) || [];
    list.push(record.moodScore);
    scoresByDay.set(day, list);
  }
  const recordDays = new Set(records.map((record) => dayStart(record.finishedAt)));
  const emojiByDay = new Map<number, string[]>();
  const weatherByDay = new Map<number, string>();
  for (const entry of checkins) {
    const day = dayStart(entry.at);
    const file = wordIconFile(entry.word);
    if (!file) continue;
    const list = emojiByDay.get(day) || [];
    if (!list.includes(file) && list.length < 2) list.push(file);
    emojiByDay.set(day, list);
    // 同一天多次打卡时保留最后一次的天气
    if (entry.weather) weatherByDay.set(day, entry.weather);
  }

  const today = dayStart(Date.now());
  const base = new Date();
  const target = new Date(base.getFullYear(), base.getMonth() - offset, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;

  const blank = (): CalendarDay => ({ day: 0, dayNum: 0, inMonth: false, future: false, score: null, count: 0, iconFiles: [], hasRecord: false });
  const weeks: CalendarDay[][] = [];
  let week: CalendarDay[] = Array.from({ length: lead }, blank);

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const day = new Date(year, month, dayNum).getTime();
    const scores = scoresByDay.get(day) || [];
    let iconFiles = emojiByDay.get(day) || [];
    const moodName = records.find((record) => dayStart(record.finishedAt) === day)?.moodName;
    if (moodName && wordIconFile(moodName) && !iconFiles.includes(wordIconFile(moodName)) && iconFiles.length < 2) {
      iconFiles = [...iconFiles, wordIconFile(moodName)];
    }
    if (!iconFiles.length && scores.length) iconFiles = [levelIconFile(Math.round(average(scores)))];
    const weather = weatherByDay.get(day);
    week.push({
      day,
      dayNum,
      inMonth: true,
      future: day > today,
      score: scores.length ? Math.round(average(scores)) : null,
      count: scores.length,
      iconFiles,
      weather,
      hasRecord: recordDays.has(day),
    });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) {
    while (week.length < 7) week.push(blank());
    weeks.push(week);
  }

  return { label: `${year} 年 ${month + 1} 月`, weeks };
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

// **************************************** 星期分布 / 执行率 / 极值 ****************************************

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export interface WeekdayStat {
  /** 0 = 周一 */
  weekday: number;
  label: string;
  avg: number;
  count: number;
}

/** 按星期聚合的平均心情分：找「周几状态最差」这类模式 */
export function weekdayAverages(records: QuizRecord[]): WeekdayStat[] {
  const buckets: number[][] = Array.from({ length: 7 }, () => []);
  for (const record of records) {
    const index = (new Date(record.finishedAt).getDay() + 6) % 7;
    buckets[index].push(record.moodScore);
  }
  return buckets.map((scores, i) => ({
    weekday: i,
    label: WEEKDAY_LABELS[i],
    count: scores.length,
    avg: scores.length ? Math.round(average(scores)) : 0,
  }));
}

export interface FollowupRate {
  total: number;
  done: number;
  percent: number;
}

/** 建议执行率：所有记录里「做了 / 部分做了」的跟进占比 */
export function followupRate(records: QuizRecord[]): FollowupRate {
  let total = 0;
  let done = 0;
  for (const record of records) {
    for (const follow of record.followUps) {
      total++;
      if (follow.done === "yes" || follow.done === "partial") done++;
    }
  }
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

/** 曲线的最低点与最高点 */
export function extremes(points: MoodPoint[]): { low?: MoodPoint; high?: MoodPoint } {
  if (!points.length) return {};
  let low = points[0];
  let high = points[0];
  for (const point of points) {
    if (point.score < low.score) low = point;
    if (point.score > high.score) high = point;
  }
  return { low, high };
}

export function toCsv(records: QuizRecord[]): string {
  const header = ["日期", "心情分", "情绪名称", ...DIMENSIONS.filter((d) => d.scored).map((d) => d.name), "关键词", "身体信号", "自述", "关联块", "建议数", "已跟进", "备注"];
  const escape = (value: unknown): string => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = records
    .slice()
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .map((r) =>
      [
        formatDateTime(r.finishedAt),
        r.moodScore,
        r.moodName || "",
        ...DIMENSIONS.filter((d) => d.scored).map((d) => r.dimensionScores[d.key] ?? ""),
        (r.ai.keywords?.length ? r.ai.keywords : r.keywordLocal).join("、"),
        (r.signals || []).join("、"),
        r.answers.filter((answer) => answer.text).map((answer) => answer.text).join("；"),
        r.boundBlockId || "",
        r.followUps.length,
        r.followUps.filter((f) => f.done === "yes" || f.done === "partial").length,
        r.note || "",
      ]
        .map(escape)
        .join(","),
    );
  return `\ufeff${header.map(escape).join(",")}\n${rows.join("\n")}`;
}
