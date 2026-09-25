<template>
  <div
    v-if="record"
    class="mood-detail"
  >
    <!-- 概要 -->
    <div class="mood-section">
      <div class="mood-card__top">
        <span class="mood-card__time">{{ timeText }}</span>
        <span
          class="mood-card__score"
          :style="{ color: level.color }"
        >{{ record.moodScore }}</span>
        <span class="mood-card__level">{{ level.label }}</span>
        <span class="spacer" />
        <button
          v-if="embedded"
          class="mood-btn mood-btn--ghost"
          @click="$emit('back')"
        >
          {{ t('back') }}
        </button>
      </div>
      <div class="mood-setting-note">
        {{ level.hint }}
      </div>
      <div
        v-if="keywords.length"
        class="mood-chips"
        style="margin-top: 6px"
      >
        <span
          v-for="word in keywords"
          :key="word"
          class="mood-chip"
        >{{ word }}</span>
      </div>
    </div>

    <!-- AI 解读 -->
    <div class="mood-section">
      <div class="mood-section__title">
        <span>{{ t('aiSection') }}</span>
        <span class="spacer" />
        <button
          class="mood-btn mood-btn--ghost"
          :disabled="analyzing"
          @click="runAnalyze"
        >
          {{ record.ai.status === 'done' ? t('aiRerun') : t('aiRun') }}
        </button>
      </div>

      <div
        v-if="analyzing"
        class="mood-loading"
      >
        {{ t('aiRunning') }}
      </div>

      <template v-else-if="record.ai.status === 'done'">
        <div
          v-if="record.ai.mood"
          style="font-weight: 600"
        >
          {{ record.ai.mood }}
        </div>
        <div
          v-if="record.ai.changes"
          class="mood-setting-note"
          style="margin-top: 4px"
        >
          {{ t('changesTitle') }}：{{ record.ai.changes }}
        </div>
        <div
          v-if="record.ai.analysis"
          class="mood-md"
          style="margin-top: 6px"
          v-html="html(record.ai.analysis)"
        />
        <div
          v-if="record.ai.practice"
          class="mood-setting-note"
          style="margin-top: 6px"
        >
          {{ t('practiceTitle') }}：{{ record.ai.practice }}
        </div>
        <div
          v-if="record.ai.advice?.length"
          class="mood-advice"
          style="margin-top: 10px"
        >
          <div
            v-for="(advice, i) in record.ai.advice"
            :key="advice.id"
            class="mood-advice__item"
          >
            <div class="mood-advice__text">
              <span>{{ i + 1 }}.</span>
              <span>{{ advice.text }}</span>
            </div>

            <div
              v-if="followOf(advice.id)"
              class="mood-follow"
            >
              <button
                class="mood-btn"
                :class="{ 'mood-btn--primary': followOf(advice.id)?.done === 'yes' }"
                @click="setDone(advice.id, 'yes')"
              >
                {{ t('followDone') }}
              </button>
              <button
                class="mood-btn"
                :class="{ 'mood-btn--primary': followOf(advice.id)?.done === 'partial' }"
                @click="setDone(advice.id, 'partial')"
              >
                {{ t('followPartial') }}
              </button>
              <button
                class="mood-btn"
                :class="{ 'mood-btn--primary': followOf(advice.id)?.done === 'no' }"
                @click="setDone(advice.id, 'no')"
              >
                {{ t('followNo') }}
              </button>

              <template v-if="followOf(advice.id)?.done === 'no'">
                <select
                  class="mood-select"
                  :value="followOf(advice.id)?.blocker || ''"
                  @change="setBlocker(advice.id, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">
                    {{ t('blockerTitle') }}
                  </option>
                  <option value="forgot">
                    {{ t('blockerForgot') }}
                  </option>
                  <option value="hard">
                    {{ t('blockerHard') }}
                  </option>
                  <option value="unwilling">
                    {{ t('blockerUnwilling') }}
                  </option>
                  <option value="no-time">
                    {{ t('blockerNoTime') }}
                  </option>
                  <option value="other">
                    {{ t('blockerOther') }}
                  </option>
                </select>
              </template>

              <template v-if="showFeeling(advice.id)">
                <span>{{ t('followFeeling') }}</span>
                <div class="mood-feeling">
                  <span
                    v-for="n in 5"
                    :key="n"
                    :class="{ picked: followOf(advice.id)?.feeling === n }"
                    @click="setFeeling(advice.id, n)"
                  >{{ n }}</span>
                </div>
              </template>
            </div>

            <textarea
              v-if="showFeeling(advice.id) || followOf(advice.id)?.note"
              class="mood-input"
              rows="2"
              :placeholder="t('followPlaceholder')"
              :value="followOf(advice.id)?.note || ''"
              @blur="saveNote(advice.id, ($event.target as HTMLTextAreaElement).value)"
            />
          </div>
        </div>
      </template>

      <template v-else-if="record.ai.status === 'failed'">
        <div class="mood-setting-note">
          {{ record.ai.error || t('aiFailed') }}
        </div>
        <div
          v-if="record.ai.raw"
          class="mood-md"
          style="margin-top: 6px"
          v-html="html(record.ai.raw)"
        />
      </template>

      <div
        v-else
        class="mood-setting-note"
      >
        {{ t('aiIdleHint') }}
      </div>
    </div>

    <!-- 本次作答 -->
    <div class="mood-section">
      <div
        class="mood-section__title"
        style="cursor: pointer"
        @click="showAnswers = !showAnswers"
      >
        <span>{{ t('answersTitle') }}（{{ record.answers.length }}）</span>
        <span class="spacer" />
        <span>{{ showAnswers ? '−' : '+' }}</span>
      </div>
      <template v-if="showAnswers">
        <div
          v-for="answer in record.answers"
          :key="answer.questionId"
          class="mood-answer"
        >
          <div class="mood-answer__q">
            [{{ dimensionName(answer.dimension) }}] {{ answer.questionText }}
          </div>
          <div class="mood-answer__a">
            {{ answer.optionLabels.join('、') || '—' }}
          </div>
        </div>
      </template>
    </div>

    <!-- 操作 -->
    <div class="mood-btn-group">
      <button
        class="mood-btn"
        @click="copyMarkdown"
      >
        {{ t('copyMd') }}
      </button>
      <button
        class="mood-btn"
        :class="{ 'mood-btn--primary': confirmingDelete }"
        @click="removeRecord"
      >
        {{ confirmingDelete ? t('deleteConfirm') : t('delete') }}
      </button>
    </div>
  </div>

  <div
    v-else
    class="mood-empty"
  >
    {{ t('recordMissing') }}
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { showMessage } from 'siyuan'
import { t } from '@/plugin'
import { moodLevel } from '@/quiz/score'
import { state, deleteRecord, putRecord } from '@/store'
import { DIMENSION_MAP, type Dimension, type FollowUp } from '@/types/mood'
import { analyzeRecord } from '@/ai/analyze'
import { formatDateTime } from '@/utils/dom'
import { md2html } from '@/utils/lute'

const props = defineProps<{ recordId: string; embedded?: boolean }>()
const emit = defineEmits<{ back: [] }>()

const showAnswers = ref(false)
const confirmingDelete = ref(false)

const record = computed(() => state.records.find((r) => r.id === props.recordId))
const level = computed(() => moodLevel(record.value?.moodScore ?? 0))
const timeText = computed(() => (record.value ? formatDateTime(record.value.finishedAt) : ''))
const keywords = computed(() => {
  const target = record.value
  if (!target) return []
  return target.ai.keywords?.length ? target.ai.keywords : target.keywordLocal
})
const analyzing = computed(() => record.value?.ai.status === 'running')

function dimensionName(dimension: Dimension): string {
  return DIMENSION_MAP[dimension]?.name || dimension
}

function html(markdown: string): string {
  return md2html(markdown)
}

function followOf(adviceId: string): FollowUp | undefined {
  return record.value?.followUps.find((f) => f.adviceId === adviceId)
}

function showFeeling(adviceId: string): boolean {
  const done = followOf(adviceId)?.done
  return done === 'yes' || done === 'partial'
}

async function persist(): Promise<void> {
  const target = record.value
  if (target) await putRecord(target)
}

async function runAnalyze(): Promise<void> {
  const target = record.value
  if (!target || analyzing.value) return
  const outcome = await analyzeRecord(target)
  if (!outcome.ok && outcome.message) {
    showMessage(outcome.message, 7000, outcome.reason === 'empty' ? 'info' : 'error')
  } else if (outcome.ok) {
    showMessage(t('aiDone'))
  }
}

async function setDone(adviceId: string, value: FollowUp['done']): Promise<void> {
  const follow = followOf(adviceId)
  if (!follow) return
  follow.done = follow.done === value ? 'unset' : value
  follow.at = Date.now()
  await persist()
}

async function setBlocker(adviceId: string, value: string): Promise<void> {
  const follow = followOf(adviceId)
  if (!follow) return
  follow.blocker = (value || undefined) as FollowUp['blocker']
  follow.at = Date.now()
  await persist()
}

async function setFeeling(adviceId: string, value: number): Promise<void> {
  const follow = followOf(adviceId)
  if (!follow) return
  follow.feeling = follow.feeling === value ? undefined : value
  follow.at = Date.now()
  await persist()
}

async function saveNote(adviceId: string, value: string): Promise<void> {
  const follow = followOf(adviceId)
  if (!follow || (follow.note || '') === value) return
  follow.note = value
  follow.at = Date.now()
  await persist()
  showMessage(t('followSaved'))
}

function markdownOf(): string {
  const target = record.value
  if (!target) return ''
  const lines: string[] = [
    `# 心情记录 ${formatDateTime(target.finishedAt)}`,
    '',
    `- 心情分：${target.moodScore}（${level.value.label}）`,
    `- 维度：${Object.entries(target.dimensionScores).map(([key, value]) => `${dimensionName(key as Dimension)} ${value}`).join(' / ')}`,
    `- 关键词：${keywords.value.join('、')}`,
    '',
  ]
  if (target.ai.status === 'done') {
    if (target.ai.mood) lines.push(`**此刻状态**：${target.ai.mood}`, '')
    if (target.ai.analysis) lines.push(target.ai.analysis, '')
    if (target.ai.advice?.length) {
      lines.push('## 建议', '')
      target.ai.advice.forEach((advice, i) => {
        const follow = followOf(advice.id)
        const stateText = follow?.done === 'yes' ? '已做' : follow?.done === 'partial' ? '部分做了' : follow?.done === 'no' ? '没做' : '未跟进'
        lines.push(`${i + 1}. ${advice.text}（${stateText}${follow?.feeling ? `，之后心情 ${follow.feeling}/5` : ''}）`)
        if (follow?.note) lines.push(`   - 实施后感受：${follow.note}`)
      })
      lines.push('')
    }
    if (target.ai.practice) lines.push(`**这几天可以试**：${target.ai.practice}`, '')
  }
  lines.push('## 本次作答', '')
  for (const answer of target.answers) {
    lines.push(`- [${dimensionName(answer.dimension)}] ${answer.questionText} → ${answer.optionLabels.join('、') || '—'}`)
  }
  return lines.join('\n')
}

async function copyMarkdown(): Promise<void> {
  try {
    await navigator.clipboard.writeText(markdownOf())
    showMessage(t('copyOk'))
  } catch (err) {
    console.error('[mood] copy failed', err)
    showMessage(t('copyFailed'), 5000, 'error')
  }
}

async function removeRecord(): Promise<void> {
  const target = record.value
  if (!target) return
  if (!confirmingDelete.value) {
    confirmingDelete.value = true
    setTimeout(() => {
      confirmingDelete.value = false
    }, 4000)
    return
  }
  await deleteRecord(target.id)
  showMessage(t('deleted'))
  emit('back')
}
</script>
