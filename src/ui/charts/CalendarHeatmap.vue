<template>
  <div class="mood-cal">
    <div class="mood-cal__nav">
      <button
        class="mood-btn mood-btn--ghost mood-cal__nav-btn"
        :title="t('calPrevMonth')"
        @click="offset++"
      >‹</button>
      <span class="mood-cal__title">{{ month.label }}</span>
      <button
        class="mood-btn mood-btn--ghost mood-cal__nav-btn"
        :title="t('calNextMonth')"
        :disabled="isCurrent"
        @click="offset = Math.max(0, offset - 1)"
      >›</button>
      <button
        v-if="!isCurrent"
        class="mood-btn mood-btn--ghost mood-cal__today"
        @click="offset = 0"
      >
        {{ t('calThisMonth') }}
      </button>
    </div>

    <div class="mood-cal__head">
      <span
        v-for="w in WEEK"
        :key="w"
      >{{ w }}</span>
    </div>
    <div class="mood-cal__grid">
      <template
        v-for="(week, wi) in month.weeks"
        :key="wi"
      >
        <div
          v-for="(cell, ci) in week"
          :key="`${wi}-${ci}`"
          class="mood-cal__cell"
          :class="{ 'mood-cal__cell--open': cell.inMonth && (cell.hasRecord || cell.iconFiles.length > 0) }"
          :style="cellStyle(cell)"
          :title="cellTitle(cell)"
          @click="openDay(cell)"
        >
          <span
            v-if="cell.inMonth"
            class="mood-cal__day"
          >{{ cell.dayNum }}</span>
          <span
            v-if="cell.iconFiles.length"
            class="mood-cal__emojis"
          ><img
            v-for="file in cell.iconFiles"
            :key="file"
            class="mood-emoji-img"
            :src="iconUrl(file)"
            alt=""
          ></span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { moodLevel } from '@/quiz/score'
import { iconUrl, weatherLabel } from '@/quiz/emotions'
import { monthCalendarAt } from '@/stats/aggregate'
import type { CalendarDay, CalendarMonth } from '@/stats/aggregate'
import type { CheckIn, QuizRecord } from '@/types/mood'
import { formatDateTime } from '@/utils/dom'
import { t } from '@/plugin'

const props = defineProps<{
  records: QuizRecord[];
  checkins: CheckIn[];
  /** 点击有正式测评的格子时回调，参数是当天的 0 点时间戳 */
  onOpenDay?: (day: number) => void;
  /** 点击纯打卡日（没有测评）的格子时回调，打开当天打卡明细 */
  onOpenCheckins?: (day: number) => void;
}>()

const WEEK = ['一', '二', '三', '四', '五', '六', '日']

/** 0 = 本月，1 = 上个月……不能翻到未来 */
const offset = ref(0)
const month = computed<CalendarMonth>(() => monthCalendarAt(props.records, props.checkins, offset.value))
const isCurrent = computed(() => offset.value === 0)

function openDay(cell: CalendarDay): void {
  if (!cell.inMonth) return
  if (cell.hasRecord) props.onOpenDay?.(cell.day)
  else if (cell.iconFiles.length) props.onOpenCheckins?.(cell.day)
}

function cellStyle(cell: CalendarDay): Record<string, string> {
  if (!cell.inMonth) return { background: 'transparent', cursor: 'default' }
  if (cell.future) return { opacity: '0.4' }
  if (cell.score === null) return {}
  const level = moodLevel(cell.score)
  return { background: level.background, color: level.color, fontWeight: '600' }
}

function cellTitle(cell: CalendarDay): string {
  if (!cell.inMonth) return ''
  const day = formatDateTime(cell.day).slice(0, 10)
  if (cell.score === null && !cell.iconFiles.length) {
    return cell.weather ? `${day}｜${weatherLabel(cell.weather)}｜${t('heatNoRecord')}` : `${day}｜${t('heatNoRecord')}`
  }
  const parts: string[] = []
  if (cell.score !== null) parts.push(`${cell.score}（${moodLevel(cell.score).label}）`)
  if (cell.weather) parts.push(weatherLabel(cell.weather))
  if (cell.iconFiles.length) parts.push(t('calOpenLatest'))
  return `${day}｜${parts.join(' · ')}`
}
</script>
