/**
 * 全局状态与数据操作。
 * 单一实例插件，UI 组件直接 import state 与动作函数，不再层层传 props。
 */
import { reactive } from "vue";
import { BUILTIN_QUESTIONS } from "@/quiz/bank";
import { EMOTION_WORDS } from "@/quiz/emotions";
import { summarizeAnswers } from "@/quiz/score";
import { computeDueAt, computeInterval } from "@/stats/interval";
import { KEY_BANK, KEY_CHECKINS, KEY_INDEX, KEY_REPORT, KEY_SETTINGS, KEY_SUGGEST_LOG, monthKey, readData, writeData } from "@/store/storage";
import type {
  CheckIn,
  CheckinSuggestLogEntry,
  ImportedBank,
  MoodReport,
  MoodSettings,
  QuizAnswer,
  QuizOption,
  QuizQuestion,
  QuizRecord,
  RecordIndexEntry,
} from "@/types/mood";
import { makeRecordId } from "@/utils/dom";

export type ViewTab = "records" | "stats" | "table";

export function defaultSettings(): MoodSettings {
  return {
    questionsPerQuiz: 10,
    repeatTolerance: 0.5,
    bank: { useBuiltin: true, importedEnabled: true },
    reminder: {
      enabled: true,
      baseDays: 7,
      // 最低两天：觉察是慢功夫，触发太勤反而变成负担
      minDays: 2,
      maxDays: 30,
      quietFrom: "22:00",
      quietTo: "08:00",
    },
    checkinWords: [],
    checkinIcons: true,
    ai: { enabled: true, autoRun: true, maxContextRecords: 3 },
  };
}

export const state = reactive({
  ready: false,
  settings: defaultSettings(),
  records: [] as QuizRecord[],
  bank: { name: "", questions: [] } as ImportedBank,
  /** AI 生成的心情卡片（周报/月报） */
  report: null as MoodReport | null,
  /** 快速打卡，新的在前 */
  checkins: [] as CheckIn[],
  /** 快速打卡 AI 小建议的最近几条，新的在前 */
  checkinSuggestLog: [] as CheckinSuggestLogEntry[],
  tab: "records" as ViewTab,
  detailId: "",
  /** 有 AI 请求在跑 */
  aiRunning: false,
  /** 有周报在生成 */
  reportRunning: false,
  /** 本次会话内已提醒过 */
  reminderDue: false,
  /** 最近一次操作的气泡提示 */
  toast: "",
});

// **************************************** 读取 ****************************************

function mergeSettings(raw: unknown): MoodSettings {
  const base = defaultSettings();
  const data = (raw || {}) as Partial<MoodSettings>;
  return {
    ...base,
    ...data,
    bank: { ...base.bank, ...(data.bank || {}) },
    reminder: { ...base.reminder, ...(data.reminder || {}) },
    ai: { ...base.ai, ...(data.ai || {}) },
  };
}

export async function loadAll(): Promise<void> {
  state.settings = mergeSettings(await readData<Partial<MoodSettings>>(KEY_SETTINGS, {}));
  state.bank = await readData<ImportedBank>(KEY_BANK, { name: "", questions: [] });
  state.report = await readData<MoodReport | null>(KEY_REPORT, null);
  const checkins = await readData<CheckIn[]>(KEY_CHECKINS, []);
  state.checkins = (Array.isArray(checkins) ? checkins : [])
    .filter((c) => c && typeof c.at === "number" && typeof c.word === "string")
    .sort((a, b) => b.at - a.at);

  const suggestLog = await readData<CheckinSuggestLogEntry[]>(KEY_SUGGEST_LOG, []);
  state.checkinSuggestLog = (Array.isArray(suggestLog) ? suggestLog : []).filter(
    (s) => s && typeof s.at === "number" && typeof s.text === "string",
  );

  const index = await readData<RecordIndexEntry[]>(KEY_INDEX, []);
  const months = Array.from(new Set(index.filter((e) => e && e.finishedAt).map((e) => monthKey(e.finishedAt))));
  const records: QuizRecord[] = [];
  for (const month of months) {
    const list = await readData<QuizRecord[]>(month, []);
    if (Array.isArray(list)) records.push(...list.filter((r) => r && r.id));
  }
  // 上次退出时正在解读的记录，状态归位，避免永远转圈
  for (const record of records) {
    if (record.ai?.status === "running") record.ai.status = "idle";
  }
  state.records = records.sort((a, b) => b.finishedAt - a.finishedAt);
  state.ready = true;
}

export async function saveReport(report: MoodReport | null): Promise<void> {
  state.report = report;
  await writeData(KEY_REPORT, report);
}

// **************************************** 快速打卡 ****************************************

export function latestCheckIn(): CheckIn | undefined {
  return state.checkins[0];
}

export async function addCheckIn(word: string, weather?: string, note?: string): Promise<CheckIn> {
  const entry: CheckIn = { id: makeRecordId(Date.now()), at: Date.now(), word };
  if (weather) entry.weather = weather;
  if (note) entry.note = note;
  state.checkins = [entry, ...state.checkins];
  await writeData(KEY_CHECKINS, state.checkins);
  return entry;
}

/** 记住最近给过的打卡小建议（留 5 条），下一次提示词里要求 AI 换角度 */
export async function rememberCheckinSuggestion(text: string): Promise<void> {
  state.checkinSuggestLog = [{ at: Date.now(), text }, ...state.checkinSuggestLog].slice(0, 5);
  await writeData(KEY_SUGGEST_LOG, state.checkinSuggestLog);
}

/** 打卡可用词：内置 16 个 + 用户自定义，自定义的排在后面 */
export function allCheckinWords(): string[] {
  const custom = (state.settings.checkinWords || []).filter((w) => w.trim());
  return [...EMOTION_WORDS, ...custom.filter((w) => !EMOTION_WORDS.includes(w))];
}

export async function saveSettings(): Promise<void> {
  await writeData(KEY_SETTINGS, JSON.parse(JSON.stringify(state.settings)));
}

// **************************************** 记录 ****************************************

export function sortedRecords(): QuizRecord[] {
  return state.records.slice().sort((a, b) => b.finishedAt - a.finishedAt);
}

export function findRecord(id: string): QuizRecord | undefined {
  return state.records.find((r) => r.id === id);
}

export function latestRecord(): QuizRecord | undefined {
  return sortedRecords()[0];
}

export function lastQuestionIds(): string[] {
  return latestRecord()?.questionIds || [];
}

/** 索引只存列表与统计要用的字段，明细留在月分片里 */
export function getIndex(): RecordIndexEntry[] {
  return sortedRecords().map((r) => ({
    id: r.id,
    finishedAt: r.finishedAt,
    moodScore: r.moodScore,
    keywords: r.ai.keywords?.length ? r.ai.keywords : r.keywordLocal,
    aiStatus: r.ai.status,
    adviceTotal: r.followUps.length || r.ai.advice?.length || 0,
    adviceDone: r.followUps.filter((f) => f.done === "yes" || f.done === "partial").length,
  }));
}

export function createRecord(
  questions: QuizQuestion[],
  answers: QuizAnswer[],
  startedAt: number,
  extra: { moodName?: string; signals?: string[] } = {},
): QuizRecord {
  const finishedAt = Date.now();
  const summary = summarizeAnswers(answers);
  const record: QuizRecord = {
    id: makeRecordId(finishedAt),
    startedAt,
    finishedAt,
    questionIds: questions.map((q) => q.id),
    answers,
    dimensionScores: summary.dimensionScores,
    moodScore: summary.moodScore,
    keywordLocal: summary.keywordLocal,
    ai: { status: "idle" },
    followUps: [],
  };
  if (extra.moodName) record.moodName = extra.moodName;
  if (extra.signals?.length) record.signals = extra.signals;
  record.dueAt = computeDueAt(finishedAt, computeInterval(state.records, state.settings));
  return record;
}

async function persistMonth(month: string): Promise<void> {
  await writeData(month, state.records.filter((r) => monthKey(r.finishedAt) === month));
}

async function persistIndex(): Promise<void> {
  await writeData(KEY_INDEX, getIndex());
}

export async function putRecord(record: QuizRecord): Promise<void> {
  const idx = state.records.findIndex((r) => r.id === record.id);
  if (idx >= 0) state.records[idx] = record;
  else state.records.push(record);
  await persistMonth(monthKey(record.finishedAt));
  await persistIndex();
}

export async function deleteRecord(id: string): Promise<void> {
  const target = findRecord(id);
  if (!target) return;
  state.records = state.records.filter((r) => r.id !== id);
  await persistMonth(monthKey(target.finishedAt));
  await persistIndex();
}

/** 重新计算某条记录建议的下次时间（改了设置或测完新记录后） */
export async function refreshDue(record: QuizRecord): Promise<void> {
  record.dueAt = computeDueAt(record.finishedAt, computeInterval(state.records, state.settings));
  await putRecord(record);
}

// **************************************** 题库 ****************************************

export function activeQuestions(): QuizQuestion[] {
  const map = new Map<string, QuizQuestion>();
  if (state.settings.bank.useBuiltin) {
    for (const question of BUILTIN_QUESTIONS) map.set(question.id, question);
  }
  if (state.settings.bank.importedEnabled) {
    for (const question of state.bank.questions || []) map.set(question.id, question);
  }
  return Array.from(map.values()).filter((q) => q.enabled !== false);
}

export interface BankParseResult {
  ok: boolean;
  error?: string;
  bank?: ImportedBank;
}

const ALLOWED_DIMENSIONS = new Set(["body", "recognition", "energy", "avoidance", "need"]);

export function parseBankJson(text: string): BankParseResult {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `不是合法的 JSON：${(err as Error).message}` };
  }
  if (!raw || raw.schema !== "siyuan-mood-bank") {
    return { ok: false, error: '缺少标识：schema 必须是 "siyuan-mood-bank"' };
  }
  if (!Array.isArray(raw.questions) || !raw.questions.length) {
    return { ok: false, error: "questions 必须是非空数组" };
  }

  const questions: QuizQuestion[] = [];
  for (let i = 0; i < raw.questions.length; i++) {
    const item = raw.questions[i];
    const at = `第 ${i + 1} 题`;
    if (!item || typeof item.id !== "string" || !item.id) return { ok: false, error: `${at}：缺少 id` };
    if (!ALLOWED_DIMENSIONS.has(item.dimension)) return { ok: false, error: `${at}：dimension 必须是 body / recognition / energy / avoidance / need` };
    if (item.type !== "single" && item.type !== "multiple" && item.type !== "text") {
      return { ok: false, error: `${at}：type 必须是 single、multiple 或 text` };
    }
    if (typeof item.text !== "string" || !item.text.trim()) return { ok: false, error: `${at}：缺少题干 text` };

    let options: QuizOption[] = [];
    if (item.type !== "text") {
      if (!Array.isArray(item.options) || item.options.length < 2) return { ok: false, error: `${at}：至少需要 2 个选项` };
      options = item.options.map((option: any, oi: number) => {
        if (!option || typeof option.id !== "string" || typeof option.label !== "string") {
          throw new Error(`${at} 选项 ${oi + 1}：需要 id 与 label`);
        }
        return {
          id: option.id,
          label: option.label,
          score: typeof option.score === "number" ? option.score : undefined,
          tags: Array.isArray(option.tags) ? option.tags.filter((tag: unknown) => typeof tag === "string") : undefined,
        };
      });
    }

    questions.push({
      id: item.id,
      dimension: item.dimension,
      type: item.type,
      text: item.text,
      options,
      source: "imported",
      enabled: item.enabled !== false,
      weight: typeof item.weight === "number" ? item.weight : 1,
    });
  }

  return {
    ok: true,
    bank: { name: typeof raw.name === "string" ? raw.name : "", questions },
  };
}

export async function importBank(bank: ImportedBank): Promise<void> {
  state.bank = bank;
  await writeData(KEY_BANK, JSON.parse(JSON.stringify(bank)));
  await saveSettings();
}

export function exportBank(): string {
  return JSON.stringify(
    { schema: "siyuan-mood-bank", version: 1, name: state.bank.name || "my-mood-bank", questions: state.bank.questions },
    null,
    2,
  );
}

// **************************************** 全部数据 ****************************************

export function exportAll(): string {
  return JSON.stringify(
    {
      schema: "siyuan-mood-data",
      version: 1,
      exportedAt: Date.now(),
      settings: state.settings,
      bank: state.bank,
      records: sortedRecords(),
      checkins: state.checkins,
    },
    null,
    2,
  );
}

export interface DataImportResult {
  ok: boolean;
  error?: string;
  count?: number;
}

export async function importAll(text: string): Promise<DataImportResult> {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `不是合法的 JSON：${(err as Error).message}` };
  }
  if (!raw || raw.schema !== "siyuan-mood-data" || !Array.isArray(raw.records)) {
    return { ok: false, error: '数据格式不对：需要 schema 为 "siyuan-mood-data" 且包含 records' };
  }

  const incoming: QuizRecord[] = raw.records.filter((r: any) => r && typeof r.id === "string" && r.finishedAt);
  if (!incoming.length) return { ok: false, error: "没有可导入的记录" };

  // 合并：同 id 覆盖，其余追加
  const map = new Map<string, QuizRecord>();
  for (const record of state.records) map.set(record.id, record);
  for (const record of incoming) map.set(record.id, record);
  state.records = Array.from(map.values());

  if (raw.settings) {
    state.settings = mergeSettings(raw.settings);
    await saveSettings();
  }
  if (raw.bank && Array.isArray(raw.bank.questions)) {
    state.bank = raw.bank;
    await writeData(KEY_BANK, JSON.parse(JSON.stringify(state.bank)));
  }
  if (Array.isArray(raw.checkins)) {
    const map = new Map<string, CheckIn>();
    for (const entry of [...state.checkins, ...raw.checkins]) {
      if (entry && typeof entry.id === "string" && typeof entry.at === "number" && typeof entry.word === "string") {
        map.set(entry.id, entry);
      }
    }
    state.checkins = Array.from(map.values()).sort((a, b) => b.at - a.at);
    await writeData(KEY_CHECKINS, state.checkins);
  }

  const months = Array.from(new Set(state.records.map((r) => monthKey(r.finishedAt))));
  for (const month of months) await persistMonth(month);
  await persistIndex();
  return { ok: true, count: incoming.length };
}

export async function clearAll(keepSettings = true): Promise<void> {
  const months = Array.from(new Set(state.records.map((r) => monthKey(r.finishedAt))));
  for (const month of months) await writeData(month, []);
  state.records = [];
  state.checkins = [];
  await writeData(KEY_CHECKINS, []);
  await persistIndex();
  if (!keepSettings) {
    state.bank = { name: "", questions: [] };
    await writeData(KEY_BANK, state.bank);
    state.settings = defaultSettings();
    await saveSettings();
  }
}
