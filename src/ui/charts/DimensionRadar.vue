<template>
  <svg
    class="mood-chart"
    viewBox="0 0 320 200"
    :style="{ height: '200px' }"
  >
    <!-- 网格环 -->
    <polygon
      v-for="level in levels"
      :key="`grid-${level}`"
      class="grid-line"
      :points="polygonPoints(level)"
      fill="none"
    />

    <!-- 坐标轴与标签 -->
    <g
      v-for="(axis, i) in axes"
      :key="axis.key"
    >
      <line
        class="axis-line"
        :x1="CX"
        :y1="CY"
        :x2="pointAt(i, 100).x"
        :y2="pointAt(i, 100).y"
      />
      <text
        :x="labelAt(i).x"
        :y="labelAt(i).y"
        :text-anchor="labelAt(i).anchor"
      >{{ axis.name }}</text>
    </g>

    <!-- 均值 -->
    <polygon
      v-if="averageSeries"
      class="radar-area--prev"
      :points="polygonPointsOf(averageSeries)"
    />
    <!-- 本次 -->
    <polygon
      v-if="currentSeries"
      class="radar-area"
      :points="polygonPointsOf(currentSeries)"
    />

    <text
      v-for="(axis, i) in axes"
      :key="`value-${axis.key}`"
      :x="labelAt(i).x"
      :y="labelAt(i).y + 11"
      :text-anchor="labelAt(i).anchor"
    >{{ valueText(axis.key) }}</text>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DIMENSIONS, type Dimension } from '@/types/mood'

const props = defineProps<{
  current?: Partial<Record<Dimension, number>>
  average?: Partial<Record<Dimension, number>>
}>()

const CX = 160
const CY = 100
const R = 66
const levels = [25, 50, 75, 100]

const axes = computed(() => DIMENSIONS.filter((d) => d.scored))

function angle(index: number): number {
  return (Math.PI * 2 * index) / axes.value.length - Math.PI / 2
}

function pointAt(index: number, value: number): { x: number; y: number } {
  const rad = angle(index)
  const radius = (Math.max(0, Math.min(100, value)) / 100) * R
  return { x: CX + Math.cos(rad) * radius, y: CY + Math.sin(rad) * radius }
}

function polygonPoints(level: number): string {
  return axes.value.map((_, i) => {
    const p = pointAt(i, level)
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }).join(' ')
}

function polygonPointsOf(series: Partial<Record<Dimension, number>>): string {
  return axes.value.map((axis, i) => {
    const p = pointAt(i, series[axis.key] ?? 0)
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }).join(' ')
}

function labelAt(index: number): { x: number; y: number; anchor: string } {
  const rad = angle(index)
  const x = CX + Math.cos(rad) * (R + 24)
  const y = CY + Math.sin(rad) * (R + 20)
  const anchor = Math.abs(x - CX) < 12 ? 'middle' : x > CX ? 'start' : 'end'
  return { x, y, anchor }
}

function valueText(key: Dimension): string {
  const value = props.current?.[key]
  return typeof value === 'number' ? String(value) : '—'
}

const currentSeries = computed(() => props.current)
const averageSeries = computed(() => (props.average && Object.keys(props.average).length ? props.average : undefined))
</script>
