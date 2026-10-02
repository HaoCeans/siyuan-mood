/**
 * 心情管理插件的数据模型。
 * 记录里保存题干与选项文案的快照，题库被导入覆盖后历史记录仍可原样回看。
 */

// **************************************** Dimension ****************************************

export type Dimension = "body" | "recognition" | "energy" | "avoidance" | "need";

export interface DimensionMeta {
  key: Dimension;
  /** 展示名，同时作为 AI 提示词里的维度名 */
  name: string;
  /** 是否计入心情分；need 维度只产出关键词与建议方向 */
  scored: boolean;
  /** 计入心情分时的权重 */
  weight: number;
}

export const DIMENSIONS: DimensionMeta[] = [
  { key: "body", name: "身体觉察", scored: true, weight: 0.25 },
  { key: "recognition", name: "情绪识别", scored: true, weight: 0.25 },
  { key: "energy", name: "能量状态", scored: true, weight: 0.25 },
  { key: "avoidance", name: "情绪回避", scored: true, weight: 0.25 },
  { key: "need", name: "当下需求", scored: false, weight: 0 },
];

export const DIMENSION_MAP: Record<Dimension, DimensionMeta> = DIMENSIONS.reduce((acc, d) => {
  acc[d.key] = d;
  return acc;
}, {} as Record<Dimension, DimensionMeta>);

// **************************************** Question bank ****************************************

export interface QuizOption {
  id: string;
  label: string;
  /** 0-3，越大表示此刻越平稳 / 觉察越在线；不计分维度可省略 */
  score?: number;
  /** 关键词候选 */
  tags?: string[];
}

/** single 单选 / multiple 多选 / text 填空（用户用自己的话写，不计分） */
export type QuestionType = "single" | "multiple" | "text";

export interface QuizQuestion {
  id: string;
  dimension: Dimension;
  type: QuestionType;
  text: string;
  /** 填空题为空数组 */
  options: QuizOption[];
  source: "builtin" | "imported";
  enabled: boolean;
  weight?: number;
}

/** 导入题库的文件格式 */
export interface QuestionBankFile {
  schema: "siyuan-mood-bank";
  version: 1;
  name?: string;
  questions: QuizQuestion[];
}

// **************************************** Record ****************************************

export interface QuizAnswer {
  questionId: string;
  /** 快照 */
  questionText: string;
  dimension: Dimension;
  type: QuestionType;
  optionIds: string[];
  /** 快照 */
  optionLabels: string[];
  /** 填空题的原文 */
  text?: string;
  /** 该题得分 0-3，不计分与填空题为 -1 */
  score: number;
  tags: string[];
}

export interface AiAdvice {
  id: string;
  text: string;
}

export interface AiAnalysis {
  status: "idle" | "running" | "done" | "failed";
  /** 「低能量 + 情绪模糊 + 轻度回避」 */
  mood?: string;
  keywords?: string[];
  /** 一段话，Markdown */
  analysis?: string;
  advice?: AiAdvice[];
  /** 本周练习 */
  practice?: string;
  /** 与上次相比的变化，第二次起才有 */
  changes?: string;
  /** 原始返回，JSON 解析失败时兜底渲染 */
  raw?: string;
  error?: string;
  at?: number;
}

export interface FollowUp {
  adviceId: string;
  /** 快照 */
  adviceText: string;
  done: "unset" | "yes" | "partial" | "no";
  blocker?: "forgot" | "hard" | "unwilling" | "no-time" | "other";
  /** 照做之后的心情 1-5 */
  feeling?: number;
  /** 填空：真正实施之后的感受 */
  note?: string;
  at?: number;
  /**
   * user = 用户自己写的做法（AI 给的建议不带这个字段）。
   * 自己写的那些不会因为「重新解读」被覆盖，也会一起进复盘和下一次解读。
   */
  source?: "user";
}

/**
 * 跟进复盘：把「每条建议做了没有 + 做完之后的感觉」交给 AI 看效果。
 * 与 ai 字段分开存，因为它是解读之后才产生的新一轮数据。
 */
export interface FollowReview {
  status: "idle" | "running" | "done" | "failed";
  /** 哪条有用、哪条卡住、可能的原因 */
  analysis?: string;
  /** 确实有效的做法 */
  works?: string[];
  /** 下次可以换成什么 */
  next?: string[];
  raw?: string;
  error?: string;
  at?: number;
}

export interface QuizRecord {
  id: string;
  startedAt: number;
  finishedAt: number;
  questionIds: string[];
  answers: QuizAnswer[];
  /** 0-100，只含计分维度 */
  dimensionScores: Partial<Record<Dimension, number>>;
  /** 0-100，越高越平稳 */
  moodScore: number;
  /** 本地提取，AI 未跑或失败时也能显示 */
  keywordLocal: string[];
  /**
   * 用户给此刻情绪起的名字（情绪标注，Affect Labeling）。
   * 起名字这个动作本身就有调节作用；「说不上来」也是有效记录。
   */
  moodName?: string;
  /** 用户勾选的身体与行为信号（睡眠、食欲、动力、社交等） */
  signals?: string[];
  /**
   * 关联的思源块 ID（用户自己的笔记，最近的经历等）。
   * 只存 ID 不存内容：解读时实时拉取，永远读到最新版。
   */
  boundBlockId?: string;
  ai: AiAnalysis;
  followUps: FollowUp[];
  /** 跟进复盘结果，用户手动触发 */
  followReview?: FollowReview;
  /** 本次算出的下次建议时间 */
  dueAt?: number;
  note?: string;
}

/** 列表与统计用的轻索引 */
export interface RecordIndexEntry {
  id: string;
  finishedAt: number;
  moodScore: number;
  keywords: string[];
  aiStatus: AiAnalysis["status"];
  adviceTotal: number;
  adviceDone: number;
}

/**
 * 快速打卡：随时点一下记下此刻的词，几秒完事。
 * 与正式问答分开——正式测评不该太频繁，但一天里状态的变化值得随手记。
 */
export interface CheckIn {
  id: string;
  at: number;
  word: string;
  /** 顺手记的天气（emoji），会影响情绪，也值得留档 */
  weather?: string;
  /** 顺手记的事件：当时经历了什么（可选），会进入 AI 分析 */
  note?: string;
}

/** 快速打卡 AI 小建议的存档：只留最近几条，供下一次提示词里「别重复」用 */
export interface CheckinSuggestLogEntry {
  at: number;
  text: string;
}

// **************************************** Settings ****************************************

export interface MoodSettings {
  /** 每次问答的题量 */
  questionsPerQuiz: number;
  /** 与上次题目的重复率上限 */
  repeatTolerance: number;
  bank: {
    useBuiltin: boolean;
    importedEnabled: boolean;
  };
  /** 用户自己加的打卡常用词，与内置词表合并 */
  checkinWords?: string[];
  /** 「记一下此刻」弹窗里是否显示表情图标；日历与统计不受影响 */
  checkinIcons: boolean;
  reminder: {
    enabled: boolean;
    baseDays: number;
    minDays: number;
    maxDays: number;
    /** "22:00" */
    quietFrom: string;
    /** "08:00" */
    quietTo: string;
    lastPromptAt?: number;
  };
  ai: {
    enabled: boolean;
    /** 提交后自动解读 */
    autoRun: boolean;
    /** 提示词里带几次历史记录 */
    maxContextRecords: number;
    /** 用户追加的提示词 */
    promptExtra?: string;
  };
}

/** 设置面板里改的题目（导入题库） */
export interface ImportedBank {
  name?: string;
  questions: QuizQuestion[];
}

// **************************************** Stats ****************************************

export interface MoodPoint {
  id: string;
  /** 当天 0 点的时间戳 */
  day: number;
  at: number;
  score: number;
}

export interface MoodSummary {
  count: number;
  average: number;
  /** 相对上一个等长周期的变化 */
  change: number;
  /** 标准差，越小越稳定 */
  volatility: number;
  latest?: number;
}

export interface KeywordCount {
  word: string;
  count: number;
}

/** AI 生成的一段时间的心情卡片 */
export interface MoodReport {
  at: number;
  rangeDays: number;
  mood?: string;
  keywords?: string[];
  analysis?: string;
  advice?: AiAdvice[];
  practice?: string;
  raw?: string;
}
