<template>
  <div class="mood-bars">
    <div
      v-for="item in items"
      :key="item.word"
      class="mood-bars__row"
    >
      <span
        class="mood-bars__label"
        :title="item.word"
      >{{ item.word }}</span>
      <span class="mood-bars__track">
        <span
          class="mood-bars__fill"
          :style="{ width: `${percent(item.count)}%` }"
        />
      </span>
      <span class="mood-bars__value">{{ item.count }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KeywordCount } from '@/types/mood'

const props = defineProps<{ items: KeywordCount[] }>()

const max = computed(() => Math.max(1, ...props.items.map((i) => i.count)))

function percent(count: number): number {
  return Math.round((count / max.value) * 100)
}
</script>
