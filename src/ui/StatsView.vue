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
      v-if="!records.length"
      class="mood-empty"
    >
      {{ t('statsNoData') }}
    </div>

    <template v-else>
      <div class="mood-metrics">
        <div class="mood-metric">
          <div class="mood-metric__value">
            {{ summary.average }}
          </div>
          <div class="mood-metric__label">
            {{ t('statsAvg') }}
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

      <div class="mood-section">
        <div class="mood-section__title">
          <span>{{ t('chartTrend') }}</span>
          <span class="spacer" />
          <span class="mood-setting-note">{{ t('chartTrendHint') }}</span>
        </div>
        <MoodLineChart
          :points="points"
          :averages="averages"
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

      <div class="mood-section">
        <div class="mood-section__title">
          <span>{{ t('chartCalendar') }}</span>
        </div>
        <CalendarHeatmap :columns="grid" />
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
          class="mood-loading"
        >
          {{ t('aiRunning') }}
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
            style="margin-top: 6px"
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
            style="margin-top: 6px"
            v-html="html(state.report.analysis)"
          />
          <div
            v-if="state.report.advice?.length"
            class="mood-setting-note"
            style="margin-top: 6px"
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
import DimensionRadar from '@/ui/charts/DimensionRadar.vue'
import KeywordBars from '@/ui/charts/KeywordBars.vue'
import MoodLineChart from '@/ui/charts/MoodLineChart.vue'
import { generateReport } from '@/ai/analyze'
import {
  calendarGrid,
  dimensionAverages,
  inRange,
  keywordCounts,
  moodPoints,
  movingAverage,
  summarize,
} from '@/stats/aggregate'
import { latestRecord, sortedRecords, state } from '@/store'
import { formatDateTime } from '@/utils/dom'
import { md2html } from '@/utils/lute'

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
const grid = computed(() => calendarGrid(sortedRecords(), 12))
const keywords = computed(() => keywordCounts(records.value, 10))

const changeText = computed(() => {
  const change = summary.value.change
  if (!change) return '—'
  return change > 0 ? `+${change}` : String(change)
})

const reportTime = computed(() => (state.report ? formatDateTime(state.report.at) : ''))

function html(markdown: string): string {
  return md2html(markdown)
}

async function makeReport(): Promise<void> {
  const outcome = await generateReport(days.value || 30)
  if (!outcome.ok && outcome.message) {
    showMessage(outcome.message, 7000, outcome.reason === 'empty' ? 'info' : 'error')
  }
}
</script>
