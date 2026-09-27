/** 抽题：按维度分层抽样 + 重复率控制 + 打散同维度相邻 */
import { DIMENSIONS, type Dimension, type QuizQuestion } from "@/types/mood";

export interface PickOptions {
  count: number;
  /** 上一次的题目 id，用于重复率控制 */
  lastIds?: string[];
  /** 重复率上限，超过就重抽 */
  tolerance?: number;
}

export interface PickResult {
  questions: QuizQuestion[];
  /** 题库不足等降级说明 */
  note?: string;
}

function shuffle<T>(list: T[]): T[] {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function repeatRatio(picked: QuizQuestion[], lastIds: string[]): number {
  if (!lastIds.length || !picked.length) return 0;
  const last = new Set(lastIds);
  const hit = picked.filter((q) => last.has(q.id)).length;
  return hit / picked.length;
}

/** 按维度分组，每维尽量均分题量，不足时从还有余量的维度补齐 */
function stratify(pool: QuizQuestion[], count: number): QuizQuestion[] {
  const groups = new Map<Dimension, QuizQuestion[]>();
  for (const meta of DIMENSIONS) groups.set(meta.key, []);
  for (const question of pool) {
    const bucket = groups.get(question.dimension);
    if (bucket) bucket.push(question);
  }

  const dims = DIMENSIONS.map((d) => ({ key: d.key, items: shuffle(groups.get(d.key) || []) }));
  const picked: QuizQuestion[] = [];
  const quota = Math.max(1, Math.floor(count / dims.length));

  for (const dim of dims) {
    for (let i = 0; i < quota && dim.items.length; i++) {
      picked.push(dim.items.shift() as QuizQuestion);
    }
  }

  // 补齐剩余名额：优先给题目还有富余的维度
  let rest = count - picked.length;
  while (rest > 0) {
    const available = dims.filter((d) => d.items.length);
    if (!available.length) break;
    const target = available[Math.floor(Math.random() * available.length)];
    picked.push(target.items.shift() as QuizQuestion);
    rest--;
  }
  return picked;
}

/** 尽量让同一维度的题不相邻 */
function interleave(questions: QuizQuestion[]): QuizQuestion[] {
  const result: QuizQuestion[] = [];
  const rest = shuffle(questions);
  while (rest.length) {
    const lastDim = result.length ? result[result.length - 1].dimension : null;
    const idx = rest.findIndex((q) => q.dimension !== lastDim);
    result.push(rest.splice(idx === -1 ? 0 : idx, 1)[0]);
  }
  return result;
}

export function pickQuestions(pool: QuizQuestion[], options: PickOptions): PickResult {
  const count = Math.max(1, Math.floor(options.count || 10));
  const tolerance = options.tolerance ?? 0.5;
  const usable = pool.filter((q) => q.enabled !== false && q.type !== "text" && q.options.length >= 2);
  // 填空题不参与抽题，固定放在最后：它没有选项，重复率也谈不上
  const closing = pool.filter((q) => q.enabled !== false && q.type === "text");
  if (!usable.length) {
    return { questions: closing, note: closing.length ? "题库里只有填空题" : "题库为空" };
  }

  const target = Math.min(count, usable.length);
  let picked = stratify(usable, target);

  // 多选题至少留一道：它产出的关键词最多
  const hasMultiple = picked.some((q) => q.type === "multiple");
  if (!hasMultiple && target >= 4) {
    const swapIn = shuffle(usable.filter((q) => q.type === "multiple" && !picked.includes(q)))[0];
    if (swapIn) {
      // 替换掉一道同维度或任意一道单选题，保持题量不变
      const outIdx = picked.findIndex((q) => q.type === "single" && q.dimension === swapIn.dimension);
      picked[outIdx === -1 ? picked.length - 1 : outIdx] = swapIn;
      picked = picked.filter((q, i, arr) => arr.indexOf(q) === i);
    }
  }

  // 重复率控制：最多重抽 5 次，超限就用当前结果
  const lastIds = options.lastIds || [];
  if (lastIds.length) {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (repeatRatio(picked, lastIds) <= tolerance) break;
      picked = stratify(usable, target);
    }
  }

  return {
    questions: [...interleave(picked), ...closing],
    note: target < count ? `题库不足，本次 ${target} 题` : undefined,
  };
}
