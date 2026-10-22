import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { CrossReference, CrossReferencePage, CrossReferenceRequest } from '../util/crossReferences';

export function createCrossReferenceState(fetchPage: (args: CrossReferenceRequest) => Promise<CrossReferencePage>) {
    const references = ref<CrossReference[]>([]);
    const groups = ref<CrossReferencePage['groups']>([]);
    const total = ref(0);
    const isLoading = ref(false);
    const error = ref('');
    const currentKey = ref('');
    const initialized = ref(false);
    const hasMore = computed(() => !initialized.value || references.value.length < total.value);
    let source: CrossReferenceRequest | null = null;
    let generation = 0;
    let activeRequest: Promise<void> | null = null;

    function clear() {
        generation++;
        source = null;
        activeRequest = null;
        references.value = [];
        groups.value = [];
        total.value = 0;
        initialized.value = false;
        isLoading.value = false;
        error.value = '';
        currentKey.value = '';
    }

    function loadMore(): Promise<void> {
        if (activeRequest) return activeRequest;
        if (!source || !hasMore.value) return Promise.resolve();
        const requestedGeneration = generation;
        const args = { ...source, offset: references.value.length, limit: 24 };
        isLoading.value = true;
        error.value = '';
        const request = fetchPage(args).then(page => {
            if (generation !== requestedGeneration) return;
            if (page.references.length === 0 && args.offset < page.total) {
                throw new Error('The next page could not be loaded.');
            }
            references.value.push(...page.references);
            groups.value = page.groups;
            total.value = page.total;
            initialized.value = true;
        }).catch(cause => {
            if (generation === requestedGeneration) {
                error.value = cause instanceof Error ? cause.message : 'Could not load cross references.';
            }
        }).finally(() => {
            if (generation === requestedGeneration) {
                isLoading.value = false;
                activeRequest = null;
            }
        });
        activeRequest = request;
        return request;
    }

    function fetchReferences(book_number: number, chapter: number, verse: number, bible_versions: string[]) {
        const key = JSON.stringify([book_number, chapter, verse, bible_versions]);
        if (currentKey.value === key) return activeRequest ?? Promise.resolve();
        clear();
        currentKey.value = key;
        source = { book_number, chapter, verse, bible_versions: [...bible_versions] };
        return loadMore();
    }

    return { references, groups, total, isLoading, error, currentKey, hasMore, fetchReferences, loadMore, clear };
}

export const useCrossReferencesStore = defineStore('crossReferences', () =>
    createCrossReferenceState(args => window.browserWindow.getCrossReferencePage(args)),
);
