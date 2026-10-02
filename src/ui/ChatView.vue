<template>
  <div class="mood-chat">
    <!-- 会话条：历史会话切换 + 新对话 + 删除 -->
    <div class="mood-chat__bar">
      <select
        class="mood-select mood-chat__sessions"
        :value="state.activeChatId"
        :title="t('chatSessionsTitle')"
        @change="switchSession"
      >
        <option
          v-for="session in state.chatSessions"
          :key="session.id"
          :value="session.id"
        >{{ formatMonthDay(session.createdAt) }} {{ session.title }}</option>
      </select>
      <button
        class="mood-btn mood-chat__bar-btn"
        :title="t('chatNew')"
        @click="newSession"
      >＋</button>
      <button
        class="mood-btn mood-chat__bar-btn"
        :class="{ 'mood-chat__bar-btn--danger': confirmingDelete }"
        :title="t('chatDelete')"
        @click="removeSession"
      >{{ confirmingDelete ? '√' : '×' }}</button>
    </div>

    <!-- 消息区 -->
    <div
      ref="listEl"
      class="mood-chat__list"
    >
      <div
        v-if="!messages.length"
        class="mood-chat__empty"
      >
        <div class="mood-chat__empty-main">{{ t('chatEmpty') }}</div>
        <div class="mood-chat__starters">
          <button
            v-for="q in starters"
            :key="q"
            class="mood-chat__starter"
            @click="ask(q)"
          >{{ q }}</button>
        </div>
      </div>

      <template v-else>
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="mood-chat__msg"
          :class="`mood-chat__msg--${msg.role}`"
        >
          <div
            class="mood-chat__bubble"
            :class="{ 'mood-chat__bubble--error': msg.error }"
          >
            <!-- AI 回复走 Markdown 渲染；用户消息原样文本 -->
            <div
              v-if="msg.role === 'assistant'"
              class="mood-md mood-md--compact"
              v-html="md2html(msg.text)"
            />
            <template v-else>{{ msg.text }}</template>
          </div>
          <div class="mood-chat__time">{{ formatTime(msg.at) }}</div>
        </div>

        <div
          v-if="sending"
          class="mood-chat__msg mood-chat__msg--assistant"
        >
          <div class="mood-chat__bubble">
            <span class="mood-dots"><i /><i /><i /></span>
          </div>
        </div>
      </template>
    </div>

    <!-- 最近记录卡片：点选后 AI 围绕这几条专门分析 -->
    <div
      v-if="recentRecords.length"
      class="mood-chat__attach"
      :title="t('chatAttachTitle')"
    >
      <button
        v-for="(record, index) in recentRecords"
        :key="record.id"
        class="mood-chat__attach-chip"
        :class="{
          'mood-chat__attach-chip--on': attached.includes(record.id),
          'mood-chat__attach-chip--latest': index === 0,
        }"
        @click="toggleAttach(record.id)"
      >{{ chipLabel(record) }}</button>
    </div>

    <!-- 输入区：Enter 发送，Shift+Enter 换行 -->
    <div class="mood-chat__inputrow">
      <textarea
        v-model="draft"
        class="mood-input mood-chat__draft"
        rows="2"
        :placeholder="t('chatPlaceholder')"
        @keydown.enter.exact.prevent="send"
      />
      <button
        class="mood-btn mood-btn--primary mood-chat__send"
        :disabled="!draft.trim() || sending"
        @click="send"
      >{{ t('chatSend') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { t } from '@/plugin'
import { createChatSession, deleteChatSession, switchChat, state } from '@/store'
import type { QuizRecord } from '@/types/mood'
import { sendChatMessage } from '@/ai/analyze'
import { md2html } from '@/utils/lute'
import { formatMonthDay, formatTime } from '@/utils/dom'

const draft = ref('')
const sending = ref(false)
const confirmingDelete = ref(false)
const listEl = ref<HTMLElement | null>(null)

const starters = [t('chatStarter1'), t('chatStarter2'), t('chatStarter3')]

/** 最近 5 条记录卡片，点选（最多 3 条）作为本次提问的分析重点 */
const MAX_ATTACH = 3
const attached = ref<string[]>([])
const recentRecords = computed(() => state.records.slice(0, 5))

function chipLabel(record: QuizRecord): string {
  const name = record.moodName || record.ai.keywords?.[0] || record.keywordLocal[0] || ''
  return `${formatMonthDay(record.finishedAt)} ${record.moodScore} ${name}`.trim()
}

function toggleAttach(id: string): void {
  const index = attached.value.indexOf(id)
  if (index >= 0) attached.value.splice(index, 1)
  else if (attached.value.length < MAX_ATTACH) attached.value.push(id)
}

const messages = computed(() => state.chatSessions.find((c) => c.id === state.activeChatId)?.messages || [])

// 新消息或思考中，都把列表滚到底
watch(
  () => [messages.value.length, sending.value],
  () => {
    void nextTick(() => {
      listEl.value?.scrollTo({ top: listEl.value.scrollHeight, behavior: 'smooth' })
    })
  },
)

function switchSession(event: Event): void {
  void switchChat((event.target as HTMLSelectElement).value)
}

async function newSession(): Promise<void> {
  await createChatSession()
}

async function removeSession(): Promise<void> {
  if (!state.activeChatId) return
  // 两段式确认，和删记录一个手感
  if (!confirmingDelete.value) {
    confirmingDelete.value = true
    window.setTimeout(() => { confirmingDelete.value = false }, 2500)
    return
  }
  confirmingDelete.value = false
  await deleteChatSession(state.activeChatId)
}

function ask(text: string): void {
  draft.value = text
  void send()
}

async function send(): Promise<void> {
  const text = draft.value.trim()
  if (!text || sending.value) return
  draft.value = ''
  const recordIds = attached.value.slice()
  attached.value = []
  sending.value = true
  try {
    await sendChatMessage(text, recordIds)
  } finally {
    sending.value = false
  }
}
</script>
