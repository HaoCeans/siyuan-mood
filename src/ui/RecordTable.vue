<template>
  <div class="mood-detail">
    <div class="mood-btn-group">
      <button
        class="mood-btn"
        @click="exportCsv"
      >
        {{ t('exportCsv') }}
      </button>
      <span class="mood-setting-note">{{ records.length }} {{ t('recordsUnit') }}</span>
    </div>

    <div
      v-if="!records.length"
      class="mood-empty"
    >
      {{ t('tableEmpty') }}
    </div>

    <table
      v-else
      class="mood-table"
    >
      <thead>
        <tr>
          <th>{{ t('colDate') }}</th>
          <th>{{ t('colScore') }}</th>
          <th
            v-for="dimension in scoredDimensions"
            :key="dimension.key"
          >
            {{ dimension.name.slice(0, 2) }}
          </th>
          <th>{{ t('colKeywords') }}</th>
          <th>{{ t('colFollow') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="record in records"
          :key="record.id"
          style="cursor: pointer"
          @click="$emit('open', record.id)"
        >
          <td>{{ shortTime(record.finishedAt) }}</td>
          <td :style="{ color: moodLevel(record.moodScore).color }">
            {{ record.moodScore }}
          </td>
          <td
            v-for="dimension in scoredDimensions"
            :key="dimension.key"
          >
            {{ record.dimensionScores[dimension.key] ?? '—' }}
          </td>
          <td>{{ (record.ai.keywords?.length ? record.ai.keywords : record.keywordLocal).slice(0, 3).join('、') }}</td>
          <td>{{ followText(record) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { showMessage } from 'siyuan'
import { t } from '@/plugin'
import { moodLevel } from '@/quiz/score'
import { toCsv } from '@/stats/aggregate'
import { sortedRecords } from '@/store'
import { DIMENSIONS } from '@/types/mood'
import { downloadText, formatDateTime } from '@/utils/dom'

defineEmits<{ open: [id: string] }>()

const records = computed(() => sortedRecords())
const scoredDimensions = DIMENSIONS.filter((d) => d.scored)

function shortTime(ts: number): string {
  return formatDateTime(ts).slice(5)
}

function followText(record: { followUps: { done: string }[] }): string {
  if (!record.followUps.length) return '—'
  const done = record.followUps.filter((f) => f.done === 'yes' || f.done === 'partial').length
  return `${done}/${record.followUps.length}`
}

function exportCsv(): void {
  if (!records.value.length) {
    showMessage(t('tableEmpty'))
    return
  }
  downloadText(`mood-records-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(records.value), 'text/csv')
  showMessage(t('exportOk'))
}
</script>
