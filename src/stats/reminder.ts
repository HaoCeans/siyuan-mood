/** 提醒调度：到期检查、静默时段、一天一次、顶栏红点 */
import { fetchSyncPost } from "siyuan";
import { computeInterval, daysUntilDue, isQuietNow, nextDueAt, promptAgainAllowed } from "@/stats/interval";
import { saveSettings, state } from "@/store";
import { t } from "@/plugin";

const CHECK_INTERVAL = 30 * 60 * 1000;
const FIRST_DELAY = 90 * 1000;

export interface ReminderHooks {
  /** 红点开关 */
  onDot: (on: boolean) => void;
}

export class Reminder {
  private timer: number | undefined;
  private first: number | undefined;

  constructor(private hooks: ReminderHooks) {}

  start(): void {
    this.stop();
    this.first = window.setTimeout(() => this.check(true), FIRST_DELAY);
    this.timer = window.setInterval(() => this.check(true), CHECK_INTERVAL);
    this.refreshDot();
  }

  stop(): void {
    if (this.first) window.clearTimeout(this.first);
    if (this.timer) window.clearInterval(this.timer);
    this.first = undefined;
    this.timer = undefined;
  }

  isDue(): boolean {
    if (!state.settings.reminder.enabled) return false;
    const due = nextDueAt(state.records, state.settings);
    return due !== null && Date.now() >= due;
  }

  /** 还有几天（负数已过期），无记录返回 null */
  daysLeft(): number | null {
    const due = nextDueAt(state.records, state.settings);
    return due === null ? null : daysUntilDue(due);
  }

  /** 下次复测的建议说明，展示在 Dock 顶部 */
  suggestion(): string {
    if (!state.records.length) return t("firstTimeHint");
    const decision = computeInterval(state.records, state.settings);
    const left = this.daysLeft();
    if (left === null) return "";
    if (left < 0) return `${t("dueNow")}（${decision.reasons.join("、")}）`;
    if (left === 0) return `${t("dueToday")}（${decision.reasons.join("、")}）`;
    return `${t("nextInDays").replace("{n}", String(left))}（${decision.reasons.join("、")}）`;
  }

  refreshDot(): void {
    this.hooks.onDot(this.isDue());
  }

  /** notify=false 时只更新红点，不弹提示 */
  async check(notify = true): Promise<void> {
    if (!state.settings.reminder.enabled || !state.records.length) {
      this.hooks.onDot(false);
      return;
    }
    const due = this.isDue();
    this.hooks.onDot(due);
    if (!notify || !due) return;
    if (isQuietNow(state.settings) || !promptAgainAllowed(state.settings)) return;

    state.settings.reminder.lastPromptAt = Date.now();
    await saveSettings();
    state.reminderDue = true;

    try {
      await fetchSyncPost("/api/notification/pushMsg", {
        msg: `${t("remindTitle")}｜${this.suggestion()}`,
        timeout: 7000,
      });
    } catch (err) {
      console.error("[mood] pushMsg failed", err);
    }
  }

  /** 用户选择「今天不再提醒」 */
  async snoozeToday(): Promise<void> {
    state.settings.reminder.lastPromptAt = Date.now();
    state.reminderDue = false;
    this.hooks.onDot(false);
    await saveSettings();
  }

  /** 完成一次问答后重算 */
  async afterQuiz(): Promise<void> {
    state.reminderDue = false;
    await this.check(false);
  }
}
