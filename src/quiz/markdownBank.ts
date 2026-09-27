/**
 * 把一份 Markdown 题目整理成题库。
 *
 * 先按本地规则解析结构（题干、选项、单选/多选），并粗略判断维度与默认分值；
 * 导入流程里如果用户配了 AI，会再让 AI 判一遍分类、分值和关键词（见 ai/bankImport.ts）。
 * 所以这里的目标是「结构解析要稳」，而不是「判得准」。
 */
import { DIMENSION_MAP, type Dimension, type QuizOption, type QuizQuestion } from "@/types/mood";

export interface MarkdownBankResult {
  questions: QuizQuestion[];
  /** 解析失败的原因，直接显示给用户 */
  error?: string;
}

/** 关键词 → 维度的粗略映射，只在本地整理时用 */
const DIMENSION_HINTS: Array<[Dimension, string[]]> = [
  ["body", ["肩膀", "脖子", "呼吸", "胸口", "胃", "下巴", "牙关", "手心", "身体", "肌肉", "头痛", "酸", "疼", "绷", "紧"]],
  ["energy", ["能量", "精神", "精力", "专注", "想做", "动力", "累", "疲惫", "困", "睡", "躺", "走神"]],
  ["avoidance", ["躲", "逃", "回避", "刷手机", "拖延", "转移", "硬扛", "不想面对"]],
  ["recognition", ["情绪", "感觉", "心情", "烦", "低落", "平静", "焦虑", "委屈", "空", "说不清", "念头"]],
  ["need", ["需要", "想要", "希望", "帮助", "倾听", "陪", "休息", "方向", "安慰", "理解"]],
];

const ALLOWED_DIMENSIONS = new Set<Dimension>(["body", "recognition", "energy", "avoidance", "need"]);

function guessDimension(text: string): Dimension {
  let best: Dimension = "recognition";
  let bestHits = 0;
  for (const [dimension, words] of DIMENSION_HINTS) {
    const hits = words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
    if (hits > bestHits) {
      best = dimension;
      bestHits = hits;
    }
  }
  return best;
}

/** 单选的默认分值：越靠前的选项越好；多选不好按顺序给分，统一给 1 分保持中性 */
function defaultScores(count: number, multiple: boolean): number[] {
  if (multiple) return new Array(count).fill(1);
  if (count <= 1) return [3];
  return Array.from({ length: count }, (_, index) => Math.max(0, 3 - Math.round((3 * index) / (count - 1))));
}

interface Draft {
  text: string;
  options: string[];
  multiple: boolean;
}

const LOOKS_LIKE_QUESTION = /[：:?？]\s*$/;
const LOOKS_LIKE_MULTIPLE = /多选|可多选|多项|不止一个|有几个/;
/** 题干里出现这些词，就当成填空题处理（自己用一句话写，没有选项） */
const LOOKS_LIKE_TEXT = /填空|自己说|说出来|描述一下|简述|写一句|说说|随便写|补充一句/;

export function parseMarkdownBank(markdown: string): MarkdownBankResult {
  const drafts: Draft[] = [];
  let current: Draft | null = null;
  let inFence = false;

  const startQuestion = (raw: string): void => {
    // 问答界面本来就会显示「可多选」提示，题干里的这个标记去掉，免得重复
    const text = raw
      .replace(/[（(]\s*(可)?多选[^）)]*[）)]/g, "")
      .replace(/[：:?？]\s*$/, "")
      .trim();
    if (!text) return;
    current = { text, options: [], multiple: LOOKS_LIKE_MULTIPLE.test(raw) };
    drafts.push(current);
  };
  const addOption = (raw: string): void => {
    const text = raw.trim();
    if (!text) return;
    if (!current) {
      startQuestion(text);
      return;
    }
    current.options.push(text);
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (!line || /^[-*_]{3,}$/.test(line) || /^>/.test(line)) continue;

    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    if (heading) {
      startQuestion(heading[1]);
      continue;
    }

    const numbered = /^\d+\s*[.、)）]\s*(.+)$/.exec(line);
    if (numbered) {
      startQuestion(numbered[1]);
      continue;
    }

    const lettered = /^[（(]?[A-Za-z][)）.、:：]\s*(.+)$/.exec(line);
    if (lettered) {
      addOption(lettered[1]);
      continue;
    }

    const checkbox = /^[-*+]\s+\[[ xX]\]\s*(.+)$/.exec(line);
    if (checkbox) {
      addOption(checkbox[1]);
      continue;
    }

    const bullet = /^[-*+]\s+(.+)$/.exec(line);
    if (bullet) {
      const content = bullet[1];
      if (/^\s+/.test(rawLine)) {
        addOption(content);
      } else if (!current) {
        startQuestion(content);
      } else if (!current.options.length) {
        // 紧跟题干的第一行，多半是选项
        addOption(content);
      } else if (LOOKS_LIKE_QUESTION.test(content)) {
        startQuestion(content);
      } else {
        addOption(content);
      }
      continue;
    }

    // 剩下的当普通文字：带问号的另起一题，否则算选项
    if (current && current.options.length && LOOKS_LIKE_QUESTION.test(line)) {
      startQuestion(line);
    } else {
      addOption(line);
    }
  }

  const questions: QuizQuestion[] = [];
  let skipped = 0;
  for (const draft of drafts) {
    const options = Array.from(new Set(draft.options.map((option) => option.trim()))).filter(Boolean);
    // 题干里写明是填空题的，忽略多写出来的选项
    if (LOOKS_LIKE_TEXT.test(draft.text)) {
      questions.push({
        id: `md-${questions.length + 1}`,
        dimension: guessDimension(draft.text),
        type: "text",
        text: draft.text,
        options: [],
        source: "imported",
        enabled: true,
        weight: 1,
      });
      continue;
    }
    if (options.length < 2) {
      skipped++;
      continue;
    }
    const scores = defaultScores(options.length, draft.multiple);
    questions.push({
      id: `md-${questions.length + 1}`,
      dimension: guessDimension(`${draft.text} ${options.join(" ")}`),
      type: draft.multiple ? "multiple" : "single",
      text: draft.text,
      options: options.map((label, index) => ({ id: String.fromCharCode(65 + index), label, score: scores[index] })),
      source: "imported",
      enabled: true,
      weight: 1,
    });
  }

  if (!questions.length) {
    return {
      questions: [],
      error: "没认出题目。每道题写一行（建议用 `## 题干` 或 `1. 题干`），选项写在题目下面，每行一个；填空题在题干里写上「填空」或「自己说」就行。",
    };
  }

  return { questions, error: skipped ? `有 ${skipped} 行没凑够两个选项，已跳过` : undefined };
}

/** 把 AI 返回的题目列表整理成规范题库：宽松处理，坏条目跳过而不是整体失败 */
export function normalizeAiQuestions(raw: unknown): QuizQuestion[] {
  if (!Array.isArray(raw)) return [];
  const questions: QuizQuestion[] = [];

  raw.forEach((item: any) => {
    if (!item || typeof item.text !== "string" || !Array.isArray(item.options)) return;
    const text = item.text.trim();
    if (!text) return;

    const options: QuizOption[] = [];
    item.options.forEach((option: any, index: number) => {
      const label = typeof option === "string" ? option : option?.label;
      if (typeof label !== "string" || !label.trim()) return;
      const optionItem: QuizOption = { id: String.fromCharCode(65 + options.length), label: label.trim() };
      if (typeof option?.score === "number") {
        optionItem.score = Math.min(3, Math.max(0, Math.round(option.score)));
      }
      if (Array.isArray(option?.tags)) {
        const tags = option.tags
          .filter((tag: unknown): tag is string => typeof tag === "string" && !!tag.trim())
          .map((tag: string) => tag.trim())
          .slice(0, 3);
        if (tags.length) optionItem.tags = tags;
      }
      options.push(optionItem);
      void index;
    });

    if (options.length < 2 && item.type !== "text") return;
    const dimension: Dimension = ALLOWED_DIMENSIONS.has(item.dimension) ? item.dimension : "recognition";
    const isText = item.type === "text";
    questions.push({
      id: `md-${questions.length + 1}`,
      dimension,
      type: isText ? "text" : item.type === "multiple" ? "multiple" : "single",
      text,
      options: isText ? [] : options,
      source: "imported",
      enabled: true,
      weight: 1,
    });
  });

  return questions;
}

export function dimensionLabel(dimension: Dimension): string {
  return DIMENSION_MAP[dimension]?.name || dimension;
}
