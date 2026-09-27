<template>
  <div class="mood-weekday">
    <div
      v-for="stat in stats"
      :key="stat.weekday"
      class="mood-weekday__col"
      :title="tooltip(stat)"
    >
      <div class="mood-weekday__track">
        <div
          class="mood-weekday__bar"
          :style="{ height: barHeight(stat), background: barColor(stat) }"
        />
      </div>
      <span
        class="mood-weekday__label"
        :class="{ 'mood-weekday__label--today': stat.weekday === todayIndex }"
      >{{ stat.label }}</span>
      <span class="mood-weekday__count">{{ stat.count || '·' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { moodLevel } from '@/quiz/score'
import type { WeekdayStat } from '@/stats/aggregate'

defineProps<{ stats: WeekdayStat[] }>()

const todayIndex = computed(() => (new Date().getDay() + 6) % 7)

function barHeight(stat: WeekdayStat): string {
  if (!stat.count) return '2px'
  return `${Math.max(3, Math.round((stat.avg / 100) * 44))}px`
}

function barColor(stat: WeekdayStat): string {
  if (!stat.count) return 'var(--b3-theme-surface-lighter)'
  return moodLevel(stat.avg).color
}

function tooltip(stat: WeekdayStat): string {
  if (!stat.count) return `周${stat.label}：没有记录`
  return `周${stat.label}：平均 ${stat.avg}（${stat.count} 次）`
}
</script>
