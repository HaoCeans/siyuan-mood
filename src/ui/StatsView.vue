<template>
  <div class="mood-detail">
    <div class="mood-btn-group">
      <button
        v-for="option in ranges"
        :key="option.days"
        class="mood-btn"
        :class="{ 'mood-btn--primary': days === option.days }"
        @click="days = option.days"
      >
        {{ option.label }}
      </button>
    </div>

    <div
      v-if="!records.length && !state.checkins.length"
      class="mood-empty"
    >
      {{ t('statsNoData') }}
    </div>

    <template v-else>
      <div
        v-if="records.length"
        class="mood-metrics"
      >
        <div class="mood-metric">
          <div
            class="mood-metric__value"
            :style="{ color: metricsColor }"
          >
            {{ summary.average }}
          </div>
          <div class="mood-metric__label">
            {{ t('statsAvg') }}
          </div>
        </div>
        <div class="mood-metric">
          <div class="mood-metric__value">
            {{ streak }}
          </div>
          <div class="mood-metric__label">
            {{ t('statsStreak') }}
          </div>
        </div>
        <div class="mood-metric">
          <div class="mood-metric__value">
            {{ summary.count }}
          </div>
          <div class="mood-metric__label">
            {{ t('statsCount') }}
          </div>
        </div>
        <div class="mood-metric">
          <div class="mood-metric__value">
            {{ rateText }}
          </div>
          <div class="mood-metric__label">
            {{ t('statsRate') }}
          </div>
        </div>
        <div class="mood-metric">
          <div class="mood-metric__value">
            {{ summary.volatility }}
          </div>
          <div class="mood-metric__label">
            {{ t('statsVolatility') }}
          </div>
        </div>
        <div class="mood-metric">
          <div class="mood-metric__value">
            {{ changeText }}
          </div>
          <div class="mood-metric__label">
            {{ t('statsChange') }}
          </div>
        </div>
      </div>

      <div
        v-if="records.length"
        class="mood-section"
      >
        <div class="mood-section__title">
          <span>{{ t('chartTrend') }}</span>
          <span class="spacer" />
          <span class="mood-setting-note">{{ t('chartTrendHint') }}</span>
        </div>
        <MoodLineChart
          :points="points"
          :averages="averages"
        />
        <div
          v-if="extremes.low && extremes.high"
          class="mood-setting-note"
          style="margin-top: 4px"
        >
          {{ t('chartExtreme').replace('{low}', String(extremes.low.score)).replace('{lowAt}', formatMonthDay(extremes.low.at)).replace('{high}', String(extremes.high.score)).replace('{highAt}', formatMonthDay(extremes.high.at)) }}
        </div>
      </div>


      <div class="mood-section">
        <div class="mood-section__title">
          <span>{{ t('chartCalendar') }}</span>
        </div>
        <CalendarHeatmap
          :records="sortedRecords()"
          :checkins="state.checkins"
          :on-open-day="openDay"
        />
      </div>


      <div class="mood-section">
        <div class="mood-section__title">
          <span>{{ t('chartDimension') }}</span>
          <span class="spacer" />
          <span class="mood-setting-note">{{ t('chartDimensionHint') }}</span>
        </div>
        <DimensionRadar
          :current="currentDims"
          :average="averageDims"
        />
      </div>


      <div
        v-if="records.length >= 3"
        class="mood-section"
      >
        <div class="mood-section__title">
          <span>{{ t('chartWeekday') }}</span>
          <span class="spacer" />
          <span class="mood-setting-note">{{ t('chartWeekdayHint') }}</span>
        </div>
        <WeekdayBars :stats="weekdayStats" />
      </div>


      <div class="mood-section">
        <div class="mood-section__title">
          <span>{{ t('checkinSection') }}</span>
          <span class="spacer" />
          <span class="mood-setting-note">{{ t('checkinSectionHint') }}</span>
        </div>

        <template v-if="state.checkins.length">
          <!-- 家族比例条 + 图例 -->
          <div class="mood-share">
            <div class="mood-share__bar">
              <span
                v-for="segment in familySegments"
                :key="segment.key"
                :style="{ width: `${segment.percent}%`, background: segment.color }"
                :title="`${segment.label} ${segment.count} 次（${segment.percent}%）`"
              />
            </div>
            <div class="mood-share__legend">
              <span
                v-for="segment in familySegments"
                :key="`legend-${segment.key}`"
                class="mood-share__item"
              >
                <i :style="{ background: segment.color }" />
                {{ segment.label }}
                <b>{{ segment.count }}</b>
              </span>
            </div>
          </div>

          <div style="margin-top: 12px">
            <div class="mood-setting-note">
              {{ t('checkinStripTitle') }}
            </div>
            <CheckinStrip
              :checkins="state.checkins"
              :days="14"
              style="margin-top: 8px"
            />
          </div>

          <div
            v-if="checkinWords.length"
            style="margin-top: 12px"
          >
            <div class="mood-setting-note">
              {{ t('checkinFreqTitle') }}
            </div>
            <KeywordBars
              :items="checkinWords"
              style="margin-top: 8px"
            />
          </div>
        </template>
        <div
          v-else
          class="mood-setting-note"
        >
          {{ t('checkinEmptyHint') }}
        </div>
      </div>


      <div
        v-if="keywords.length"
        class="mood-section"
      >
        <div class="mood-section__title">
          <span>{{ t('chartKeywords') }}</span>
        </div>
        <KeywordBars :items="keywords" />
      </div>


      <div class="mood-section">
        <div class="mood-section__title">
          <span>{{ t('reportTitle') }}</span>
          <span class="spacer" />
          <span
            v-if="state.report"
            class="mood-setting-note"
          >{{ reportTime }}</span>
          <button
            class="mood-btn mood-btn--ghost"
            :disabled="state.reportRunning"
            @click="makeReport"
          >
            {{ state.report ? t('reportRegenerate') : t('reportGenerate') }}
          </button>
        </div>

        <div
          v-if="state.reportRunning"
          class="mood-thinking"
        >
          <div class="mood-thinking__line">
            <span class="mood-dots"><i /><i /><i /></span>
            <span>{{ reportProgress }}</span>
          </div>
          <div class="mood-skeleton">
            <div
              class="mood-skeleton__line"
              style="width: 90%"
            />
            <div
              class="mood-skeleton__line"
              style="width: 72%"
            />
            <div
              class="mood-skeleton__line"
              style="width: 48%"
            />
          </div>
        </div>
        <template v-else-if="state.report">
          <div
            v-if="state.report.mood"
            style="font-weight: 600"
          >
            {{ state.report.mood }}
          </div>
          <div
            v-if="state.report.keywords?.length"
            class="mood-chips"
            style="margin-top: 8px"
          >
            <span
              v-for="word in state.report.keywords"
              :key="word"
              class="mood-chip"
            >{{ word }}</span>
          </div>
          <div
            v-if="state.report.analysis"
            class="mood-md"
            style="margin-top: 8px"
            v-html="html(state.report.analysis)"
          />
          <div
            v-if="state.report.advice?.length"
            class="mood-setting-note"
            style="margin-top: 8px"
          >
            <div
              v-for="advice in state.report.advice"
              :key="advice.id"
            >
              · {{ advice.text }}
            </div>
          </div>
        </template>
        <div
          v-else
          class="mood-setting-note"
        >
          {{ t('reportHint') }}
        </div>
      </div>

    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { showMessage } from 'siyuan'
import { t } from '@/plugin'
import CalendarHeatmap from '@/ui/charts/CalendarHeatmap.vue'
import CheckinStrip from '@/ui/charts/CheckinStrip.vue'
import DimensionRadar from '@/ui/charts/DimensionRadar.vue'
import WeekdayBars from '@/ui/charts/WeekdayBars.vue'
import KeywordBars from '@/ui/charts/KeywordBars.vue'
import MoodLineChart from '@/ui/charts/MoodLineChart.vue'
import { generateReport } from '@/ai/analyze'
import {
  dimensionAverages,
  extremes as extremesOf,
  followupRate,
  inRange,
  keywordCounts,
  moodPoints,
  movingAverage,
  streakDays,
  summarize,
  weekdayAverages,
} from '@/stats/aggregate'
import { moodLevel } from '@/quiz/score'
import { latestRecord, sortedRecords, state } from '@/store'
import { openRecordDialog } from '@/ui/dialogs'
import { dayStart, formatMonthDay } from '@/utils/dom'
import { formatDateTime } from '@/utils/dom'
import { md2html } from '@/utils/lute'
import { useAiProgress } from '@/ui/useAiProgress'
import { FAMILY_META, wordFamily, type EmotionFamily } from '@/quiz/emotions'

const ranges = [
  { days: 7, label: t('rangeWeek') },
  { days: 30, label: t('rangeMonth') },
  { days: 90, label: t('rangeQuarter') },
  { days: 0, label: t('rangeAll') },
]

const days = ref(30)

const records = computed(() => inRange(sortedRecords(), days.value))
const points = computed(() => moodPoints(records.value))
const averages = computed(() => movingAverage(points.value, Math.min(7, Math.max(2, points.value.length))))
const summary = computed(() => summarize(sortedRecords(), days.value))
const currentDims = computed(() => latestRecord()?.dimensionScores || {})
const averageDims = computed(() => dimensionAverages(records.value))
const keywords = computed(() => keywordCounts(records.value, 10))
const streak = computed(() => streakDays(sortedRecords()))
const rate = computed(() => followupRate(sortedRecords()))
const rateText = computed(() => (rate.value.total ? `${rate.value.percent}%` : '—'))
const metricsColor = computed(() => moodLevel(summary.value.average || 0).color)
const weekdayStats = computed(() => weekdayAverages(records.value))
const extremes = computed(() => extremesOf(points.value))
const reportProgress = useAiProgress(
  () => state.reportRunning,
  ['reportStepRead', 'reportStepKeywords', 'reportStepAdvice'],
)

/** 打卡家族计数：所选时间范围内的 */
const familyCounts = computed(() => {
  const from = days.value ? dayStart(Date.now()) - (days.value - 1) * 86400000 : 0
  const counter = new Map<EmotionFamily, number>()
  for (const entry of state.checkins) {
    if (from && entry.at < from) continue
    const family = wordFamily(entry.word)
    counter.set(family, (counter.get(family) || 0) + 1)
  }
  return Array.from(counter.entries())
    .map(([key, count]) => ({ key, count, label: FAMILY_META[key].label, color: FAMILY_META[key].color, background: FAMILY_META[key].background }))
    .sort((a, b) => b.count - a.count)
})

/** 比例条的分段：按计数占比切 */
const familySegments = computed(() => {
  const total = familyCounts.value.reduce((sum, item) => sum + item.count, 0) || 1
  return familyCounts.value.map((item) => ({ ...item, percent: Math.max(6, Math.round((item.count / total) * 100)) }))
})

/** 打卡词频 top6 */
const checkinWords = computed(() => {
  const from = days.value ? dayStart(Date.now()) - (days.value - 1) * 86400000 : 0
  const counter = new Map<string, number>()
  for (const entry of state.checkins) {
    if (from && entry.at < from) continue
    counter.set(entry.word, (counter.get(entry.word) || 0) + 1)
  }
  return Array.from(counter.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, 6)
})

const changeText = computed(() => {
  const change = summary.value.change
  if (!change) return '—'
  return change > 0 ? `+${change}` : String(change)
})

const reportTime = computed(() => (state.report ? formatDateTime(state.report.at) : ''))

function html(markdown: string): string {
  return md2html(markdown)
}

/** 点日历格：打开当天最新的一条记录 */
function openDay(day: number): void {
  const target = sortedRecords().find((record) => dayStart(record.finishedAt) === day)
  if (target) openRecordDialog(target.id, false)
}

async function makeReport(): Promise<void> {
  const outcome = await generateReport(days.value || 30)
  if (!outcome.ok && outcome.message) {
    showMessage(outcome.message, 7000, outcome.reason === 'empty' ? 'info' : 'error')
  }
}
</script>
