/** 存储底层：思源插件自带 loadData / saveData（落在 data/storage/petal/<插件名>/<name>.json） */
import { getPlugin } from "@/plugin";
import { pad2 } from "@/utils/dom";

export const KEY_SETTINGS = "settings";
export const KEY_BANK = "bank";
export const KEY_INDEX = "index";
export const KEY_REPORT = "report";
export const KEY_CHECKINS = "checkins";
/** 快速打卡后 AI 小建议的最近几条，让下一次换角度，不再句句相同 */
export const KEY_SUGGEST_LOG = "checkinSuggestLog";
/** 侧边栏「问答」的会话存档 */
export const KEY_CHATS = "chatSessions";

/** 明细按月分片，避免单文件随记录增长越来越慢 */
export function monthKey(ts: number): string {
  const d = new Date(ts);
  return `rec-${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export async function readData<T>(name: string, fallback: T): Promise<T> {
  const plugin = getPlugin();
  if (!plugin) return fallback;
  try {
    const data = await plugin.loadData(name);
    if (data === null || data === undefined || data === "") return fallback;
    return data as T;
  } catch (err) {
    console.error(`[mood] read ${name} failed`, err);
    return fallback;
  }
}

export async function writeData(name: string, data: unknown): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    await plugin.saveData(name, data);
  } catch (err) {
    console.error(`[mood] write ${name} failed`, err);
  }
}
