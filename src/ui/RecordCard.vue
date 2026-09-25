<template>
  <div
    class="mood-card"
    @click="$emit('open', record.id)"
  >
    <div
      class="mood-card__dot"
      :style="{ background: level.color }"
      :title="level.label"
    />
    <div class="mood-card__main">
      <div class="mood-card__top">
        <span class="mood-card__time">{{ timeText }}</span>
        <span
          class="mood-card__score"
          :style="{ color: level.color }"
        >{{ record.moodScore }}</span>
        <span class="mood-card__level">{{ level.label }}</span>
      </div>

      <div
        v-if="keywords.length"
        class="mood-chips"
      >
        <span
          v-for="word in keywords.slice(0, 3)"
          :key="word"
          class="mood-chip"
        >{{ word }}</span>
      </div>

      <div class="mood-card__summary">
        {{ summary }}
      </div>

      <div class="mood-card__meta">
        <span
          v-if="record.ai.status === 'running'"
          class="mood-chip mood-chip--info"
        >{{ t('aiRunning') }}</span>
        <span
          v-else-if="record.ai.status === 'failed'"
          class="mood-chip mood-chip--warning"
        >{{ t('aiFailed') }}</span>
        <span
          v-else-if="record.ai.status === 'idle'"
          class="mood-chip mood-chip--muted"
        >{{ t('notAnalyzed') }}</span>
        <span v-if="record.followUps.length">
          {{ t('adviceCount').replace('{n}', String(record.followUps.length)) }}
          <template v-if="doneCount"> · {{ t('doneCount').replace('{n}', String(doneCount)) }}</template>
        </span>
        <span v-if="aiTimeText">{{ aiTimeText }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { moodLevel } from '@/quiz/score'
import type { QuizRecord } from '@/types/mood'
import { formatMonthDay, formatTime } from '@/utils/dom'
import { t } from '@/plugin'
import { plainText } from '@/utils/lute'

const props = defineProps<{ record: QuizRecord }>()
defineEmits<{ open: [id: string] }>()

const level = computed(() => moodLevel(props.record.moodScore))
const keywords = computed(() =>
  props.record.ai.keywords?.length ? props.record.ai.keywords : props.record.keywordLocal,
)
const timeText = computed(() => `${formatMonthDay(props.record.finishedAt)} ${formatTime(props.record.finishedAt)}`)
const doneCount = computed(() => props.record.followUps.filter((f) => f.done === 'yes' || f.done === 'partial').length)
const aiTimeText = computed(() => {
  const at = props.record.ai.at
  return at && props.record.ai.status === 'done' ? `${t('aiAt')} ${formatTime(at)}` : ''
})
const summary = computed(() => {
  const { ai } = props.record
  if (ai.status === 'done' && ai.analysis) return ai.mood || plainText(ai.analysis, 60)
  if (ai.status === 'failed' && ai.raw) return plainText(ai.raw, 60)
  if (ai.status === 'running') return t('aiRunning')
  return props.record.keywordLocal.join(' · ') || t('notAnalyzedHint')
})
</script>
