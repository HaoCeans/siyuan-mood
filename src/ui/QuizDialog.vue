<template>
  <div class="mood-quiz">
    <div class="mood-quiz__bar">
      <div :style="{ width: `${progress}%` }" />
    </div>

    <div class="mood-quiz__meta">
      <span>{{ index + 1 }} / {{ totalSteps }}</span>
      <span>{{ stepLabel }}</span>
    </div>

    <div
      v-if="note && index === 0"
      class="mood-chip mood-chip--warning"
    >
      {{ note }}
    </div>

    <!-- 收尾一步：情绪命名 + 身体信号（都不计分，都可以跳过） -->
    <template v-if="isClosing">
      <div class="mood-quiz__question">
        {{ t('closingTitle') }}
      </div>
      <div class="mood-setting-note">
        {{ t('closingHint') }}
      </div>

      <div class="mood-quiz__options">
        <div class="mood-chips mood-closing__chips">
          <span
            v-for="word in allCheckinWords()"
            :key="word"
            class="mood-chip mood-closing__chip"
            :class="{ 'mood-closing__chip--picked': moodNameChoice === word }"
            @click="moodNameChoice = moodNameChoice === word ? '' : word"
          >
            <img
              v-if="wordIconFile(word)"
              class="mood-emoji-img"
              :src="iconUrl(wordIconFile(word))"
              alt=""
            >{{ word }}
          </span>
        </div>

        <input
          class="mood-input"
          type="text"
          :placeholder="t('closingCustomPlaceholder')"
          :value="moodNameCustom"
          @input="moodNameCustom = ($event.target as HTMLInputElement).value"
        >

        <div class="mood-closing__signals">
          <div class="mood-setting-note">
            {{ t('signalsTitle') }}
          </div>
          <div class="mood-chips">
            <span
              v-for="signal in SIGNAL_WORDS"
              :key="signal"
              class="mood-chip mood-closing__chip"
              :class="{ 'mood-closing__chip--picked': pickedSignals.includes(signal) }"
              @click="toggleSignal(signal)"
            >{{ signal }}</span>
          </div>
          <div class="mood-setting-note">
            {{ t('signalsHint') }}
          </div>
        </div>
      </div>
    </template>

    <!-- 普通题目 -->
    <template v-else>
      <div class="mood-quiz__question">
        {{ current.text }}
      </div>
      <div class="mood-setting-note">
        {{ hintText }}
      </div>

      <!-- 收尾填空题：用自己的话写，不计分、可留空 -->
      <div
        v-if="isText"
        class="mood-quiz__options"
      >
        <textarea
          class="mood-input mood-quiz__text"
          rows="6"
          :placeholder="t('quizTextPlaceholder')"
          :value="texts[current.id] || ''"
          @input="onTextInput(($event.target as HTMLTextAreaElement).value)"
        />
        <div class="mood-setting-note">
          {{ t('quizTextOptional') }}
        </div>
      </div>

      <div
        v-else
        class="mood-quiz__options"
      >
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
    </template>

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
          {{ isClosing ? t('skip') : t('skip') }}
        </button>
      </div>

      <button
        v-if="!isClosing"
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
import { activeQuestions, allCheckinWords, createRecord, lastQuestionIds, putRecord, state } from '@/store'
import { pickQuestions } from '@/quiz/picker'
import { SIGNAL_WORDS, iconUrl, wordIconFile } from '@/quiz/emotions'
import { getPlugin } from '@/plugin'
import { showMessage } from 'siyuan'

const props = defineProps<{
  onDone?: (record: QuizRecord) => void
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
/** 填空题的原文，按题目 id 存 */
const texts = ref<Record<string, string>>({})
const index = ref(0)
const submitting = ref(false)

const moodNameChoice = ref('')
const moodNameCustom = ref('')
const pickedSignals = ref<string[]>([])

const isClosing = computed(() => index.value >= questions.value.length)
const totalSteps = computed(() => questions.value.length + 1)
const current = computed(() => questions.value[index.value])
const isText = computed(() => current.value?.type === 'text')
const answered = computed(() => {
  if (isClosing.value) return true
  const question = current.value
  if (!question) return false
  // 填空题可以留空
  if (question.type === 'text') return true
  return (answers.value[question.id] || []).length > 0
})
const hintText = computed(() => {
  const question = current.value
  if (!question) return ''
  if (question.type === 'text') return t('quizTextHint')
  return question.type === 'multiple' ? t('quizMultipleHint') : t('quizSingleHint')
})
const stepLabel = computed(() => {
  if (isClosing.value) return t('closingStepLabel')
  const question = current.value
  return question ? DIMENSION_MAP[question.dimension].name : ''
})
const progress = computed(() => (totalSteps.value ? ((index.value + 1) / totalSteps.value) * 100 : 0))

function onTextInput(value: string): void {
  const question = current.value
  if (!question) return
  texts.value = { ...texts.value, [question.id]: value }
}

function toggleSignal(signal: string): void {
  const list = pickedSignals.value
  pickedSignals.value = list.includes(signal) ? list.filter((item) => item !== signal) : [...list, signal]
}

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
  if (isClosing.value) {
    void submit()
    return
  }
  const question = current.value
  const nextAnswers = { ...answers.value }
  delete nextAnswers[question.id]
  answers.value = nextAnswers
  if (question.type === 'text') {
    const nextTexts = { ...texts.value }
    delete nextTexts[question.id]
    texts.value = nextTexts
  }
  if (index.value >= questions.value.length - 1) index.value = questions.value.length
  else index.value++
}

async function submit(): Promise<void> {
  if (submitting.value || !questions.value.length) return
  submitting.value = true
  try {
    const list: QuizAnswer[] = []
    for (const question of questions.value) {
      if (question.type === 'text') {
        const text = (texts.value[question.id] || '').trim()
        if (text) list.push(buildAnswer(question, [], text))
        continue
      }
      const optionIds = answers.value[question.id] || []
      if (!optionIds.length) continue
      list.push(buildAnswer(question, optionIds))
    }
    // 至少要有一道计分题的作答，否则记录里的心情分会是 0，反而误导
    if (!list.some((answer) => answer.score >= 0)) {
      showMessage(t('quizNoAnswer'))
      submitting.value = false
      return
    }
    // 情绪名称：自己输入的优先，其次选中的词
    const moodName = moodNameCustom.value.trim() || moodNameChoice.value || undefined
    const record = createRecord(questions.value, list, startedAt, {
      moodName,
      signals: pickedSignals.value.slice(),
    })
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
