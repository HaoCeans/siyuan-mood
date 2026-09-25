/** 内置题库：24 题，全部只问「此刻」 */
import type { QuizQuestion } from "@/types/mood";

/** 内置题都带 source / enabled，写题库时不必重复 */
type QuestionSeed = Omit<QuizQuestion, "source" | "enabled">;

function q(question: QuestionSeed): QuizQuestion {
  return { ...question, source: "builtin", enabled: true };
}

export const BUILTIN_QUESTIONS: QuizQuestion[] = [
  // **************************************** 身体觉察 ****************************************
  q({
    id: "body-1",
    dimension: "body",
    type: "single",
    weight: 1,
    text: "现在，你身体哪个部位的感觉最明显？",
    options: [
      { id: "A", label: "能清楚说出一个部位（比如肩膀发紧、胃部发空）", score: 3, tags: ["身体信号清晰"] },
      { id: "B", label: "大概有感觉，但说不清具体在哪", score: 2, tags: ["身体信号模糊"] },
      { id: "C", label: "没什么特别的感觉", score: 1, tags: ["身体钝感"] },
      { id: "D", label: "身体很沉、很累或很紧，但不太想去感受它", score: 0, tags: ["身体过载"] },
    ],
  }),
  q({
    id: "body-2",
    dimension: "body",
    type: "single",
    weight: 1,
    text: "此刻你的呼吸是：",
    options: [
      { id: "A", label: "平稳、自然", score: 3, tags: ["呼吸平稳"] },
      { id: "B", label: "有点浅，或者需要刻意深呼吸", score: 2, tags: ["呼吸浅"] },
      { id: "C", label: "没注意过", score: 1, tags: ["身体钝感"] },
      { id: "D", label: "有点闷、发堵，呼吸不太顺", score: 0, tags: ["胸闷"] },
    ],
  }),
  q({
    id: "body-3",
    dimension: "body",
    type: "single",
    weight: 1,
    text: "现在你的肩膀和下巴：",
    options: [
      { id: "A", label: "是松的", score: 3, tags: ["身体放松"] },
      { id: "B", label: "有一点点用力，但不难受", score: 2 },
      { id: "C", label: "明显绷着", score: 1, tags: ["紧绷"] },
      { id: "D", label: "很紧，甚至有点酸或疼", score: 0, tags: ["身体紧张"] },
    ],
  }),
  q({
    id: "body-4",
    dimension: "body",
    type: "single",
    weight: 1,
    text: "此刻身体给你的感觉更像：",
    options: [
      { id: "A", label: "有力气，想动一动", score: 3, tags: ["有活力"] },
      { id: "B", label: "还行，能撑住", score: 2 },
      { id: "C", label: "想坐下或躺一会儿", score: 1, tags: ["疲惫"] },
      { id: "D", label: "已经很沉了，不太想理它", score: 0, tags: ["耗竭"] },
    ],
  }),

  // **************************************** 情绪识别 ****************************************
  q({
    id: "recognition-1",
    dimension: "recognition",
    type: "single",
    weight: 1,
    text: "现在这一刻，你的情绪更像：",
    options: [
      { id: "A", label: "平静、放松", score: 3, tags: ["平静"] },
      { id: "B", label: "有点烦躁或焦虑", score: 2, tags: ["烦躁", "焦虑"] },
      { id: "C", label: "有点低落，或者空", score: 1, tags: ["低落"] },
      { id: "D", label: "说不清，好像没什么感觉", score: 0, tags: ["情绪模糊"] },
    ],
  }),
  q({
    id: "recognition-2",
    dimension: "recognition",
    type: "single",
    weight: 1,
    text: "如果给此刻的情绪起个名字，你能做到吗？",
    options: [
      { id: "A", label: "能，很清楚是什么", score: 3, tags: ["情绪清晰"] },
      { id: "B", label: "大概能，但不太确定", score: 2, tags: ["情绪模糊"] },
      { id: "C", label: "只能说是「舒服」或「不舒服」", score: 1, tags: ["情绪粗糙"] },
      { id: "D", label: "完全说不出来", score: 0, tags: ["情绪说不清"] },
    ],
  }),
  q({
    id: "recognition-3",
    dimension: "recognition",
    type: "single",
    weight: 1,
    text: "此刻你脑子里反复出现的是：",
    options: [
      { id: "A", label: "没什么反复出现的念头", score: 3, tags: ["思绪清空"] },
      { id: "B", label: "一些待办和担心", score: 2, tags: ["思绪多"] },
      { id: "C", label: "一件具体的事，越想越烦", score: 1, tags: ["反刍"] },
      { id: "D", label: "一片空白，或者很吵但抓不住", score: 0, tags: ["思绪失控"] },
    ],
  }),
  q({
    id: "recognition-4",
    dimension: "recognition",
    type: "single",
    weight: 1,
    text: "现在如果有人问你「你怎么了」，你会：",
    options: [
      { id: "A", label: "能直接说出来", score: 3, tags: ["能表达"] },
      { id: "B", label: "想一下，能说个大概", score: 2 },
      { id: "C", label: "说「没事」，然后换个话题", score: 1, tags: ["习惯性回避"] },
      { id: "D", label: "反问对方「我怎么了」", score: 0, tags: ["情绪失联"] },
    ],
  }),
  q({
    id: "recognition-5",
    dimension: "recognition",
    type: "multiple",
    weight: 1,
    text: "此刻你心里最主要的几种感觉是？（可多选）",
    options: [
      { id: "A", label: "累", score: 1, tags: ["疲惫"] },
      { id: "B", label: "烦", score: 1, tags: ["烦躁"] },
      { id: "C", label: "委屈", score: 1, tags: ["委屈"] },
      { id: "D", label: "慌", score: 1, tags: ["焦虑"] },
      { id: "E", label: "空", score: 0, tags: ["空虚"] },
      { id: "F", label: "平静", score: 3, tags: ["平静"] },
    ],
  }),

  // **************************************** 能量状态 ****************************************
  q({
    id: "energy-1",
    dimension: "energy",
    type: "single",
    weight: 1,
    text: "此刻你的能量水平：",
    options: [
      { id: "A", label: "有精神，想做点什么", score: 3, tags: ["精力充足"] },
      { id: "B", label: "一般，能做事但不想主动", score: 2 },
      { id: "C", label: "有点累，想躺着", score: 1, tags: ["疲惫"] },
      { id: "D", label: "很空、很沉，什么都不想做", score: 0, tags: ["耗竭"] },
    ],
  }),
  q({
    id: "energy-2",
    dimension: "energy",
    type: "single",
    weight: 1,
    text: "现在让你做一件需要专注的事，你会：",
    options: [
      { id: "A", label: "可以马上开始", score: 3, tags: ["专注力在线"] },
      { id: "B", label: "需要缓一缓才能进入", score: 2 },
      { id: "C", label: "很难集中，容易走神", score: 1, tags: ["难以专注"] },
      { id: "D", label: "完全做不到，只想躲开", score: 0, tags: ["过载"] },
    ],
  }),
  q({
    id: "energy-3",
    dimension: "energy",
    type: "single",
    weight: 1,
    text: "此刻你对时间的感觉：",
    options: [
      { id: "A", label: "挺踏实的，知道接下来要做什么", score: 3, tags: ["有掌控感"] },
      { id: "B", label: "有点赶，事情堆着", score: 2, tags: ["压力"] },
      { id: "C", label: "过得很慢，或者很空", score: 1, tags: ["时间感失真"] },
      { id: "D", label: "完全不想去想接下来", score: 0, tags: ["逃避未来"] },
    ],
  }),
  q({
    id: "energy-4",
    dimension: "energy",
    type: "single",
    weight: 1,
    text: "现在你更想要的是：",
    options: [
      { id: "A", label: "保持现在的状态，做点事", score: 3 },
      { id: "B", label: "休息一下", score: 2, tags: ["需要休息"] },
      { id: "C", label: "有人听我说说话", score: 1, tags: ["需要倾听"] },
      { id: "D", label: "离开现在的环境或事情", score: 0, tags: ["想逃离"] },
    ],
  }),

  // **************************************** 情绪回避 ****************************************
  q({
    id: "avoidance-1",
    dimension: "avoidance",
    type: "single",
    weight: 1,
    text: "此刻你有没有正在躲开的东西？",
    options: [
      { id: "A", label: "没有，挺踏实", score: 3 },
      { id: "B", label: "有一点，但能面对", score: 2 },
      { id: "C", label: "有，正在用刷手机、吃东西之类的方式躲开", score: 1, tags: ["回避行为"] },
      { id: "D", label: "有，但说不清在躲什么", score: 0, tags: ["模糊回避"] },
    ],
  }),
  q({
    id: "avoidance-2",
    dimension: "avoidance",
    type: "single",
    weight: 1,
    text: "如果现在手机突然没电：",
    options: [
      { id: "A", label: "没什么，正好休息一下", score: 3 },
      { id: "B", label: "有点无聊，但能接受", score: 2 },
      { id: "C", label: "有点慌，想赶紧找点事做", score: 1, tags: ["不安"] },
      { id: "D", label: "会很烦躁，不知道手往哪放", score: 0, tags: ["躁动"] },
    ],
  }),
  q({
    id: "avoidance-3",
    dimension: "avoidance",
    type: "single",
    weight: 1,
    text: "此刻你身体的紧张和你的心情：",
    options: [
      { id: "A", label: "是一致的，紧张是有原因的", score: 3, tags: ["身心一致"] },
      { id: "B", label: "大概对得上", score: 2 },
      { id: "C", label: "身体紧着，但好像没觉得有什么情绪", score: 1, tags: ["身心脱节"] },
      { id: "D", label: "完全对不上，说不清", score: 0, tags: ["身心失联"] },
    ],
  }),
  q({
    id: "avoidance-4",
    dimension: "avoidance",
    type: "single",
    weight: 1,
    text: "回头看今天，有没有过「突然很烦但说不清为什么」？",
    options: [
      { id: "A", label: "没有", score: 3 },
      { id: "B", label: "偶尔", score: 2 },
      { id: "C", label: "有几次", score: 1, tags: ["无名烦躁"] },
      { id: "D", label: "几乎一直是这样", score: 0, tags: ["情绪淹没"] },
    ],
  }),
  q({
    id: "avoidance-5",
    dimension: "avoidance",
    type: "multiple",
    weight: 1,
    text: "此刻你已经做了什么来应对？（可多选）",
    options: [
      { id: "A", label: "深呼吸，或者走动一下", score: 3, tags: ["主动调节"] },
      { id: "B", label: "找人聊了聊", score: 3, tags: ["寻求支持"] },
      { id: "C", label: "刷手机", score: 1, tags: ["刷手机回避"] },
      { id: "D", label: "吃东西", score: 1, tags: ["吃东西安抚"] },
      { id: "E", label: "硬扛着", score: 1, tags: ["硬撑"] },
      { id: "F", label: "什么都没做", score: 0, tags: ["未应对"] },
    ],
  }),

  // **************************************** 当下需求（不计分） ****************************************
  q({
    id: "need-1",
    dimension: "need",
    type: "single",
    weight: 1,
    text: "此刻你最需要的是：",
    options: [
      { id: "A", label: "什么都不需要，挺好", tags: ["状态良好"] },
      { id: "B", label: "休息，或者睡一觉", tags: ["需要休息"] },
      { id: "C", label: "有人听我说说话", tags: ["需要倾听"] },
      { id: "D", label: "一个明确的方向或下一步", tags: ["需要方向"] },
    ],
  }),
  q({
    id: "need-2",
    dimension: "need",
    type: "single",
    weight: 1,
    text: "如果你是旁观者看着此刻的自己，会觉得这个人：",
    options: [
      { id: "A", label: "挺放松的", tags: ["放松"] },
      { id: "B", label: "有点累", tags: ["疲惫"] },
      { id: "C", label: "在硬撑", tags: ["硬撑"] },
      { id: "D", label: "快撑不住了", tags: ["过载"] },
    ],
  }),
  q({
    id: "need-3",
    dimension: "need",
    type: "single",
    weight: 1,
    text: "现在最想对自己说的一句话是：",
    options: [
      { id: "A", label: "「现在这样挺好」", tags: ["接纳"] },
      { id: "B", label: "「我有点累，需要停一停」", tags: ["需要休息"] },
      { id: "C", label: "「我不知道自己怎么了」", tags: ["困惑"] },
      { id: "D", label: "「我不想面对现在的事」", tags: ["想逃避"] },
    ],
  }),
  q({
    id: "need-4",
    dimension: "need",
    type: "single",
    weight: 1,
    text: "此刻你希望有人为你做什么：",
    options: [
      { id: "A", label: "什么都不用做", tags: ["状态良好"] },
      { id: "B", label: "陪我停一会儿", tags: ["需要陪伴"] },
      { id: "C", label: "帮我说清楚现在的感受", tags: ["需要梳理"] },
      { id: "D", label: "告诉我下一步该做什么", tags: ["需要方向"] },
    ],
  }),
  q({
    id: "need-5",
    dimension: "need",
    type: "multiple",
    weight: 1,
    text: "此刻你身上出现了哪些信号？（可多选）",
    options: [
      { id: "A", label: "肩膀或脖子紧", tags: ["紧绷"] },
      { id: "B", label: "胸口闷或空", tags: ["胸闷"] },
      { id: "C", label: "胃部不适", tags: ["胃部不适"] },
      { id: "D", label: "下巴或牙关咬紧", tags: ["咬紧"] },
      { id: "E", label: "手心出汗", tags: ["手心出汗"] },
      { id: "F", label: "什么都没感觉到", tags: ["身体钝感"] },
    ],
  }),
  q({
    id: "need-6",
    dimension: "need",
    type: "multiple",
    weight: 1,
    text: "此刻让你不舒服的事属于哪一类？（可多选）",
    options: [
      { id: "A", label: "工作或学习任务", tags: ["任务压力"] },
      { id: "B", label: "人际关系", tags: ["关系困扰"] },
      { id: "C", label: "对未来的担心", tags: ["未来焦虑"] },
      { id: "D", label: "对自己的评价", tags: ["自我评价"] },
      { id: "E", label: "身体状态", tags: ["身体不适"] },
      { id: "F", label: "说不清", tags: ["说不清来源"] },
    ],
  }),
  q({
    id: "need-7",
    dimension: "need",
    type: "multiple",
    weight: 1,
    text: "现在你需要哪方面的帮助？（可多选）",
    options: [
      { id: "A", label: "理清感受", tags: ["需要梳理"] },
      { id: "B", label: "一个具体的小动作", tags: ["需要行动"] },
      { id: "C", label: "一句话安慰", tags: ["需要安慰"] },
      { id: "D", label: "暂时不用帮助", tags: ["状态良好"] },
    ],
  }),
];
