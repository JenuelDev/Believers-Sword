<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { Icon } from '@iconify/vue';
import { BIBLE_QUESTIONS_PREVIEW_NOTE, type BibleQuestionSummary } from './bibleQuestions';
import PreviewBadge from '../../../components/PreviewBadge.vue';
import BibleQuestionDetail from './BibleQuestionDetail.vue';

// Desktop popup window (route /bible-question, opened by
// `bibleQuestions:openWindow`). The summary arrives in the query so the
// header renders at once; answers load over IPC like the dialog.
const route = useRoute();
const question = computed<BibleQuestionSummary>(() => ({
    id: Number(route.query.id),
    question: String(route.query.question ?? ''),
    category: String(route.query.category ?? ''),
    answer_count: Number(route.query.answers ?? 0),
}));

onMounted(() => {
    document.title = question.value.question || 'Bible Question';
});

function close() {
    void window.browserWindow.closeCurrentWindow();
}
</script>

<template>
    <div class="question-window">
        <header class="window-bar">
            <span class="window-bar-heading">
                <span class="window-bar-title">Bible Questions</span>
                <PreviewBadge class="window-bar-badge" :message="BIBLE_QUESTIONS_PREVIEW_NOTE" />
            </span>
            <button type="button" class="window-close" title="Close" aria-label="Close window" @click="close">
                <Icon icon="mdi:close" />
            </button>
        </header>
        <main class="window-scroll">
            <div class="window-content">
                <h1 class="window-question">{{ question.question }}</h1>
                <BibleQuestionDetail v-if="question.id" :question="question" />
            </div>
        </main>
    </div>
</template>

<style scoped>
.question-window { height: 100vh; display: flex; flex-direction: column; overflow: hidden; background: var(--theme-bg-main); color: var(--theme-text); }
.window-bar { flex-shrink: 0; height: 36px; display: flex; align-items: center; justify-content: space-between; padding: 0 6px 0 16px; border-bottom: 1px solid var(--theme-border); user-select: none; -webkit-app-region: drag; }
.window-bar-heading { display: inline-flex; align-items: center; gap: 8px; }
.window-bar-badge { -webkit-app-region: no-drag; }
.window-bar-title { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--theme-text-soft); }
.window-close { -webkit-app-region: no-drag; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 0; border-radius: 6px; background: transparent; color: var(--theme-text-soft); font-size: 16px; cursor: pointer; }
.window-close:hover { background: var(--theme-bg-elevated); color: var(--theme-text); }
.window-close:focus-visible { outline: 2px solid var(--primary-color, #6f84ff); outline-offset: -2px; }
.window-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.window-content { max-width: 760px; margin: 0 auto; padding: 24px 28px 40px; box-sizing: border-box; }
.window-question { margin: 0 0 14px; padding: 0; font-size: 22px; line-height: 1.35; font-weight: 700; overflow-wrap: anywhere; }
</style>
