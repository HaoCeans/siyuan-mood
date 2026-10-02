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
          <div class="mood-header__hint-main">
            <span
              v-if="state.aiRunning || !state.ready"
              class="mood-dots"
              style="margin-right: 6px"
            ><i /><i /><i /></span>{{ hintMain }}
          </div>
          <div
            v-if="hintReasons"
            class="mood-header__hint-sub"
          >
            {{ hintReasons }}
          </div>
        </div>
        <div class="mood-btn-group">
          <button
            class="mood-btn mood-btn--primary"
            @click="startQuiz"
          >
            {{ t('startQuiz') }}
          </button>
          <button
            class="mood-btn mood-btn--tonal"
            :title="t('checkinHint')"
            @click="openCheckInDialog"
          >
            {{ t('checkinButton') }}
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
        <div class="mood-thinking">
          <div class="mood-thinking__line">
            <span class="mood-dots"><i /><i /><i /></span>
            <span>{{ t('loading') }}</span>
          </div>
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
          v-if="records.length"
          class="mood-count-row"
        >
          <span class="mood-count">{{ t('recordsCount').replace('{n}', String(records.length)) }}</span>
          <span class="spacer" style="flex: 1" />
          <select
            v-model="sortKey"
            class="mood-select mood-count__sort"
            :title="t('sortTitle')"
          >
            <option value="newest">
              {{ t('sortNewest') }}
            </option>
            <option value="oldest">
              {{ t('sortOldest') }}
            </option>
            <option value="scoreLow">
              {{ t('sortScoreLow') }}
            </option>
            <option value="scoreHigh">
              {{ t('sortScoreHigh') }}
            </option>
          </select>
        </div>
        <input
          v-if="records.length"
          v-model="searchText"
          class="mood-input mood-search"
          type="text"
          :placeholder="t('searchPlaceholder')"
        >
        <div
          v-if="!records.length"
          class="mood-empty"
        >
          {{ t('noRecordHint') }}
        </div>
        <div
          v-else-if="!sortedView.length"
          class="mood-empty"
        >
          {{ t('searchNoMatch') }}
        </div>
        <RecordCard
          v-for="record in sortedView"
          :key="record.id"
          :record="record"
          @open="openRecord"
        />
      </template>
      <StatsView v-else-if="state.tab === 'stats'" />
      <RecordTable
        v-else-if="state.tab === 'table'"
        @open="openRecord"
      />
      <ChatView v-else />
    </div>

    <div class="mood-footer">
      <span
        v-if="lastCheckin"
        class="mood-chip mood-chip--muted"
        :title="t('checkinLatest')"
      >{{ lastCheckin.word }} · {{ lastCheckinTime }}</span>
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
import { computed, ref } from 'vue'
import { t, getPlugin } from '@/plugin'
import RecordCard from '@/ui/RecordCard.vue'
import RecordDetail from '@/ui/RecordDetail.vue'
import RecordTable from '@/ui/RecordTable.vue'
import ChatView from '@/ui/ChatView.vue'
import StatsView from '@/ui/StatsView.vue'
import { moodLevel } from '@/quiz/score'
import { latestRecord, latestCheckIn, sortedRecords, state, type ViewTab } from '@/store'
import { computeInterval, daysUntilDue, nextDueAt } from '@/stats/interval'
import { openQuizDialog, openCheckInDialog } from '@/ui/dialogs'
import { formatTime } from '@/utils/dom'
import type { QuizRecord } from '@/types/mood'

const tabs: { key: ViewTab; label: string }[] = [
  { key: 'records', label: t('tabRecords') },
  { key: 'stats', label: t('tabStats') },
  { key: 'table', label: t('tabTable') },
  { key: 'chat', label: t('tabChat') },
]

const records = computed(() => sortedRecords())
type SortKey = 'newest' | 'oldest' | 'scoreLow' | 'scoreHigh'
const sortKey = ref<SortKey>('newest')
const searchText = ref('')
/** 记录列表的展示顺序：默认最近优先；低分在前方便回头照顾状态差的那几天 */
const sortedView = computed(() => {
  let list = records.value.slice()
  if (sortKey.value === 'oldest') list.reverse()
  else if (sortKey.value === 'scoreLow') list.sort((a, b) => a.moodScore - b.moodScore)
  else if (sortKey.value === 'scoreHigh') list.sort((a, b) => b.moodScore - a.moodScore)
  const query = searchText.value.trim().toLowerCase()
  if (query) list = list.filter((record) => recordMatches(record, query))
  return list
})

/** 搜：情绪名、关键词、身体信号、自述、备注、作答原文 */
function recordMatches(record: QuizRecord, query: string): boolean {
  const hay = [
    record.moodName || '',
    ...(record.ai.keywords || []),
    ...record.keywordLocal,
    ...(record.signals || []),
    record.note || '',
    ...record.answers.flatMap((answer) => [answer.questionText, ...answer.optionLabels, answer.text || '']),
  ].join('\n').toLowerCase()
  return hay.includes(query)
}
const latest = computed(() => latestRecord())
const level = computed(() => moodLevel(latest.value?.moodScore ?? 0))
const lastCheckin = computed(() => latestCheckIn())
const lastCheckinTime = computed(() => (lastCheckin.value ? formatTime(lastCheckin.value.at) : ''))

const hintMain = computed(() => {
  if (!latest.value) return t('firstTimeHint')
  if (state.aiRunning) return t('aiRunning')
  const left = daysUntilDue(nextDueAt(sortedRecords(), state.settings) ?? Date.now())
  if (left < 0) return t('dueNow')
  if (left === 0) return t('dueToday')
  return t('nextInDays').replace('{n}', String(left))
})

const hintReasons = computed(() => {
  if (!latest.value || state.aiRunning) return ''
  return computeInterval(sortedRecords(), state.settings).reasons.join(' · ')
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
