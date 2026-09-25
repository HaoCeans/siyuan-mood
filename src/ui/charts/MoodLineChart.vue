<template>
  <svg
    class="mood-chart"
    :viewBox="`0 0 ${W} ${H}`"
    preserveAspectRatio="none"
    :style="{ height: `${H}px` }"
  >
    <!-- 网格与刻度 -->
    <g>
      <template
        v-for="tick in ticks"
        :key="tick"
      >
        <line
          class="grid-line"
          :x1="PAD.l"
          :x2="W - PAD.r"
          :y1="y(tick)"
          :y2="y(tick)"
        />
        <text
          :x="PAD.l - 4"
          :y="y(tick) + 3"
          text-anchor="end"
        >{{ tick }}</text>
      </template>
    </g>

    <!-- 折线 -->
    <path
      v-if="points.length > 1"
      class="series"
      :d="linePath"
    />
    <path
      v-if="points.length > 1 && averages.length"
      class="series-avg"
      :d="avgPath"
    />

    <!-- 数据点 -->
    <circle
      v-for="(point, i) in points"
      :key="point.id"
      class="dot"
      :cx="x(i)"
      :cy="y(point.score)"
      r="2.6"
    >
      <title>{{ tooltip(point) }}</title>
    </circle>

    <!-- 首尾日期 -->
    <text
      v-if="points.length"
      :x="PAD.l"
      :y="H - 4"
      text-anchor="start"
    >{{ dayLabel(points[0].at) }}</text>
    <text
      v-if="points.length > 1"
      :x="W - PAD.r"
      :y="H - 4"
      text-anchor="end"
    >{{ dayLabel(points[points.length - 1].at) }}</text>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MoodPoint } from '@/types/mood'
import { formatDateTime, formatMonthDay } from '@/utils/dom'
import { moodLevel } from '@/quiz/score'

const props = defineProps<{ points: MoodPoint[]; averages?: number[] }>()

const W = 320
const H = 140
const PAD = { l: 24, r: 8, t: 10, b: 18 }
const ticks = [100, 75, 50, 25, 0]

function x(index: number): number {
  const usable = W - PAD.l - PAD.r
  if (props.points.length <= 1) return PAD.l + usable / 2
  return PAD.l + (index * usable) / (props.points.length - 1)
}

function y(score: number): number {
  const usable = H - PAD.t - PAD.b
  return PAD.t + (1 - Math.max(0, Math.min(100, score)) / 100) * usable
}

const linePath = computed(() =>
  props.points.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(point.score).toFixed(1)}`).join(' '),
)

const avgPath = computed(() => {
  const list = props.averages || []
  if (list.length !== props.points.length) return ''
  return list.map((value, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(value).toFixed(1)}`).join(' ')
})

function dayLabel(at: number): string {
  return formatMonthDay(at)
}

function tooltip(point: MoodPoint): string {
  return `${formatDateTime(point.at)}｜${point.score}（${moodLevel(point.score).label}）`
}
</script>
