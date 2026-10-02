/** 提示词模板：首次解读 / 复测对比 / 周报。全部要求只输出 JSON，解析失败时兜底渲染原文 */
import { DIMENSION_MAP } from "@/types/mood";
import type { CheckIn, QuizQuestion, QuizRecord } from "@/types/mood";
import { normalizeAiQuestions } from "@/quiz/markdownBank";
import { weatherLabel } from "@/quiz/emotions";
import { answerText } from "@/quiz/score";
import { formatDateTime, formatMonthDay, formatTime } from "@/utils/dom";

const JSON_ONLY = "请只输出一个 JSON 对象，不要输出任何解释性文字，不要使用代码块围栏。";

const TONE_RULES = [
  "描述此刻的状态，不做医学诊断，不使用「你有……症」「你是……型人格」这类标签。",
  "advice 固定给 2 条，必须是 10 分钟内能做完的具体小动作，不要写「要放松」「多运动」。两条里一条偏安抚身体、一条偏处理事情，除非用户状态很低——那时两条都以安抚为主。",
  "历史记录里的建议执行情况是用户的真实反馈：标了「做了」且之后心情分高的，说明这类做法对他有效，本次 advice 优先延续同类方向；标了「没做」或卡住的，不要再原样重复，换一个门槛更低的起步版本，并在 analysis 里说明换法。",
  "keywords 给 3-5 个中文短语，尽量来自下面的作答，不要生造。",
  "如果心情分低于 20，第一条 advice 以安抚身体为主，不布置任务。",
  "情绪标注（给情绪起名字）本身就有调节作用。用户起了名字就在 analysis 里回应它；没起名或写了「说不上来」，就温和地给 1-2 个可能的候选词帮他把感受标出来，不要替他下结论。",
  "用户勾选的身体信号（睡眠、食欲、动力、社交等）是情绪的前体，分析时把它们和情绪名称联系起来。",
  "若有「最近快速打卡」，把它当成一天内更细的轨迹：早晚状态的变化、反复出现的词，都值得在 analysis 里点出来。打卡里带「记：…」的是用户顺手写的事件（当时经历了什么）：事件往往是情绪的来源，把情绪和事件对应起来分析，这是比分数更有价值的线索。",
  "「绑定的思源块」是用户自己写的相关记录（最近的经历、日记等）：从里面找与情绪对应的具体线索（事件、对话、时间点），在 analysis 里点出来它们和情绪的对应关系；引用要短，不要大段摘抄。",
  "排版要求：analysis 和 changes 必须用 Markdown——拆成 2-3 个短段落，每段以**加粗的小标题**开头（如 **变化**、**模式**、**为什么**），段落之间空一行；能分点的写成 - 列表。绝不允许写成一大段。多用这些样式让阅读更容易：**加粗**关键发现、==高亮==最值得注意的一句、- 列表罗列并列的点；对比分数时写「75 → 67」这种箭头形式。可用的强调样式：**加粗**、*斜体*、==高亮==、<u>下划线</u>、~~删除线~~；除这五种外不要输出其它 HTML 标签。practice 一句话即可。",
];

const SCHEMA = `{
  "mood": "一句话概括此刻状态，例如「低能量 + 情绪模糊 + 轻度回避」",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "analysis": "**变化**：心情 75 → 67，情绪识别和能量各降 17 分\\n**模式**：\\n- 回避连续第三次满分\\n- 下午的打卡从平静滑到疲惫\\n**为什么**：可能用「现在这样挺好」在暂时稳住自己",
  "advice": [{ "text": "一条具体的小动作" }],
  "practice": "一个可以在这几天做的练习，一句话"
}`;

function answerLines(record: QuizRecord): string {
  return record.answers
    .map((a) => {
      const dim = DIMENSION_MAP[a.dimension]?.name || a.dimension;
      return `- [${dim}] ${a.questionText} → ${answerText(a)}`;
    })
    .join("\n");
}

/** 事件记录进提示词时截断，避免一段长叙事挤占上下文 */
function truncateText(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

/**
 * 打卡轨迹的统一行格式：时间 + 情绪词 + 天气 + 事件（用户顺手记的）。
 * mark 用于在「打卡小建议」里标出刚打卡的条目（▶），其余场景留空。
 */
function checkinLine(entry: CheckIn, mark = ""): string {
  const weather = entry.weather ? `（天气：${weatherLabel(entry.weather)}）` : "";
  const note = entry.note ? `｜记：${truncateText(entry.note, 60)}` : "";
  return `- ${mark}${mark ? " " : ""}${formatMonthDay(entry.at)} ${formatTime(entry.at)} ${entry.word}${weather}${note}`;
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
            return `  · ${f.source === "user" ? "[他自己写的] " : ""}${f.adviceText} —— ${state}${extra ? `（${extra}）` : ""}`;
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
  /** 测评之前的快速打卡（细粒度轨迹），最多带几条 */
  checkins?: CheckIn[];
  /** 用户绑定的思源块内容（最近的经历等），已截断 */
  blockContext?: string;
  extra?: string;
}): string {
  const { record, history, checkins, blockContext, extra } = params;
  const first = !history.length;

  const checkinLines = (checkins || [])
    .map((entry) => checkinLine(entry))
    .join("\n");
  const checkinBlock = checkinLines
    ? `\n最近快速打卡（用户随时记的，一天内可能有多次）：\n${checkinLines}\n`
    : "";
  const boundBlock = blockContext ? `\n<绑定的思源块>\n${blockContext}\n</绑定的思源块>\n` : "";

  const rules = [
    ...TONE_RULES,
    first ? "" : "额外输出 changes 字段：和上次相比哪个维度动了、上次哪条建议有效、哪条卡住了、可能卡在哪。",
  ].filter(Boolean);

  const schema = first
    ? SCHEMA
    : SCHEMA.replace(/\n}$/, ',\n  "changes": "**分数**：和上次比哪里动了\\n**原因**：结合打卡轨迹推测为什么\\n**上次的建议**：哪条有效、哪条卡住（可分点）"\n}');

  return `你是一位温和、不评判的情绪觉察教练。下面是用户刚刚完成的一次心情自评（只问此刻的状态）。
${JSON_ONLY}

${historyBlock(history)}${checkinBlock}${boundBlock}<本次作答>
情绪名称：${record.moodName || "（用户没有起名）"}
身体信号：${record.signals?.length ? record.signals.join("、") : "无"}
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

/** 跟进复盘：用户标了「做了没有 / 做完之后什么感觉」之后，结合之后的打卡轨迹看哪条建议真的有用 */
export function buildFollowReviewPrompt(record: QuizRecord, checkins: CheckIn[] = []): string {
  const advice = record.ai.advice?.length
    ? record.ai.advice.map((item, i) => `${i + 1}. ${item.text}`).join("\n")
    : "（这次没有给出建议）";

  const filled = record.followUps.filter((f) => f.done !== "unset");
  const pending = record.followUps.length - filled.length;
  const lines = filled
    .map((f, i) => {
      const done = f.done === "yes" ? "做了" : f.done === "partial" ? "做了一部分" : "没做";
      const extra = [
        f.blocker ? `卡在${f.blocker}` : "",
        typeof f.feeling === "number" ? `之后心情 ${f.feeling}/5` : "",
        f.note ? `感受：${f.note}` : "",
      ]
        .filter(Boolean)
        .join("；");
      return `${i + 1}. ${f.source === "user" ? "[他自己写的] " : ""}${f.adviceText} —— ${done}${extra ? `（${extra}）` : ""}`;
    })
    .join("\n");

  // 做完建议之后的打卡轨迹（按时间从旧到新）：效果好不好，不能只听标记，还要看状态怎么走
  const checkinLines = checkins
    .map((entry) => checkinLine(entry))
    .join("\n");
  const checkinBlock = checkinLines
    ? `\n<测评之后的打卡轨迹>\n（从那次测评到现在，用户随手记的，按时间排）\n${checkinLines}\n</测评之后的打卡轨迹>\n`
    : "";

  return `你是一位温和、不评判的情绪觉察教练。用户此前做过一次心情自评，你给过建议；现在他回来标记了每条建议的执行情况。
${JSON_ONLY}

<当时的记录>
日期：${formatDateTime(record.finishedAt)}
心情分：${record.moodScore}（0-100，越高越平稳）
维度得分：${dimensionLine(record)}
关键词：${(record.ai.keywords || record.keywordLocal).join("、") || "无"}
你当时给的建议：
${advice}
</当时的记录>

<执行情况>
${lines}
${pending > 0 ? `（另有 ${pending} 条还没标记）` : ""}
</执行情况>
${checkinBlock}
<输出要求>
1. 老实说哪条有用、哪条没用，依据是上面的「之后心情」与感受，不要泛泛而谈。
2. 若有「测评之后的打卡轨迹」，把建议的效果放进连续状态里看：做了建议之后打卡是好转、持平还是回落；轨迹和标记若对不上（标了做了、状态却更差），诚实点出来。
3. 没做不等于失败，重点看卡在哪，把建议改得更小、更容易开始。
4. 不做医学诊断，不使用「你有……症」「你是……型人格」这类标签。
5. next 给 1-2 条，要比上次更具体、更容易做到。
6. 排版：analysis 先一句总评，再用 - 列表分点（每点以**加粗小标签**开头），不要写成一大段。
</输出要求>

<输出格式>
{
  "analysis": "一句总评，然后 - 分点：每点以**加粗小标签**开头（如 **有效的**、**卡住的**、**下次的调整方向**）",
  "works": ["确实有效的做法"],
  "next": ["下次可以换成什么"]
}
</输出格式>`;
}

/** 用户自己的 Markdown 题目 → 题库：让 AI 判分类、分值与关键词 */
export function buildBankPrompt(markdown: string): string {
  return `下面是一位用户自己写的心情题目。请把它整理成题库 JSON。
${JSON_ONLY}

<用户的题目>
${markdown.slice(0, 6000)}
</用户的题目>

<整理要求>
1. 不要增删题目，也不要改写题干和选项的意思，只在必要处去掉编号和多余标点。
2. 每道题判断 dimension：body 身体觉察 / recognition 情绪识别 / energy 能量状态 / avoidance 情绪回避 / need 当下需求。
3. 每个选项给 score：0-3 的整数，数字越大表示此刻状态越好（3 = 很平稳、很在线，0 = 很吃力）。同一题里通常是好的选项分高、差的选项分低。
4. 每个选项给 1-2 个中文关键词 tags，会显示在记录里（例如「紧绷」「疲惫」「刷手机回避」）。
5. 判断 type：题目里提到「多选」就是 multiple；题目里是「填空」「自己说」「简述」这类意思的就是 text（不要给它编选项，options 给空数组）；其余是 single。
6. 用户写得少就按实际有的整理，不要自己编题。
</整理要求>

<输出格式>
{
  "questions": [
    {
      "text": "题干原文",
      "dimension": "body",
      "type": "single",
      "options": [
        { "label": "选项原文", "score": 3, "tags": ["身体放松"] },
        { "label": "选项原文", "score": 1, "tags": ["紧绷"] }
      ]
    }
  ]
}
</输出格式>`;
}

export function parseBankFromAi(text: string): QuizQuestion[] | null {
  const raw = extractJson(text);
  if (!raw || typeof raw !== "object") return null;
  const questions = normalizeAiQuestions((raw as { questions?: unknown }).questions);
  return questions.length ? questions : null;
}

/** 快速打卡后的一句小建议：把刚打卡的这条放进最近轨迹里连贯地看，输出短文本（不是 JSON） */
export function buildCheckinSuggestionPrompt(params: {
  /** 最近的打卡，新的在前（刚打卡的就在最前面） */
  entries: CheckIn[];
  /** 本次刚打卡的（多选时可能不止一条），会在轨迹里标 ▶ */
  justNow: CheckIn[];
  /** 最近已经给过的建议，要求这次换角度 */
  recent: string[];
  latestScore?: number;
}): string {
  const { entries, justNow, recent, latestScore } = params;
  const justIds = new Set(justNow.map((entry) => entry.id));
  const lines = entries
    .map((entry) => checkinLine(entry, justIds.has(entry.id) ? "▶" : ""))
    .join("\n");
  const recentBlock = recent.length
    ? `\n<最近已经给过的建议>\n${recent.map((text) => `- ${text}`).join("\n")}\n</最近已经给过的建议>\n`
    : "";

  return `你是一位温和、不评判的情绪觉察教练。用户刚随手记录了一次此刻的心情（快速打卡），下面是他最近的打卡轨迹（从新到旧，▶ 是刚打卡的）。
请把刚打卡的这条放进整段轨迹里连贯地看，而不是单独评论这一句：
- 和最近几次一致（比如连着几天都累）→ 顺着这个持续的状态往下说；
- 相比最近出现了转折（上午平静、下午转累；连日低落后今天转好）→ 点出这个变化，建议跟着变化走；
- 今天第一次打卡、没有轨迹可对比 → 就只回应这一条。
轨迹里带「记：…」的是用户顺手写下的事件（当时经历了什么）：把事件和情绪联系起来回应——事件往往就是情绪的来源。

请只输出建议正文本身：一两句话、总共不超过 60 个字，给一个马上能做的小动作，或一句安抚；不诊断、不贴标签、不要任何开场白和解释。最关键的那个动作可以用 **加粗** 强调，其余格式不要用。

<最近打卡>
${lines}
</最近打卡>
${recentBlock}
心情分（最近一次正式测评）：${typeof latestScore === "number" ? latestScore : "暂无"}`;
}

export function buildReportPrompt(records: QuizRecord[], rangeDays: number, checkins: CheckIn[] = []): string {
  const lines = records
    .map(
      (r) =>
        `${formatDateTime(r.finishedAt)}｜心情分 ${r.moodScore}｜${(r.ai.keywords || r.keywordLocal).join("、")}｜${r.dimensionScores ? Object.entries(r.dimensionScores).map(([k, v]) => `${DIMENSION_MAP[k as keyof typeof DIMENSION_MAP]?.name || k} ${v}`).join(" ") : ""}`,
    )
    .join("\n");

  // 这段时间的建议执行情况：哪些做法被用户验证有效，报告里值得点名
  const followLines = records
    .flatMap((r) =>
      r.followUps
        .filter((f) => f.done !== "unset")
        .map((f) => {
          const done = f.done === "yes" ? "做了" : f.done === "partial" ? "做了一部分" : "没做";
          const extra = [
            typeof f.feeling === "number" ? `之后心情 ${f.feeling}/5` : "",
            f.blocker ? `卡在${f.blocker}` : "",
          ]
            .filter(Boolean)
            .join("，");
          return `- ${formatMonthDay(r.finishedAt)} ${f.source === "user" ? "[他自己写的] " : ""}${f.adviceText} —— ${done}${extra ? `（${extra}）` : ""}`;
        }),
    )
    .slice(0, 20);
  const followBlock = followLines.length
    ? `\n<这段时间的建议执行情况>\n${followLines.join("\n")}\n</这段时间的建议执行情况>\n`
    : "";

  // 这段时间的快速打卡（按时间排，最多 20 条）：一天内的起伏是正式测评看不到的细节
  const checkinLines = checkins
    .map((entry) => checkinLine(entry))
    .join("\n");
  const checkinBlock = checkinLines
    ? `\n<这段时间的快速打卡>\n（按时间排）\n${checkinLines}\n</这段时间的快速打卡>\n`
    : "";

  return `你是一位温和、不评判的情绪觉察教练。下面是用户最近 ${rangeDays} 天的心情记录。
${JSON_ONLY}

<记录>
${lines || "（这段时间还没有记录）"}
</记录>
${followBlock}${checkinBlock}
<输出要求>
1. 总结这段时间的整体状态与变化趋势，不做医学诊断，不使用人格标签。
2. 指出一个最值得注意的模式（例如「累的时候更容易说不清感受」）；若有快速打卡，把一天内的起伏模式（如「下午总比上午差」）也算进去。
3. 若有建议执行情况，点出哪类做法被验证有效、哪类总被搁置，第三条的「具体小事」优先延续有效的方向。
4. 给出 2 条这段时间可以继续做的具体小事。
5. 排版：analysis 用 Markdown——先一句总评，再 - 分点（每点以**加粗小标签**开头，如 **趋势**、**模式**）；可用的强调样式：**加粗**、==高亮==、- 列表。分数对比写「75 → 67」这种箭头形式。
</输出要求>

<输出格式>
{
  "mood": "一句话概括这段时间的状态",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "analysis": "**趋势**：……\\n**模式**：……（- 分点）",
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

export interface ParsedFollowReview {
  analysis?: string;
  works?: string[];
  next?: string[];
}

export function parseFollowReview(text: string): ParsedFollowReview | null {
  const raw = extractJson(text);
  if (!raw || typeof raw !== "object") return null;
  const parsed: ParsedFollowReview = {
    analysis: typeof raw.analysis === "string" ? raw.analysis.trim() : undefined,
    works: toStringArray(raw.works),
    next: toStringArray(raw.next),
  };
  return parsed.analysis || parsed.works || parsed.next ? parsed : null;
}
