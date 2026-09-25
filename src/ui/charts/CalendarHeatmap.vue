<template>
  <div class="mood-heat">
    <div
      v-for="(column, ci) in columns"
      :key="ci"
      class="mood-heat__col"
    >
      <div
        v-for="cell in column"
        :key="cell.day"
        class="mood-heat__cell"
        :style="cellStyle(cell)"
        :title="title(cell)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CalendarCell } from '@/stats/aggregate'
import { moodLevel } from '@/quiz/score'
import { formatDateTime } from '@/utils/dom'
import { t } from '@/plugin'

defineProps<{ columns: CalendarCell[][] }>()

function cellStyle(cell: CalendarCell): Record<string, string> {
  if (cell.future) return { opacity: '0.25' }
  if (cell.score === null) return {}
  const level = moodLevel(cell.score)
  return { background: level.color, opacity: '0.9' }
}

function title(cell: CalendarCell): string {
  const day = formatDateTime(cell.day).slice(0, 10)
  if (cell.score === null) return `${day}｜${t('heatNoRecord')}`
  return `${day}｜${cell.score}（${moodLevel(cell.score).label}）`
}
</script>
