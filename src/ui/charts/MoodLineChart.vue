<template>
  <svg
    class="mood-chart"
    :viewBox="`0 0 ${W} ${H}`"
    preserveAspectRatio="none"
    :style="{ height: `${H}px` }"
  >
    <defs>
      <linearGradient
        id="mood-area-grad"
        x1="0"
        y1="0"
        x2="0"
        y2="1"
      >
        <stop
          offset="0%"
          stop-color="var(--b3-theme-primary)"
          stop-opacity="0.22"
        />
        <stop
          offset="100%"
          stop-color="var(--b3-theme-primary)"
          stop-opacity="0"
        />
      </linearGradient>
    </defs>

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

    <!-- 渐变面积 + 折线 -->
    <path
      v-if="areaPath"
      :d="areaPath"
      fill="url(#mood-area-grad)"
      stroke="none"
    />
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

    <!-- 数据点：颜色即状态 -->
    <circle
      v-for="(point, i) in points"
      :key="point.id"
      class="dot"
      :cx="x(i)"
      :cy="y(point.score)"
      r="2.8"
      :fill="dotColor(point.score)"
      :stroke="'var(--b3-theme-surface)'"
      stroke-width="1"
    >
      <title>{{ tooltip(point) }}</title>
    </circle>

    <!-- 横轴日期刻度：约 4 个 -->
    <text
      v-for="tick in dateTicks"
      :key="`d-${tick.index}`"
      :x="x(tick.index)"
      :y="H - 4"
      :text-anchor="tick.anchor"
    >{{ tick.label }}</text>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MoodPoint } from '@/types/mood'
import { formatDateTime, formatMonthDay } from '@/utils/dom'
import { moodLevel } from '@/quiz/score'

const props = defineProps<{ points: MoodPoint[]; averages?: number[] }>()

const W = 320
const H = 150
const PAD = { l: 24, r: 8, t: 10, b: 18 }
const ticks = [100, 50, 0]

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

const areaPath = computed(() => {
  if (props.points.length < 2) return ''
  const base = H - PAD.b
  return `${linePath.value} L${x(props.points.length - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`
})

const avgPath = computed(() => {
  const list = props.averages || []
  if (list.length !== props.points.length) return ''
  return list.map((value, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(value).toFixed(1)}`).join(' ')
})

const dateTicks = computed(() => {
  const n = props.points.length
  if (n < 2) return []
  const anchors = ['start', 'middle', 'middle', 'end']
  return [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1].map((index, i) => ({
    index,
    label: formatMonthDay(props.points[index].at),
    anchor: anchors[i],
  }))
})

function dotColor(score: number): string {
  return moodLevel(score).color
}

function tooltip(point: MoodPoint): string {
  return `${formatDateTime(point.at)}｜${point.score}（${moodLevel(point.score).label}）`
}
</script>
