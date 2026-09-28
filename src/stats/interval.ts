/** 复测间隔：本地算法给基线（纯函数，不依赖状态） */
import type { MoodSettings, QuizRecord } from "@/types/mood";
import { average, clamp, dayStart, stdDev } from "@/utils/dom";

const DAY = 24 * 60 * 60 * 1000;

export interface IntervalDecision {
  days: number;
  /** 参与决策的说明，直接显示给用户 */
  reasons: string[];
}

export function computeInterval(records: QuizRecord[], settings: MoodSettings): IntervalDecision {
  const base = settings.reminder.baseDays || 7;
  const min = settings.reminder.minDays ?? 1;
  const max = settings.reminder.maxDays ?? 30;
  const reasons: string[] = [];
  let adjust = 0;

  const recent = records.slice().sort((a, b) => b.finishedAt - a.finishedAt);
  const latest = recent[0];
  const last3 = recent.slice(0, 3);
  const last5 = recent.slice(0, 5);

  // 曲线斜率：按时间正序算，最近三次的变化趋势
  if (last3.length >= 3) {
    const asc = last3.slice().sort((a, b) => a.finishedAt - b.finishedAt);
    const slope = (asc[asc.length - 1].moodScore - asc[0].moodScore) / (asc.length - 1);
    if (slope < -1.5) {
      adjust -= 3;
      reasons.push("在往下走");
    }
  }

  if (last5.length >= 4 && stdDev(last5.map((r) => r.moodScore)) > 15) {
    adjust -= 2;
    reasons.push("波动大");
  }

  if (latest?.followUps.some((f) => f.done === "unset")) {
    adjust -= 1;
    reasons.push("有建议没跟进");
  }

  const week = recent.filter((r) => Date.now() - r.finishedAt <= 7 * DAY);
  if (week.length >= 2) {
    const scores = week.map((r) => r.moodScore);
    if (average(scores) > 75 && stdDev(scores) < 8) {
      adjust += 3;
      reasons.push("状态稳定");
    } else {
      adjust += 2;
      reasons.push("测得够勤");
    }
  } else if (week.length === 1 && week[0].moodScore > 75) {
    adjust += 1;
    reasons.push("状态稳定");
  }

  // 觉察触发太频繁会变成新的精神负担：各种下调合计最多 4 天，
  // 默认 7 天的基准最快也只会到 3 天一次；用户自己设的 minDays 仍然生效。
  adjust = Math.max(adjust, -4);

  const days = clamp(base + adjust, min, max);
  if (!reasons.length) reasons.push("按常规节奏");
  return { days, reasons };
}

/** 由完成时间与间隔算出下次建议时间 */
export function computeDueAt(finishedAt: number, decision: IntervalDecision): number {
  return finishedAt + decision.days * DAY;
}

/** 距下次复测还有几天（负数表示已过期） */
export function daysUntilDue(dueAt: number, now = Date.now()): number {
  return Math.round((dayStart(dueAt) - dayStart(now)) / DAY);
}

/** 是否处于静默时段，"22:00" - "08:00" 跨零点也成立 */
export function isQuietNow(settings: MoodSettings, now = new Date()): boolean {
  const toMinutes = (text: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(text || "");
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const from = toMinutes(settings.reminder.quietFrom);
  const to = toMinutes(settings.reminder.quietTo);
  if (from === null || to === null || from === to) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return from < to ? cur >= from && cur < to : cur >= from || cur < to;
}

/** 今天是否已经提醒过 */
export function promptAgainAllowed(settings: MoodSettings, now = Date.now()): boolean {
  const last = settings.reminder.lastPromptAt;
  if (!last) return true;
  return dayStart(last) !== dayStart(now);
}

export function nextDueAt(records: QuizRecord[], settings: MoodSettings): number | null {
  const latest = records.slice().sort((a, b) => b.finishedAt - a.finishedAt)[0];
  if (!latest) return null;
  return latest.dueAt ?? computeDueAt(latest.finishedAt, computeInterval(records, settings));
}
