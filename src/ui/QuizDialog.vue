<template>
  <div class="mood-quiz">
    <div class="mood-quiz__bar">
      <div :style="{ width: `${progress}%` }" />
    </div>

    <div class="mood-quiz__meta">
      <span>{{ index + 1 }} / {{ questions.length }}</span>
      <span>{{ dimensionName }}</span>
    </div>

    <div
      v-if="note"
      class="mood-chip mood-chip--warning"
    >
      {{ note }}
    </div>

    <div class="mood-quiz__question">
      {{ current.text }}
    </div>
    <div class="mood-setting-note">
      {{ current.type === 'multiple' ? t('quizMultipleHint') : t('quizSingleHint') }}
    </div>

    <div class="mood-quiz__options">
      <div
        v-for="option in current.options"
        :key="option.id"
        class="mood-option"
        :class="{
          'mood-option--picked': isPicked(option.id),
          'mood-option--multiple': current.type === 'multiple',
        }"
        @click="pick(option.id)"
      >
        <span class="mood-option__mark">{{ isPicked(option.id) ? '✓' : '' }}</span>
        <span class="mood-option__text">{{ option.label }}</span>
      </div>
    </div>

    <div class="mood-quiz__footer">
      <div class="mood-btn-group">
        <button
          class="mood-btn mood-btn--ghost"
          :disabled="index === 0"
          @click="index--"
        >
          {{ t('prev') }}
        </button>
        <button
          class="mood-btn mood-btn--ghost"
          @click="skip"
        >
          {{ t('skip') }}
        </button>
        <button
          class="mood-btn mood-btn--ghost"
          @click="cancel"
        >
          {{ t('cancel') }}
        </button>
      </div>

      <button
        v-if="!isLast"
        class="mood-btn mood-btn--primary"
        :disabled="!answered"
        @click="index++"
      >
        {{ t('next') }}
      </button>
      <button
        v-else
        class="mood-btn mood-btn--primary"
        :disabled="submitting"
        @click="submit"
      >
        {{ submitting ? t('saving') : t('submit') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { t } from '@/plugin'
import { buildAnswer } from '@/quiz/score'
import { DIMENSION_MAP, type QuizAnswer, type QuizQuestion, type QuizRecord } from '@/types/mood'
import { activeQuestions, createRecord, lastQuestionIds, putRecord, state } from '@/store'
import { pickQuestions } from '@/quiz/picker'
import { getPlugin } from '@/plugin'
import { showMessage } from 'siyuan'

const props = defineProps<{
  onDone?: (record: QuizRecord) => void
  onCancel?: () => void
}>()

const startedAt = Date.now()
const picked = pickQuestions(activeQuestions(), {
  count: state.settings.questionsPerQuiz,
  lastIds: lastQuestionIds(),
  tolerance: state.settings.repeatTolerance,
})

const questions = ref<QuizQuestion[]>(picked.questions)
const note = picked.note || ''
const answers = ref<Record<string, string[]>>({})
const index = ref(0)
const submitting = ref(false)

const current = computed(() => questions.value[index.value])
const isLast = computed(() => index.value >= questions.value.length - 1)
const answered = computed(() => (answers.value[current.value?.id] || []).length > 0)
const progress = computed(() => (questions.value.length ? ((index.value + 1) / questions.value.length) * 100 : 0))
const dimensionName = computed(() => (current.value ? DIMENSION_MAP[current.value.dimension].name : ''))

function isPicked(optionId: string): boolean {
  return (answers.value[current.value.id] || []).includes(optionId)
}

function pick(optionId: string): void {
  const question = current.value
  const list = answers.value[question.id] || []
  if (question.type === 'single') {
    answers.value = { ...answers.value, [question.id]: [optionId] }
  } else {
    const next = list.includes(optionId) ? list.filter((id) => id !== optionId) : [...list, optionId]
    answers.value = { ...answers.value, [question.id]: next }
  }
}

function skip(): void {
  const question = current.value
  const next = { ...answers.value }
  delete next[question.id]
  answers.value = next
  if (isLast.value) void submit()
  else index.value++
}

function cancel(): void {
  props.onCancel?.()
}

async function submit(): Promise<void> {
  if (submitting.value || !questions.value.length) return
  submitting.value = true
  try {
    const list: QuizAnswer[] = []
    for (const question of questions.value) {
      const optionIds = answers.value[question.id] || []
      if (!optionIds.length) continue
      list.push(buildAnswer(question, optionIds))
    }
    if (!list.length) {
      showMessage(t('quizNoAnswer'))
      submitting.value = false
      return
    }
    const record = createRecord(questions.value, list, startedAt)
    await putRecord(record)
    // 刚测完，红点该灭了
    getPlugin()?.refreshReminder()
    props.onDone?.(record)
  } catch (err) {
    console.error('[mood] submit failed', err)
    showMessage(t('saveFailed'), 5000, 'error')
    submitting.value = false
  }
}
</script>
