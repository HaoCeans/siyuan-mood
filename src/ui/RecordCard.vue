<template>
  <div
    class="mood-card"
    :style="{ borderLeftColor: level.color }"
    @click="$emit('open', record.id)"
  >
    <div class="mood-card__top">
      <span class="mood-card__time">{{ timeText }}</span>
      <span
        class="mood-card__score"
        :style="{ color: level.color }"
      >
        {{ record.moodScore }}
        <span class="mood-card__level">{{ level.label }}</span>
      </span>
    </div>

    <div
      v-if="keywords.length || record.moodName"
      class="mood-chips"
    >
        <span
          v-if="record.moodName"
          class="mood-chip mood-chip--info"
        ><img
          v-if="nameIcon"
          class="mood-emoji-img"
          :src="iconUrl(nameIcon)"
          alt=""
        >{{ record.moodName }}</span>
        <span
          v-if="record.boundBlockId"
          class="mood-chip mood-chip--muted"
          :title="t('blockChipTitle')"
        >{{ t('blockChip') }}</span>
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
      >
        <i class="mood-dot-pulse" />
        {{ t('aiRunning') }}
      </span>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { moodLevel } from '@/quiz/score'
import { iconUrl, wordIconFile } from '@/quiz/emotions'
import type { QuizRecord } from '@/types/mood'
import { formatDateTime } from '@/utils/dom'
import { t } from '@/plugin'
import { plainText } from '@/utils/lute'

const props = defineProps<{ record: QuizRecord }>()
defineEmits<{ open: [id: string] }>()

const level = computed(() => moodLevel(props.record.moodScore))
const nameIcon = computed(() => wordIconFile(props.record.moodName || ''))
const keywords = computed(() =>
  props.record.ai.keywords?.length ? props.record.ai.keywords : props.record.keywordLocal,
)
const timeText = computed(() => formatDateTime(props.record.finishedAt))
const doneCount = computed(() => props.record.followUps.filter((f) => f.done === 'yes' || f.done === 'partial').length)
const summary = computed(() => {
  const { ai } = props.record
  if (ai.status === 'done' && ai.analysis) return ai.mood || plainText(ai.analysis, 60)
  if (ai.status === 'failed' && ai.raw) return plainText(ai.raw, 60)
  if (ai.status === 'running') return t('aiRunning')
  return props.record.keywordLocal.join(' · ') || t('notAnalyzedHint')
})
</script>
