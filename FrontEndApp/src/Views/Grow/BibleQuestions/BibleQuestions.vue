<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { NButton, NInput, NSpin } from 'naive-ui';
import { Icon } from '@iconify/vue';
import { createBibleQuestionList } from './useBibleQuestionList';
import { BIBLE_QUESTIONS_PREVIEW_NOTE, countLabel, highlightSegments, type BibleQuestionSummary } from './bibleQuestions';
import PreviewBadge from '../../../components/PreviewBadge.vue';
import BibleQuestionDetailModal from './BibleQuestionDetailModal.vue';

const emit = defineEmits<{ (event: 'back'): void }>();

const list = createBibleQuestionList(args => window.browserWindow.getBibleQuestionPage(args));
const { questions, total, loading, error, search, category, hasMore } = list;
const query = ref('');
const categories = ref<string[]>([]);
const selected = ref<BibleQuestionSummary | null>(null);
const scroller = ref<HTMLElement>();
const isDesktop = Boolean(window.isElectron);

const summary = computed(() => {
    if (loading.value && !questions.value.length) return 'Searching the library...';
    const label = countLabel(total.value, 'question');
    return category.value ? `${label} in ${category.value}` : label;
});

function toTop() {
    scroller.value?.scrollTo({ top: 0 });
}

function onSearch(value: string) {
    query.value = value;
    toTop();
    void list.reset({ query: value, debounce: true });
}

function clearSearch() {
    query.value = '';
    toTop();
    void list.reset({ query: '' });
}

/** Clicking the active category again returns to all questions. */
function selectCategory(value: string) {
    toTop();
    void list.reset({ category: category.value === value ? '' : value });
}

/** Desktop opens each question in its own window; the web uses a dialog. */
function openQuestion(question: BibleQuestionSummary) {
    if (!isDesktop) {
        selected.value = question;
        return;
    }
    const { id, category, answer_count } = question;
    void window.browserWindow.openBibleQuestionWindow({ id, question: question.question, category, answer_count });
}

function loadNearEnd() {
    const element = scroller.value;
    if (!element || loading.value || error.value || !hasMore.value) return;
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 400) void list.loadMore();
}

// After each page renders, keep loading until a tall window is filled.
watch(questions, () => nextTick(loadNearEnd));

onMounted(async () => {
    void list.reset();
    try {
        categories.value = await window.browserWindow.getBibleQuestionCategories();
    } catch {
        // Category filters are optional; the list still works without them.
    }
});

onBeforeUnmount(() => list.dispose());
</script>

<template>
    <section class="questions-page">
        <div class="questions-top">
            <header class="flex items-center gap-3 flex-wrap">
                <NButton quaternary @click="emit('back')"><Icon icon="mdi:arrow-left" /> Grow</NButton>
                <h1 class="text-xl font-bold flex-1 flex items-center gap-2">
                    Bible Questions
                    <PreviewBadge :message="BIBLE_QUESTIONS_PREVIEW_NOTE" />
                </h1>
            </header>
            <NInput
                :value="query"
                placeholder="Search questions"
                clearable
                size="large"
                class="questions-search"
                @update:value="onSearch"
            >
                <template #prefix><Icon icon="mdi:magnify" class="text-[var(--theme-text-soft)]" /></template>
            </NInput>
            <div v-if="categories.length > 1" class="category-pills" role="toolbar" aria-label="Question categories">
                <button
                    v-for="value in ['', ...categories]"
                    :key="value"
                    type="button"
                    class="cat-pill"
                    :class="{ active: category === value }"
                    :aria-pressed="category === value"
                    @click="selectCategory(value)"
                >
                    {{ value || 'All' }}
                </button>
            </div>
            <p class="questions-summary" role="status">{{ summary }}</p>
        </div>
        <div ref="scroller" class="questions-scroll" @scroll.passive="loadNearEnd">
            <div class="questions-list">
                <button
                    v-for="question in questions"
                    :key="question.id"
                    type="button"
                    class="question-card"
                    @click="openQuestion(question)"
                >
                    <span class="question-copy">
                        <span v-if="question.category" class="question-category">{{ question.category }}</span>
                        <span class="question-title">
                            <template v-for="(part, index) in highlightSegments(question.question, search)" :key="index">
                                <mark v-if="part.match">{{ part.text }}</mark>
                                <template v-else>{{ part.text }}</template>
                            </template>
                        </span>
                        <span class="question-meta">
                            <Icon icon="mdi:message-text-outline" /> {{ countLabel(question.answer_count, 'answer') }}
                        </span>
                    </span>
                    <Icon icon="mdi:chevron-right" class="question-arrow" />
                </button>
                <div v-if="error" class="questions-state" role="alert">
                    <p>{{ error }}</p>
                    <NButton size="small" @click="list.loadMore()">Retry</NButton>
                </div>
                <div v-else-if="loading" class="questions-state"><NSpin size="small" /></div>
                <div v-else-if="!questions.length" class="questions-state">
                    <Icon :icon="search || category ? 'mdi:magnify-close' : 'mdi:help-circle-outline'" class="questions-state-icon" />
                    <p>
                        {{ search || category
                            ? 'No matching questions. Try another search.'
                            : 'Questions will appear here as the library grows.' }}
                    </p>
                    <NButton v-if="search" size="small" quaternary @click="clearSearch">Clear search</NButton>
                </div>
            </div>
        </div>
        <BibleQuestionDetailModal v-if="!isDesktop" :question="selected" @close="selected = null" />
    </section>
</template>

<style scoped>
.questions-page { height: 100%; min-height: 0; display: flex; flex-direction: column; color: var(--theme-text); }
.questions-page h1, .questions-page p { margin: 0; }
.questions-top { width: 100%; max-width: 800px; margin: 0 auto; padding: 16px 24px 8px; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; }
.category-pills { display: flex; gap: 6px; flex-wrap: wrap; }
.cat-pill { padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; cursor: pointer; background: var(--theme-bg-soft, rgba(255,255,255,0.06)); border: 1px solid var(--theme-border, rgba(255,255,255,0.1)); color: inherit; transition: background 0.15s, border-color 0.15s; white-space: nowrap; }
.cat-pill:hover { background: var(--theme-bg-elevated, rgba(255,255,255,0.1)); }
.cat-pill.active { background: color-mix(in srgb, var(--primary-color, #6f84ff) 20%, transparent); border-color: color-mix(in srgb, var(--primary-color, #6f84ff) 60%, transparent); color: var(--primary-color, #6f84ff); }
.cat-pill:focus-visible { outline: 2px solid var(--primary-color, #6f84ff); outline-offset: 2px; }
.questions-summary { font-size: 13px; color: var(--theme-text-soft); }
.questions-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.questions-list { width: 100%; max-width: 800px; margin: 0 auto; padding: 4px 24px 32px; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; }
.question-card { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 14px 14px 16px; border: 1px solid var(--theme-border); border-radius: 14px; background: var(--theme-bg-soft, rgba(127,127,127,0.04)); color: var(--theme-text); font: inherit; text-align: left; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
.question-card:hover { background: var(--theme-bg-elevated); border-color: color-mix(in srgb, var(--primary-color, #6f84ff) 45%, var(--theme-border)); }
.question-card:focus-visible { outline: 2px solid var(--primary-color, #6f84ff); outline-offset: 2px; }
.question-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.question-category { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--primary-color, #6f84ff); }
.question-title { font-size: 16px; line-height: 1.4; font-weight: 600; overflow-wrap: anywhere; }
.question-title mark { color: var(--primary-color, #6f84ff); background: color-mix(in srgb, var(--primary-color, #6f84ff) 16%, transparent); border-radius: 3px; }
.question-meta { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--theme-text-soft); }
.question-arrow { flex-shrink: 0; width: 18px; height: 18px; color: var(--theme-text-soft); }
.questions-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 40px 0; color: var(--theme-text-soft); text-align: center; }
.questions-state-icon { width: 34px; height: 34px; }
</style>
