<script setup lang="ts">
import { NModal } from 'naive-ui';
import type { BibleQuestionSummary } from './bibleQuestions';
import BibleQuestionDetail from './BibleQuestionDetail.vue';

// Web only: desktop opens each question in its own window instead.
defineProps<{ question: BibleQuestionSummary | null }>();
const emit = defineEmits<{ (event: 'close'): void }>();
</script>

<template>
    <NModal
        :show="question !== null"
        preset="card"
        :title="question?.question ?? ''"
        class="bible-question-modal"
        style="width: min(760px, 94vw); max-height: min(85vh, 900px)"
        content-style="overflow-y: auto; min-height: 0; overscroll-behavior: contain"
        :bordered="false"
        @update:show="value => { if (!value) emit('close'); }"
    >
        <BibleQuestionDetail v-if="question" :question="question" />
    </NModal>
</template>
