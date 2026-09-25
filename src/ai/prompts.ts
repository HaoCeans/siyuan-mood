/** 提示词模板：首次解读 / 复测对比 / 周报。全部要求只输出 JSON，解析失败时兜底渲染原文 */
import { DIMENSION_MAP } from "@/types/mood";
import type { QuizRecord } from "@/types/mood";
import { formatDateTime } from "@/utils/dom";

const JSON_ONLY = "请只输出一个 JSON 对象，不要输出任何解释性文字，不要使用代码块围栏。";

const TONE_RULES = [
  "描述此刻的状态，不做医学诊断，不使用「你有……症」「你是……型人格」这类标签。",
  "advice 给 2-3 条，必须是 10 分钟内能做完的具体小动作，不要写「要放松」「多运动」。",
  "keywords 给 3-5 个中文短语，尽量来自下面的作答，不要生造。",
  "如果心情分低于 20，第一条 advice 以安抚身体为主，不布置任务。",
];

const SCHEMA = `{
  "mood": "一句话概括此刻状态，例如「低能量 + 情绪模糊 + 轻度回避」",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "analysis": "2-3 句话描述你看到的状态",
  "advice": [{ "text": "一条具体的小动作" }],
  "practice": "一个可以在这几天做的练习，一句话"
}`;

function answerLines(record: QuizRecord): string {
  return record.answers
    .map((a) => {
      const dim = DIMENSION_MAP[a.dimension]?.name || a.dimension;
      return `- [${dim}] ${a.questionText} → ${a.optionLabels.join("、") || "未作答"}`;
    })
    .join("\n");
}

function dimensionLine(record: QuizRecord): string {
  const parts = Object.entries(record.dimensionScores)
    .map(([key, value]) => `${DIMENSION_MAP[key as keyof typeof DIMENSION_MAP]?.name || key} ${value}`)
    .join(" / ");
  return parts || "无";
}

function historyBlock(history: QuizRecord[]): string {
  if (!history.length) return "";
  const items = history.map((record) => {
    const follow = record.followUps.length
      ? record.followUps
          .map((f) => {
            const state = f.done === "yes" ? "做了" : f.done === "partial" ? "做了一部分" : f.done === "no" ? "没做" : "还没跟进";
            const extra = [
              f.blocker ? `卡在${f.blocker}` : "",
              f.feeling ? `之后心情 ${f.feeling}/5` : "",
              f.note ? `感受：${f.note}` : "",
            ]
              .filter(Boolean)
              .join("，");
            return `  · ${f.adviceText} —— ${state}${extra ? `（${extra}）` : ""}`;
          })
          .join("\n")
      : "  （无）";
    return `${formatDateTime(record.finishedAt)}｜心情分 ${record.moodScore}｜维度 ${dimensionLine(record)}｜关键词 ${(record.ai.keywords || record.keywordLocal).join("、")}
 上次的建议与执行情况：
${follow}`;
  });
  return `<历史记录>\n${items.join("\n\n")}\n</历史记录>\n`;
}

export function buildAnalysisPrompt(params: {
  record: QuizRecord;
  history: QuizRecord[];
  extra?: string;
}): string {
  const { record, history, extra } = params;
  const first = !history.length;

  const rules = [
    ...TONE_RULES,
    first ? "" : "额外输出 changes 字段：和上次相比哪个维度动了、上次哪条建议有效、哪条卡住了、可能卡在哪。",
  ].filter(Boolean);

  const schema = first
    ? SCHEMA
    : SCHEMA.replace(/\n}$/, ',\n  "changes": "变化对比，2-3 句"\n}');

  return `你是一位温和、不评判的情绪觉察教练。下面是用户刚刚完成的一次心情自评（只问此刻的状态）。
${JSON_ONLY}

${historyBlock(history)}<本次作答>
心情分：${record.moodScore}（0-100，越高越平稳）
维度得分（0-100）：${dimensionLine(record)}
问答明细：
${answerLines(record)}
</本次作答>

<输出要求>
${rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}
${extra ? `${rules.length + 1}. 用户还希望：${extra}` : ""}
</输出要求>

<输出格式>
${schema}
</输出格式>`;
}

export function buildReportPrompt(records: QuizRecord[], rangeDays: number): string {
  const lines = records
    .map(
      (r) =>
        `${formatDateTime(r.finishedAt)}｜心情分 ${r.moodScore}｜${(r.ai.keywords || r.keywordLocal).join("、")}｜${r.dimensionScores ? Object.entries(r.dimensionScores).map(([k, v]) => `${DIMENSION_MAP[k as keyof typeof DIMENSION_MAP]?.name || k} ${v}`).join(" ") : ""}`,
    )
    .join("\n");

  return `你是一位温和、不评判的情绪觉察教练。下面是用户最近 ${rangeDays} 天的心情记录。
${JSON_ONLY}

<记录>
${lines || "（这段时间还没有记录）"}
</记录>

<输出要求>
1. 总结这段时间的整体状态与变化趋势，不做医学诊断，不使用人格标签。
2. 指出一个最值得注意的模式（例如「累的时候更容易说不清感受」）。
3. 给出 2 条这段时间可以继续做的具体小事。
</输出要求>

<输出格式>
{
  "mood": "一句话概括这段时间的状态",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "analysis": "3-4 句的趋势描述",
  "advice": [{ "text": "具体的小事" }],
  "practice": "一句话提醒"
}
</输出格式>`;
}

/** 从 AI 返回里抠出 JSON：先找围栏，再退化为括号配对 */
export function extractJson(text: string): any | null {
  if (!text) return null;
  const candidates: string[] = [];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.push(fence[1]);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // 继续尝试下一个候选
    }
  }
  return null;
}

export interface ParsedAnalysis {
  mood?: string;
  keywords?: string[];
  analysis?: string;
  advice?: { id: string; text: string }[];
  practice?: string;
  changes?: string;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value.filter((v): v is string => typeof v === "string" && !!v.trim()).map((v) => v.trim());
  return list.length ? list : undefined;
}

function parseAdvice(value: unknown): { id: string; text: string }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list: { id: string; text: string }[] = [];
  value.forEach((item, index) => {
    const text = typeof item === "string" ? item : item && typeof item.text === "string" ? item.text : "";
    if (text.trim()) list.push({ id: `advice-${Date.now()}-${index}`, text: text.trim() });
  });
  return list.length ? list : undefined;
}

export function parseAnalysis(text: string): ParsedAnalysis | null {
  const raw = extractJson(text);
  if (!raw || typeof raw !== "object") return null;
  const parsed: ParsedAnalysis = {
    mood: typeof raw.mood === "string" ? raw.mood.trim() : undefined,
    keywords: toStringArray(raw.keywords),
    analysis: typeof raw.analysis === "string" ? raw.analysis.trim() : undefined,
    advice: parseAdvice(raw.advice),
    practice: typeof raw.practice === "string" ? raw.practice.trim() : undefined,
    changes: typeof raw.changes === "string" ? raw.changes.trim() : undefined,
  };
  // 一个有效字段都没有，视作解析失败，交给原文兜底
  const useful = parsed.mood || parsed.keywords || parsed.analysis || parsed.advice;
  return useful ? parsed : null;
}
