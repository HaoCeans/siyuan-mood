<template>
  <div class="mood-strip">
    <div
      v-for="column in columns"
      :key="column.day"
      class="mood-strip__col"
    >
      <div
        class="mood-strip__track"
        :class="{ 'mood-strip__track--today': column.today }"
      >
        <span
          v-for="entry in column.entries"
          :key="entry.id"
          class="mood-strip__dot"
          :style="{ background: familyOf(entry.word).color }"
          :title="tooltip(entry)"
        />
      </div>
      <span
        class="mood-strip__label"
        :class="{ 'mood-strip__label--today': column.today }"
      >{{ column.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { familyOf, weatherLabel } from '@/quiz/emotions'
import { t } from '@/plugin'
import type { CheckIn } from '@/types/mood'
import { dayStart, formatMonthDay, formatTime } from '@/utils/dom'

const props = defineProps<{ checkins: CheckIn[]; days?: number }>()

interface StripColumn {
  day: number;
  label: string;
  today: boolean;
  entries: CheckIn[];
}

const columns = computed<StripColumn[]>(() => {
  const count = props.days || 14;
  const byDay = new Map<number, CheckIn[]>();
  for (const entry of props.checkins) {
    const day = dayStart(entry.at);
    const list = byDay.get(day) || [];
    list.push(entry);
    byDay.set(day, list);
  }

  const today = dayStart(Date.now());
  const result: StripColumn[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const day = today - i * 86400000;
    // 一天最多显示 4 个点，超出以最靠近现在的为准
    const entries = (byDay.get(day) || []).slice().sort((a, b) => a.at - b.at).slice(-4);
    const d = new Date(day);
    // 日期只显示「几号」防拥挤；月初用 10/1 标出月份，今天用文字
    let label = String(d.getDate());
    if (i === 0) label = t('today');
    else if (d.getDate() === 1) label = `${d.getMonth() + 1}/${d.getDate()}`;
    result.push({
      day,
      label,
      today: i === 0,
      entries,
    });
  }
  return result;
});

function tooltip(entry: CheckIn): string {
  return `${formatMonthDay(entry.at)} ${formatTime(entry.at)}｜${entry.word}${entry.weather ? `｜${weatherLabel(entry.weather)}` : ''}`;
}
</script>
