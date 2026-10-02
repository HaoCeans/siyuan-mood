<template>
  <div class="mood-am">
    <div class="mood-am__head">
      <span />
      <span />
      <span
        v-for="label in scaleLabels"
        :key="label"
        class="mood-am__head-cell"
      >{{ label }}</span>
    </div>

    <section
      v-for="group in groups"
      :key="group.key"
      class="mood-am__group"
    >
      <div class="mood-am__group-head">
        <span
          class="mood-am__group-dot"
          :style="{ background: DIMENSION_COLORS[group.key] }"
        />
        <span class="mood-am__group-name">{{ group.name }}</span>
        <span class="spacer" />
        <span
          v-if="typeof group.score === 'number'"
          class="mood-am__group-score"
        >{{ group.score }}</span>
      </div>

      <template
        v-for="row in group.rows"
        :key="row.answer.questionId"
      >
        <!-- 计分题（单选/多选）：序号 + 题干 + 4 格刻度 -->
        <div
          v-if="row.answer.score >= 0"
          class="mood-am__row"
          :title="rowTitle(row.answer)"
        >
          <span class="mood-am__no">{{ row.no }}</span>
          <span class="mood-am__q">{{ row.answer.questionText }}</span>
          <span
            v-for="level in 4"
            :key="level"
            class="mood-am__cell"
            :class="{ 'mood-am__cell--on': row.answer.score === level - 1 }"
            :style="row.answer.score === level - 1 ? { background: SCALE_COLORS[row.answer.score] } : undefined"
            :title="cellTitle(row.answer, level - 1)"
          />
        </div>

        <!-- 填空 / 不计分题（如「当下需求」维度）：整行文字 -->
        <div
          v-else
          class="mood-am__row mood-am__row--note"
          :title="rowTitle(row.answer)"
        >
          <span class="mood-am__no">{{ row.no }}</span>
          <div class="mood-am__textwrap">
            <span class="mood-am__q">{{ row.answer.questionText }}</span>
            <span class="mood-am__a">{{ answerText(row.answer) }}</span>
          </div>
        </div>

        <!-- 多选题：所选标签小字标注 -->
        <div
          v-if="row.answer.type === 'multiple' && row.answer.optionLabels.length"
          class="mood-am__extra"
        >
          └ {{ row.answer.optionLabels.join('、') }}
        </div>
      </template>
    </section>

    <!-- 收尾填空：用户自己的原话，独立于维度矩阵，收尾放在最后 -->
    <div
      v-if="ownWords.length"
      class="mood-am__own"
    >
      <div class="mood-am__own-title">{{ t('ownWordsTitle') }}</div>
      <div
        v-for="row in ownWords"
        :key="row.answer.questionId"
        class="mood-am__own-item"
      >
        <span class="mood-am__own-q">{{ row.no }}. {{ row.answer.questionText }}</span>
        <span class="mood-am__own-a">{{ row.answer.text }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 本次作答的「作答矩阵」：行 = 题目（按维度分组），列 = 统一的 0-3 分数刻度。
 * 灵感来自量表问卷的矩阵题（行列对齐、勾选交叉格），把纯文字列表变成一眼可扫的格子：
 * 选中格按分数着色（沿用心情分级的语义色：差→红，好→绿），哪题拖了后腿一眼可见。
 * 数据零额外存储：answer.score 就是格子坐标；选项原文的悬停提示取自当前题库（老记录对不上时只显示档位文案）。
 */
import { computed } from 'vue'
import { answerText } from '@/quiz/score'
import { activeQuestions } from '@/store'
import { t } from '@/plugin'
import { DIMENSIONS, type Dimension, type QuizAnswer, type QuizOption, type QuizRecord } from '@/types/mood'

const props = defineProps<{ record: QuizRecord }>()

/** 统一 4 档列头：列对齐是矩阵可扫性的关键，各题选项原文放悬停提示 */
const scaleLabels = computed(() => [t('scale0'), t('scale1'), t('scale2'), t('scale3')])

/** 与心情分级同一套语义色：0 很差 → 3 平稳 */
const SCALE_COLORS = [
  'var(--b3-card-error-color)',
  'var(--b3-card-warning-color)',
  'var(--b3-card-info-color)',
  'var(--b3-card-success-color)',
]

/** 维度识别色（图表里同一维度始终同色） */
const DIMENSION_COLORS: Record<Dimension, string> = {
  body: '#5b8def',
  recognition: '#9a6fd0',
  energy: '#e2a03f',
  avoidance: '#d66a5c',
  need: '#55a6a0',
}

interface MatrixRow { no: number; answer: QuizAnswer }
interface MatrixGroup { key: Dimension; name: string; score?: number; rows: MatrixRow[] }

/** 全部作答统一编号：矩阵和「我自己的话」共用一套行号，与「本次作答（n）」对得上 */
const numbered = computed<MatrixRow[]>(() =>
  (props.record.answers || []).map((answer, index) => ({ no: index + 1, answer })),
)

/** 收尾填空（用户自己的话）：从矩阵里独立出来；留空的渲染不出来 */
const ownWords = computed<MatrixRow[]>(() =>
  numbered.value.filter((row) => row.answer.type === 'text' && (row.answer.text || '').trim()),
)

/** 按维度分组（组序沿用固定维度表）；文字题已抽走到「我自己的话」 */
const groups = computed<MatrixGroup[]>(() => {
  const map = new Map<Dimension, MatrixRow[]>()
  for (const row of numbered.value) {
    if (row.answer.type === 'text') continue
    const list = map.get(row.answer.dimension) || []
    list.push(row)
    map.set(row.answer.dimension, list)
  }
  return DIMENSIONS.filter((d) => map.has(d.key)).map((d) => ({
    key: d.key,
    name: d.name,
    score: props.record.dimensionScores?.[d.key],
    rows: map.get(d.key)!,
  }))
})

/** 当前题库的选项表，用于给每个档位格补选项原文提示（老记录题库变过就只显示档位文案） */
const bankOptions = computed(() => {
  const map = new Map<string, QuizOption[]>()
  for (const question of activeQuestions()) map.set(question.id, question.options)
  return map
})

function cellTitle(answer: QuizAnswer, level: number): string {
  const labels = (bankOptions.value.get(answer.questionId) || [])
    .filter((option) => option.score === level)
    .map((option) => option.label)
  return labels.length ? `${scaleLabels.value[level]}：${labels.join('、')}` : scaleLabels.value[level]
}

function rowTitle(answer: QuizAnswer): string {
  return `${answer.questionText}\n${answerText(answer)}`
}
</script>
