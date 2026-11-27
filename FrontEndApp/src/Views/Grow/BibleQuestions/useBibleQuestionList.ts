import { computed, ref, shallowRef } from 'vue';
import type { BibleQuestionPage, BibleQuestionPageArgs, BibleQuestionSummary } from './bibleQuestions';

const PAGE_SIZE = 30;

/**
 * Paged, filterable question list mirroring the mobile
 * BibleQuestionsController: debounced typing, one request in flight, stale
 * responses dropped by generation, failed pages retried at the same offset.
 */
export function createBibleQuestionList(
    loadPage: (args: BibleQuestionPageArgs) => Promise<BibleQuestionPage>,
    { debounceMs = 250 }: { debounceMs?: number } = {}
) {
    const questions = shallowRef<BibleQuestionSummary[]>([]);
    const total = ref(0);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const search = ref('');
    const category = ref('');
    const initialized = ref(false);
    const hasMore = computed(() => !initialized.value || questions.value.length < total.value);
    let generation = 0;
    let inFlight: Promise<void> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    /** Omitted filters keep their current value. */
    function reset(options: { query?: string; category?: string; debounce?: boolean } = {}): Promise<void> {
        if (disposed) return Promise.resolve();
        if (timer) clearTimeout(timer);
        timer = null;
        generation++;
        inFlight = null;
        questions.value = [];
        total.value = 0;
        initialized.value = false;
        error.value = null;
        search.value = options.query?.trim() ?? search.value;
        category.value = options.category ?? category.value;
        if (!options.debounce) {
            loading.value = false;
            return loadMore();
        }
        loading.value = true;
        timer = setTimeout(() => {
            timer = null;
            loading.value = false;
            void loadMore();
        }, debounceMs);
        return Promise.resolve();
    }

    function loadMore(): Promise<void> {
        if (disposed || timer || !hasMore.value) return Promise.resolve();
        if (inFlight) return inFlight;
        const current = generation;
        loading.value = true;
        error.value = null;
        const request = loadPage({
            search: search.value,
            category: category.value,
            offset: questions.value.length,
            limit: PAGE_SIZE,
        })
            .then(page => {
                if (disposed || current !== generation) return;
                if (!page.questions.length && questions.value.length < page.total) {
                    throw new Error('The next questions page is empty.');
                }
                questions.value = [...questions.value, ...page.questions];
                total.value = page.total;
                initialized.value = true;
            })
            .catch(() => {
                if (!disposed && current === generation) error.value = 'Could not load questions. Please try again.';
            })
            .finally(() => {
                if (disposed || current !== generation) return;
                inFlight = null;
                loading.value = false;
            });
        inFlight = request;
        return request;
    }

    function dispose() {
        disposed = true;
        generation++;
        if (timer) clearTimeout(timer);
        timer = null;
    }

    return { questions, total, loading, error, search, category, hasMore, reset, loadMore, dispose };
}
