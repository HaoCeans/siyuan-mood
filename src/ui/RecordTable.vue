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

    <div
      v-else
      class="mood-table-card"
    >
      <table class="mood-table">
        <thead>
          <tr>
            <th>{{ t('colDate') }}</th>
            <th>{{ t('colScore') }}</th>
            <th>{{ t('colName') }}</th>
            <th
              v-for="dimension in scoredDimensions"
              :key="dimension.key"
              :title="dimension.name"
            >
              {{ dimension.name.slice(0, 2) }}
            </th>
            <th>{{ t('colKeywords') }}</th>
            <th>{{ t('colSignals') }}</th>
            <th>{{ t('colFollow') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="record in records"
            :key="record.id"
            @click="$emit('open', record.id)"
          >
            <td class="mood-table__num">
              {{ formatDateTime(record.finishedAt) }}
            </td>
            <td>
              <span
                class="mood-score-pill"
                :style="{ background: moodLevel(record.moodScore).background, color: moodLevel(record.moodScore).color }"
              >{{ record.moodScore }}</span>
            </td>
            <td>
              <span class="mood-cell-text">
                <img
                  v-if="nameIcon(record)"
                  class="mood-emoji-img"
                  :src="iconUrl(nameIcon(record))"
                  alt=""
                >{{ record.moodName || '—' }}
              </span>
            </td>
            <td
              v-for="dimension in scoredDimensions"
              :key="dimension.key"
              class="mood-table__num"
            >
              {{ record.dimensionScores[dimension.key] ?? '—' }}
            </td>
            <td>
              <span
                class="mood-cell-text"
                :title="cellFull(record.ai.keywords?.length ? record.ai.keywords : record.keywordLocal)"
              >{{ textOrDash((record.ai.keywords?.length ? record.ai.keywords : record.keywordLocal).slice(0, 3)) }}</span>
            </td>
            <td>
              <span
                class="mood-cell-text"
                :title="cellFull(record.signals || [])"
              >{{ textOrDash((record.signals || []).slice(0, 2)) }}</span>
            </td>
            <td>
              <div
                v-if="record.followUps.length"
                class="mood-followbar"
              >
                <span class="mood-followbar__track">
                  <span
                    class="mood-followbar__fill"
                    :style="{ width: followPercent(record) + '%' }"
                  />
                </span>
                <span class="mood-table__num">{{ followText(record) }}</span>
              </div>
              <span v-else>—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { showMessage } from 'siyuan'
import { t } from '@/plugin'
import { moodLevel } from '@/quiz/score'
import { iconUrl, wordIconFile } from '@/quiz/emotions'
import { toCsv } from '@/stats/aggregate'
import { sortedRecords } from '@/store'
import { DIMENSIONS } from '@/types/mood'
import { downloadText, formatDateTime } from '@/utils/dom'

defineEmits<{ open: [id: string] }>()

const records = computed(() => sortedRecords())
const scoredDimensions = DIMENSIONS.filter((d) => d.scored)

function nameIcon(record: { moodName?: string }): string {
  return wordIconFile(record.moodName || '')
}

function textOrDash(list: string[]): string {
  return list.filter(Boolean).join('、') || '—'
}

function cellFull(list: string[]): string {
  return list.join('、')
}

function followDone(record: { followUps: { done: string }[] }): number {
  return record.followUps.filter((f) => f.done === 'yes' || f.done === 'partial').length
}

function followText(record: { followUps: { done: string }[] }): string {
  if (!record.followUps.length) return '—'
  return `${followDone(record)}/${record.followUps.length}`
}

function followPercent(record: { followUps: { done: string }[] }): number {
  if (!record.followUps.length) return 0
  return Math.round((followDone(record) / record.followUps.length) * 100)
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
