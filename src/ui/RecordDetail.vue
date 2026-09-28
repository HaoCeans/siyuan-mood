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
        v-if="keywords.length || record.moodName || record.signals?.length"
        class="mood-chips"
        style="margin-top: 8px"
      >
        <span
          v-if="record.moodName"
          class="mood-chip mood-chip--info"
        >{{ record.moodName }}</span>
        <span
          v-for="word in keywords"
          :key="word"
          class="mood-chip"
        >{{ word }}</span>
        <span
          v-for="signal in record.signals || []"
          :key="signal"
          class="mood-chip mood-chip--muted"
        >{{ signal }}</span>
      </div>
    </div>

    <!-- 关联思源块：绑定的笔记内容会作为上下文交给 AI 解读 -->
    <div class="mood-section">
      <div class="mood-section__title">
        <span>{{ t('blockSection') }}</span>
        <span class="spacer" />
        <button
          v-if="record.boundBlockId"
          class="mood-btn mood-btn--ghost"
          @click="unbindBlock"
        >
          {{ t('blockUnbind') }}
        </button>
      </div>

      <template v-if="record.boundBlockId">
        <div class="mood-block-preview">
          <div class="mood-block-preview__id">
            {{ record.boundBlockId }}
          </div>
          <div
            v-if="blockLoading"
            class="mood-setting-note"
          >
            {{ t('loading') }}
          </div>
          <div
            v-else-if="blockError"
            class="mood-setting-note"
          >
            {{ blockError }}
          </div>
          <div
            v-else
            class="mood-md mood-md--compact"
            v-html="html(blockPreview)"
          />
        </div>
        <div
          class="mood-btn-group"
          style="margin-top: 8px"
        >
          <button
            class="mood-btn"
            @click="openBoundBlock"
          >
            {{ t('blockOpen') }}
          </button>
          <button
            class="mood-btn"
            :disabled="analyzing"
            @click="runAnalyze"
          >
            {{ t('aiRerun') }}
          </button>
        </div>
      </template>

      <template v-else>
        <div
          class="mood-setting-row"
          style="margin-top: 0"
        >
          <input
            v-model="blockIdDraft"
            class="mood-input"
            style="flex: 1"
            type="text"
            :placeholder="t('blockPlaceholder')"
          >
          <button
            class="mood-btn mood-btn--primary"
            :disabled="!blockIdDraft.trim() || binding"
            @click="bindBlock"
          >
            {{ binding ? t('loading') : t('blockBind') }}
          </button>
        </div>
      </template>
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
        class="mood-thinking"
      >
        <div class="mood-thinking__line">
          <span class="mood-dots"><i /><i /><i /></span>
          <span>{{ progressText }}</span>
        </div>
        <div class="mood-skeleton">
          <div
            class="mood-skeleton__line"
            style="width: 94%"
          />
          <div
            class="mood-skeleton__line"
            style="width: 78%"
          />
          <div
            class="mood-skeleton__line"
            style="width: 56%"
          />
        </div>
      </div>

      <template v-else-if="record.ai.status === 'done'">
        <div
          v-if="record.ai.mood"
          class="mood-status"
        >
          {{ record.ai.mood }}
        </div>

        <div
          v-if="record.ai.changes"
          class="mood-sub"
        >
          <div class="mood-sub__label">
            {{ t('changesTitle') }}
          </div>
          <div
            class="mood-md"
            v-html="html(record.ai.changes)"
          />
        </div>

        <div
          v-if="record.ai.analysis"
          class="mood-sub"
        >
          <div class="mood-sub__label">
            {{ t('aiAnalysisLabel') }}
          </div>
          <div
            class="mood-md"
            v-html="html(record.ai.analysis)"
          />
        </div>

        <div
          v-if="record.ai.practice"
          class="mood-sub"
        >
          <div class="mood-sub__label">
            {{ t('practiceTitle') }}
          </div>
          <div
            class="mood-md"
            v-html="html(record.ai.practice)"
          />
        </div>
      </template>

      <template v-else-if="record.ai.status === 'failed'">
        <div class="mood-setting-note">
          {{ record.ai.error || t('aiFailed') }}
        </div>
        <div
          v-if="record.ai.raw"
          class="mood-md"
          style="margin-top: 8px"
          v-html="html(record.ai.raw)"
        />
      </template>

      <div
        v-else
        class="mood-setting-note"
      >
        {{ t('aiIdleHint') }}
      </div>

      <!-- 做法清单：AI 给的建议和用户自己写的放在一起，跟进方式完全一样。
           三条 AI 建议可能都不合适，而自己想出来的那条往往才管用，所以它要能被记下来。 -->
      <div
        v-if="!analyzing"
        class="mood-advice"
        style="margin-top: 10px"
      >
        <div
          v-if="!actionItems.length && !addingOwn"
          class="mood-setting-note"
        >
          {{ t('adviceEmptyHint') }}
        </div>

        <div
          v-for="(item, i) in actionItems"
          :key="item.id"
          class="mood-advice__item"
        >
          <div class="mood-advice__text">
            <span>{{ i + 1 }}.</span>
            <span>{{ item.text }}</span>
            <span
              v-if="item.own"
              class="mood-chip mood-chip--muted"
            >{{ t('adviceOwn') }}</span>
          </div>

          <div
            v-if="followOf(item.id)"
            class="mood-follow"
          >
            <button
              class="mood-btn"
              :class="{ 'mood-btn--primary': followOf(item.id)?.done === 'yes' }"
              @click="setDone(item.id, 'yes')"
            >
              {{ t('followDone') }}
            </button>
            <button
              class="mood-btn"
              :class="{ 'mood-btn--primary': followOf(item.id)?.done === 'partial' }"
              @click="setDone(item.id, 'partial')"
            >
              {{ t('followPartial') }}
            </button>
            <button
              class="mood-btn"
              :class="{ 'mood-btn--primary': followOf(item.id)?.done === 'no' }"
              @click="setDone(item.id, 'no')"
            >
              {{ t('followNo') }}
            </button>

            <template v-if="followOf(item.id)?.done === 'no'">
              <select
                class="mood-select"
                :value="followOf(item.id)?.blocker || ''"
                @change="setBlocker(item.id, ($event.target as HTMLSelectElement).value)"
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

            <template v-if="showFeeling(item.id)">
              <span>{{ t('followFeeling') }}</span>
              <div class="mood-feeling">
                <span
                  v-for="n in 5"
                  :key="n"
                  :class="{ picked: followOf(item.id)?.feeling === n }"
                  @click="setFeeling(item.id, n)"
                >{{ n }}</span>
              </div>
            </template>

            <button
              v-if="item.own"
              class="mood-btn mood-btn--ghost"
              @click="removeOwn(item.id)"
            >
              {{ t('adviceOwnRemove') }}
            </button>
          </div>

          <textarea
            v-if="showFeeling(item.id) || followOf(item.id)?.note"
            class="mood-input"
            rows="2"
            :placeholder="t('followPlaceholder')"
            :value="followOf(item.id)?.note || ''"
            @blur="saveNote(item.id, ($event.target as HTMLTextAreaElement).value)"
          />
        </div>

        <!-- 自己写一条做法 -->
        <div
          v-if="addingOwn"
          class="mood-advice__item"
        >
          <textarea
            class="mood-input"
            rows="2"
            :placeholder="t('adviceOwnPlaceholder')"
            :value="ownDraft"
            @input="ownDraft = ($event.target as HTMLTextAreaElement).value"
          />
          <div class="mood-btn-group">
            <button
              class="mood-btn mood-btn--primary"
              :disabled="!ownDraft.trim()"
              @click="saveOwn"
            >
              {{ t('adviceOwnSave') }}
            </button>
            <button
              class="mood-btn mood-btn--ghost"
              @click="cancelOwn"
            >
              {{ t('adviceOwnCancel') }}
            </button>
          </div>
        </div>
        <div
          v-else
          class="mood-btn-group"
        >
          <button
            class="mood-btn mood-btn--ghost"
            @click="startAddOwn"
          >
            {{ t('adviceOwnAdd') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 跟进复盘：解读之后产生的新一轮数据，当场就能看效果 -->
    <div
      v-if="record.followUps.length"
      class="mood-section"
    >
      <div class="mood-section__title">
        <span>{{ t('followReviewTitle') }}</span>
        <span class="spacer" />
        <span
          v-if="reviewTime"
          class="mood-setting-note"
        >{{ reviewTime }}</span>
        <button
          class="mood-btn mood-btn--ghost"
          :disabled="reviewing || !canReview"
          @click="runReview"
        >
          {{ record.followReview?.status === 'done' ? t('followReviewRerun') : t('followReviewRun') }}
        </button>
      </div>

      <div
        v-if="reviewing"
        class="mood-thinking"
      >
        <div class="mood-thinking__line">
          <span class="mood-dots"><i /><i /><i /></span>
          <span>{{ reviewProgress }}</span>
        </div>
        <div class="mood-skeleton">
          <div
            class="mood-skeleton__line"
            style="width: 88%"
          />
          <div
            class="mood-skeleton__line"
            style="width: 62%"
          />
        </div>
      </div>

      <template v-else-if="record.followReview?.status === 'done'">
        <div
          v-if="record.followReview.analysis"
          class="mood-md"
          v-html="html(record.followReview.analysis)"
        />
        <div
          v-if="record.followReview.works?.length"
          style="margin-top: 8px"
        >
          <div class="mood-review-label">
            {{ t('followReviewWorks') }}
          </div>
          <ul class="mood-md mood-review-list">
            <li
              v-for="(item, i) in record.followReview.works"
              :key="`works-${i}`"
            >{{ item }}</li>
          </ul>
        </div>
        <div
          v-if="record.followReview.next?.length"
          style="margin-top: 8px"
        >
          <div class="mood-review-label">
            {{ t('followReviewNext') }}
          </div>
          <ul class="mood-md mood-review-list">
            <li
              v-for="(item, i) in record.followReview.next"
              :key="`next-${i}`"
            >{{ item }}</li>
          </ul>
        </div>
      </template>

      <template v-else-if="record.followReview?.status === 'failed'">
        <div class="mood-setting-note">
          {{ record.followReview.error || t('aiFailed') }}
        </div>
        <div
          v-if="record.followReview.raw"
          class="mood-md"
          style="margin-top: 8px"
          v-html="html(record.followReview.raw)"
        />
      </template>

      <div
        v-else
        class="mood-setting-note"
      >
        {{ canReview ? t('followReviewHint') : t('followReviewEmpty') }}
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
            {{ answerText(answer) }}
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
import { computed, ref, watch } from 'vue'
import { showMessage } from 'siyuan'
import { t } from '@/plugin'
import { answerText, moodLevel } from '@/quiz/score'
import { state, deleteRecord, putRecord } from '@/store'
import { DIMENSION_MAP, type Dimension, type FollowUp } from '@/types/mood'
import { analyzeRecord, reviewFollowUps } from '@/ai/analyze'
import { cleanKramdown, getBlockKramdown } from '@/api'
import { formatDateTime, formatTime } from '@/utils/dom'
import { md2html } from '@/utils/lute'
import { useAiProgress } from '@/ui/useAiProgress'

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
/** 解读中的轮播文案，避免「转圈到底卡没卡住」 */
const progressText = useAiProgress(analyzing)

/** 至少标了一条建议的执行情况，才谈得上复盘 */
const canReview = computed(() => (record.value?.followUps || []).some((f) => f.done !== 'unset'))
const reviewing = computed(() => record.value?.followReview?.status === 'running')
const reviewProgress = useAiProgress(reviewing, ['followStepRead', 'followStepCompare', 'followStepNext'])
const reviewTime = computed(() => {
  const at = record.value?.followReview?.at
  return at && record.value?.followReview?.status === 'done' ? `${t('aiAt')} ${formatTime(at)}` : ''
})

/** 做法清单：AI 给的建议 + 自己写的做法，两者跟进方式完全一样 */
const actionItems = computed(() => {
  const target = record.value
  if (!target) return []
  const fromAi = (target.ai.advice || []).map((advice) => ({ id: advice.id, text: advice.text, own: false }))
  const fromUser = target.followUps
    .filter((follow) => follow.source === 'user')
    .map((follow) => ({ id: follow.adviceId, text: follow.adviceText, own: true }))
  return [...fromAi, ...fromUser]
})

const addingOwn = ref(false)
const ownDraft = ref('')

function startAddOwn(): void {
  addingOwn.value = true
  ownDraft.value = ''
}

function cancelOwn(): void {
  addingOwn.value = false
  ownDraft.value = ''
}

/** 自己写的做法存成一条跟进，和 AI 建议同构：下次解读会带上，复盘也会一起看 */
async function saveOwn(): Promise<void> {
  const target = record.value
  const text = ownDraft.value.trim()
  if (!target || !text) return
  target.followUps.push({
    adviceId: `own-${Date.now()}`,
    adviceText: text,
    done: 'unset',
    source: 'user',
    at: Date.now(),
  })
  await putRecord(target)
  addingOwn.value = false
  ownDraft.value = ''
  showMessage(t('adviceOwnSaved'))
}

async function removeOwn(adviceId: string): Promise<void> {
  const target = record.value
  if (!target) return
  target.followUps = target.followUps.filter((follow) => follow.adviceId !== adviceId)
  await putRecord(target)
}

// **************************************** 关联思源块 ****************************************

const blockIdDraft = ref('')
const binding = ref(false)
const blockLoading = ref(false)
const blockError = ref('')
const blockPreview = ref('')

/** 绑定 / 更换后拉取块内容做预览（AI 解读时也会实时读取） */
async function loadBlockPreview(id: string): Promise<void> {
  blockLoading.value = true
  blockError.value = ''
  try {
    const res = await getBlockKramdown(id)
    const markdown = cleanKramdown(res?.kramdown || '')
    if (!markdown) {
      blockError.value = t('blockEmpty')
      blockPreview.value = ''
      return
    }
    blockPreview.value = markdown
  } catch (err) {
    console.error('[mood] load block preview failed', err)
    blockError.value = t('blockNotFound')
  } finally {
    blockLoading.value = false
  }
}

watch(() => record.value?.boundBlockId, (id) => {
  if (id) void loadBlockPreview(id)
}, { immediate: true })

async function bindBlock(): Promise<void> {
  const target = record.value
  const id = blockIdDraft.value.trim()
  if (!target || !id || binding.value) return
  binding.value = true
  try {
    const res = await getBlockKramdown(id)
    if (!cleanKramdown(res?.kramdown || '')) {
      showMessage(t('blockEmpty'), 6000, 'error')
      return
    }
    target.boundBlockId = id
    await putRecord(target)
    blockIdDraft.value = ''
    showMessage(t('blockBound'))
  } catch (err) {
    console.error('[mood] bind block failed', err)
    showMessage(t('blockNotFound'), 6000, 'error')
  } finally {
    binding.value = false
  }
}

async function unbindBlock(): Promise<void> {
  const target = record.value
  if (!target?.boundBlockId) return
  target.boundBlockId = undefined
  await putRecord(target)
  blockPreview.value = ''
  blockError.value = ''
}

/** 思源的块协议跳转：定位到该块 */
function openBoundBlock(): void {
  const id = record.value?.boundBlockId
  if (!id) return
  try {
    window.location.href = `siyuan://blocks/${id}`
  } catch (err) {
    console.error('[mood] open block failed', err)
    showMessage(t('blockOpenFailed'), 5000, 'error')
  }
}

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

async function runReview(): Promise<void> {
  const target = record.value
  if (!target || reviewing.value) return
  const outcome = await reviewFollowUps(target)
  if (!outcome.ok && outcome.message) {
    const soft = outcome.reason === 'empty' || outcome.reason === 'nothing'
    showMessage(outcome.message, 7000, soft ? 'info' : 'error')
  } else if (outcome.ok) {
    showMessage(t('followReviewDone'))
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
  if (target.followReview?.status === 'done') {
    lines.push('## 跟进复盘', '')
    if (target.followReview.analysis) lines.push(target.followReview.analysis, '')
    if (target.followReview.works?.length) {
      lines.push('**确实有效的**', '')
      for (const item of target.followReview.works) lines.push(`- ${item}`)
      lines.push('')
    }
    if (target.followReview.next?.length) {
      lines.push('**下次可以换成**', '')
      for (const item of target.followReview.next) lines.push(`- ${item}`)
      lines.push('')
    }
  }
  lines.push('## 本次作答', '')
  for (const answer of target.answers) {
    lines.push(`- [${dimensionName(answer.dimension)}] ${answer.questionText} → ${answerText(answer)}`)
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
