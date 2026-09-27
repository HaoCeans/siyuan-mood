/** 用 AI 把用户导入的 Markdown 题目整理成题库（判定分类、分值与关键词） */
import { buildBankPrompt, parseBankFromAi } from "@/ai/prompts";
import { askSiyuanAi } from "@/ai/siyuanAi";
import { beginAi, endAi } from "@/ai/busy";
import { state } from "@/store";
import type { QuizQuestion } from "@/types/mood";

export interface BankRefineResult {
  questions: QuizQuestion[];
  usedAi: boolean;
  /** 结果说明，直接显示在预览弹窗顶部 */
  note: string;
}

export async function refineBankWithAi(markdown: string, fallback: QuizQuestion[]): Promise<BankRefineResult> {
  if (!state.settings.ai.enabled) {
    return { questions: fallback, usedAi: false, note: "AI 解读已关闭，按本地规则整理" };
  }

  beginAi();
  try {
    const result = await askSiyuanAi(buildBankPrompt(markdown));
    if (!result.ok) {
      return {
        questions: fallback,
        usedAi: false,
        note: result.reason === "empty" ? "还没在「设置 → AI」里配置模型，按本地规则整理" : "AI 请求失败，按本地规则整理",
      };
    }
    const questions = parseBankFromAi(result.markdown);
    if (!questions) {
      return { questions: fallback, usedAi: false, note: "AI 返回的内容没读懂，按本地规则整理" };
    }
    return { questions, usedAi: true, note: `AI 已整理：${questions.length} 道题，分类、分值与关键词由它判定` };
  } finally {
    endAi();
  }
}
