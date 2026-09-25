<template>
  <div class="mood-dock">
    <div class="mood-header">
      <div
        class="mood-score"
        :style="{ color: level.color, background: level.background }"
        @click="startQuiz"
      >
        <span class="mood-score__num">{{ latest ? latest.moodScore : '—' }}</span>
        <span class="mood-score__label">{{ latest ? level.label : t('noRecord') }}</span>
      </div>

      <div class="mood-header__side">
        <div class="mood-header__hint">
          {{ hint }}
        </div>
        <div class="mood-btn-group">
          <button
            class="mood-btn mood-btn--primary"
            @click="startQuiz"
          >
            {{ t('startQuiz') }}
          </button>
          <button
            v-if="state.reminderDue"
            class="mood-btn"
            @click="snooze"
          >
            {{ t('snoozeToday') }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="!state.detailId"
      class="mood-tabs"
    >
      <div
        v-for="tab in tabs"
        :key="tab.key"
        class="mood-tab"
        :class="{ 'mood-tab--active': state.tab === tab.key }"
        @click="state.tab = tab.key"
      >
        {{ tab.label }}
      </div>
    </div>

    <div class="mood-body">
      <template v-if="!state.ready">
        <div class="mood-loading">
          {{ t('loading') }}
        </div>
      </template>
      <template v-else-if="state.detailId">
        <RecordDetail
          :record-id="state.detailId"
          embedded
          @back="state.detailId = ''"
        />
      </template>
      <template v-else-if="state.tab === 'records'">
        <div
          v-if="!records.length"
          class="mood-empty"
        >
          {{ t('noRecordHint') }}
        </div>
        <RecordCard
          v-for="record in records"
          :key="record.id"
          :record="record"
          @open="openRecord"
        />
      </template>
      <StatsView v-else-if="state.tab === 'stats'" />
      <RecordTable
        v-else
        @open="openRecord"
      />
    </div>

    <div class="mood-footer">
      <span>{{ nextText }}</span>
      <span class="spacer" style="flex: 1" />
      <button
        class="mood-btn mood-btn--ghost"
        @click="openSettings"
      >
        {{ t('settings') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { t, getPlugin } from '@/plugin'
import RecordCard from '@/ui/RecordCard.vue'
import RecordDetail from '@/ui/RecordDetail.vue'
import RecordTable from '@/ui/RecordTable.vue'
import StatsView from '@/ui/StatsView.vue'
import { moodLevel } from '@/quiz/score'
import { latestRecord, sortedRecords, state, type ViewTab } from '@/store'
import { computeInterval, daysUntilDue, nextDueAt } from '@/stats/interval'
import { openQuizDialog } from '@/ui/dialogs'

const tabs: { key: ViewTab; label: string }[] = [
  { key: 'records', label: t('tabRecords') },
  { key: 'stats', label: t('tabStats') },
  { key: 'table', label: t('tabTable') },
]

const records = computed(() => sortedRecords())
const latest = computed(() => latestRecord())
const level = computed(() => moodLevel(latest.value?.moodScore ?? 0))

const hint = computed(() => {
  if (!latest.value) return t('firstTimeHint')
  if (state.aiRunning) return t('aiRunning')
  const reasons = computeInterval(sortedRecords(), state.settings).reasons.join('、')
  const left = daysUntilDue(nextDueAt(sortedRecords(), state.settings) ?? Date.now())
  if (left < 0) return `${t('dueNow')}（${reasons}）`
  if (left === 0) return `${t('dueToday')}（${reasons}）`
  return `${t('nextInDays').replace('{n}', String(left))}（${reasons}）`
})

const nextText = computed(() => {
  if (!latest.value) return t('noRecord')
  const interval = computeInterval(sortedRecords(), state.settings)
  return `${t('intervalHint').replace('{n}', String(interval.days))}`
})

function startQuiz(): void {
  openQuizDialog()
}

function openRecord(id: string): void {
  state.detailId = id
}

function openSettings(): void {
  getPlugin()?.openSetting()
}

function snooze(): void {
  void getPlugin()?.snoozeReminder()
}
</script>
