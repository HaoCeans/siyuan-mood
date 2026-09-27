/**
 * 情绪词表与归类。
 * 快速打卡、问答收尾的命名一步共用同一份词表；
 * 归类成四个家族 + 「说不上来」，是为了把词语变成统计图上能上色的点。
 */
import { getPlugin } from "@/plugin";

export const EMOTION_WORDS = [
  "平静", "放松", "满足", "开心",
  "有点烦", "焦虑", "紧张", "生气",
  "低落", "委屈", "失落",
  "孤独", "空虚",
  "疲惫", "麻木",
  "说不上来",
];

/**
 * Blobmoji 图标（Apache 2.0，https://github.com/c1710/blobmoji）。
 * 打包在插件目录 icons/blob/ 下，按文件名取用；比文字 emoji 好看，也不依赖系统字体。
 */
const WORD_ICON: Record<string, string> = {
  平静: "1f60c",
  放松: "1f60a",
  满足: "1f970",
  开心: "1f604",
  有点烦: "1f611",
  焦虑: "1f630",
  紧张: "1f62c",
  生气: "1f620",
  委屈: "1f97a",
  低落: "1f61e",
  失落: "1f614",
  孤独: "1f622",
  空虚: "1f636",
  麻木: "1f610",
  疲惫: "1f971",
  说不上来: "1f633",
};

const LEVEL_ICON: Record<string, string> = {
  "80plus": "1f600",
  stable: "1f642",
  wavy: "1f615",
  low: "1f61e",
  veryLow: "1f616",
};

/** 情绪词对应的图标文件名；自定义词没有，返回空串 */
export function wordIconFile(word: string): string {
  return WORD_ICON[word] || "";
}

/** 按心情分档取兜底脸 */
export function levelIconFile(score: number): string {
  const key = score >= 80 ? "80plus" : score >= 60 ? "stable" : score >= 40 ? "wavy" : score >= 20 ? "low" : "veryLow";
  return LEVEL_ICON[key];
}

/** 插件内图标的绝对 URL（内核按 /plugins/<name>/ 提供文件服务） */
export function iconUrl(file: string): string {
  return `/plugins/${getPlugin()?.name || "siyuan-mood"}/icons/blob/${file}.svg`;
}

/** 打卡时顺手可选的天气 */
export const WEATHERS: Array<{ value: string; label: string }> = [
  { value: "☀️", label: "晴" },
  { value: "⛅", label: "多云" },
  { value: "☁️", label: "阴" },
  { value: "🌧️", label: "雨" },
  { value: "⛈️", label: "雷雨" },
  { value: "❄️", label: "雪" },
  { value: "🌫️", label: "雾" },
];

/** 兼容旧用法：纯值列表 */
export const WEATHER_WORDS = WEATHERS.map((w) => w.value);

const WEATHER_ICON: Record<string, string> = {
  "☀️": "2600",
  "⛅": "26c5",
  "☁️": "2601",
  "🌧️": "1f327",
  "⛈️": "26c8",
  "❄️": "2744",
  "🌫️": "1f32b",
};

export function weatherIconFile(weather: string): string {
  return WEATHER_ICON[weather] || "";
}

/** 天气的中文名，如「🌧️雨」；未知值原样返回 */
export function weatherLabel(weather: string): string {
  const found = WEATHERS.find((w) => w.value === weather);
  return weather + (found ? found.label : "");
}

/** 身体与行为信号：多维度捕捉情绪的前体 */
export const SIGNAL_WORDS = [
  "睡眠不好", "食欲变了", "动力很低", "不想说话/见人", "容易累", "身体紧绷或疼", "手机刷个不停",
];

export type EmotionFamily = "steady" | "restless" | "low" | "drained" | "unclear";

export interface FamilyMeta {
  label: string;
  color: string;
  background: string;
}

export const FAMILY_META: Record<EmotionFamily, FamilyMeta> = {
  steady: { label: "平稳舒服", color: "var(--b3-card-success-color)", background: "var(--b3-card-success-background)" },
  restless: { label: "烦躁紧绷", color: "var(--b3-card-warning-color)", background: "var(--b3-card-warning-background)" },
  low: { label: "低落委屈", color: "var(--b3-card-error-color)", background: "var(--b3-card-error-background)" },
  drained: { label: "疲惫疏离", color: "var(--b3-card-info-color)", background: "var(--b3-card-info-background)" },
  unclear: { label: "说不上来", color: "var(--b3-theme-on-surface)", background: "var(--b3-theme-surface-lighter)" },
};

const WORD_FAMILY: Record<string, EmotionFamily> = {
  平静: "steady", 放松: "steady", 满足: "steady", 开心: "steady",
  有点烦: "restless", 焦虑: "restless", 紧张: "restless", 生气: "restless",
  低落: "low", 委屈: "low", 失落: "low",
  孤独: "drained", 空虚: "drained", 疲惫: "drained", 麻木: "drained",
  说不上来: "unclear",
};

export function wordFamily(word: string): EmotionFamily {
  return WORD_FAMILY[word] || "unclear";
}

export function familyOf(word: string): FamilyMeta {
  return FAMILY_META[wordFamily(word)];
}
