<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NSpin } from 'naive-ui';
import { Icon } from '@iconify/vue';
import { answerLabel, countLabel, referenceHost, type BibleAnswer, type BibleQuestionSummary } from './bibleQuestions';
import { answerHtml, isSafeLink } from './answerHtml';

/** Meta row and ordered answers for one question; shared by the web dialog and the desktop window. */
const props = defineProps<{ question: BibleQuestionSummary }>();

const answers = ref<BibleAnswer[]>([]);
const loading = ref(false);
const failed = ref(false);
let loadToken = 0;

async function load() {
    const question = props.question;
    const token = ++loadToken;
    answers.value = [];
    failed.value = false;
    loading.value = true;
    try {
        const result = await window.browserWindow.getBibleQuestionAnswers(question.id);
        if (token === loadToken) answers.value = result;
    } catch {
        if (token === loadToken) failed.value = true;
    } finally {
        if (token === loadToken) loading.value = false;
    }
}

watch(() => props.question.id, () => void load(), { immediate: true });

const rendered = computed(() => answers.value.map(answer => ({ ...answer, html: answerHtml(answer) })));

function openLink(url: string) {
    if (isSafeLink(url)) void window.browserWindow.openExternal(url.trim());
}

/** Links inside answer bodies open in the system browser, never in the app window. */
function onBodyClick(event: MouseEvent) {
    const link = (event.target as HTMLElement | null)?.closest('a');
    if (!link) return;
    event.preventDefault();
    openLink(link.getAttribute('href') ?? '');
}
</script>

<template>
    <div class="question-detail">
        <div class="detail-meta">
            <span v-if="question.category" class="detail-category">{{ question.category }}</span>
            <span class="detail-count">
                <Icon icon="mdi:message-text-outline" /> {{ countLabel(question.answer_count, 'answer') }}
            </span>
        </div>
        <div v-if="loading" class="detail-state"><NSpin size="small" /></div>
        <div v-else-if="failed" class="detail-state" role="alert">
            <p>Could not load answers. Please try again.</p>
            <NButton size="small" @click="load">Retry</NButton>
        </div>
        <p v-else-if="!answers.length" class="detail-state">Answers are not available yet.</p>
        <article v-for="(answer, index) in rendered" :key="answer.id" class="detail-answer">
            <h3 class="answer-label">{{ answerLabel(index + 1, rendered.length) }}</h3>
            <div v-if="answer.html !== null" class="answer-body" @click="onBodyClick" v-html="answer.html" />
            <p v-else class="answer-body answer-plain">{{ answer.answer }}</p>
            <div v-if="answer.references.length" class="answer-references">
                <p class="references-title">References</p>
                <button
                    v-for="reference in answer.references"
                    :key="`${reference.url} ${reference.title}`"
                    type="button"
                    class="reference-row"
                    :title="reference.url"
                    @click="openLink(reference.url)"
                >
                    <Icon icon="mdi:link-variant" class="reference-icon" />
                    <span class="reference-copy">
                        <span class="reference-title">{{ reference.title }}</span>
                        <span class="reference-host">{{ referenceHost(reference.url) }}</span>
                    </span>
                    <Icon icon="mdi:open-in-new" class="reference-open" />
                </button>
            </div>
        </article>
    </div>
</template>

<style scoped>
.question-detail { color: var(--theme-text); }
.question-detail p { margin: 0; }
.detail-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--theme-border); }
.detail-category { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--primary-color, #6f84ff); }
.detail-count { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--theme-text-soft); }
.detail-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 0; color: var(--theme-text-soft); text-align: center; }
.detail-answer { padding: 24px 0; }
.detail-answer + .detail-answer { border-top: 1px solid var(--theme-border); }
.answer-label { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; padding: 0; font-size: 13px; line-height: 20px; font-weight: 600; color: var(--primary-color, #6f84ff); }
.answer-label::before { content: ''; width: 3px; height: 14px; border-radius: 2px; background: currentColor; }
.answer-body { font-size: 15px; line-height: 1.75; overflow-wrap: anywhere; }
.answer-plain { white-space: pre-wrap; }
.answer-body :deep(p) { margin: 0 0 12px; }
/* Keep answer headings close to body size so they never outweigh the question. */
.answer-body :deep(h1), .answer-body :deep(h2) { margin: 16px 0 8px; padding: 0; font-size: 1.15em; line-height: 1.4; font-weight: 700; }
.answer-body :deep(h3), .answer-body :deep(h4), .answer-body :deep(h5), .answer-body :deep(h6) { margin: 14px 0 6px; padding: 0; font-size: 1.05em; line-height: 1.4; font-weight: 700; }
.answer-body :deep(:first-child) { margin-top: 0; }
.answer-body :deep(ul), .answer-body :deep(ol) { margin: 0 0 12px; padding-left: 22px; }
.answer-body :deep(blockquote) { margin: 0 0 12px; padding-left: 12px; border-left: 3px solid var(--theme-border); color: var(--theme-text-soft); }
.answer-body :deep(a) { color: var(--primary-color, #6f84ff); cursor: pointer; }
.answer-references { margin-top: 18px; border: 1px solid var(--theme-border); border-radius: 12px; background: var(--theme-bg-soft, rgba(127, 127, 127, 0.06)); overflow: hidden; }
.references-title { padding: 12px 14px 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; color: var(--theme-text-soft); }
.reference-row { display: grid; grid-template-columns: 16px minmax(0, 1fr) 16px; align-items: start; gap: 12px; width: 100%; padding: 10px 14px; border: 0; background: transparent; color: var(--theme-text); font: inherit; text-align: left; cursor: pointer; }
.reference-row:hover { background: var(--theme-bg-elevated); }
.reference-row:focus-visible { outline: 2px solid var(--primary-color, #6f84ff); outline-offset: -2px; }
.reference-icon { width: 16px; height: 16px; margin-top: 2px; color: var(--primary-color, #6f84ff); }
.reference-open { width: 15px; height: 15px; margin-top: 3px; color: var(--theme-text-soft); }
.reference-copy { display: flex; flex-direction: column; min-width: 0; }
.reference-title { font-size: 14px; line-height: 20px; font-weight: 500; overflow-wrap: anywhere; }
.reference-host { font-size: 12px; line-height: 18px; color: var(--theme-text-soft); }
</style>
