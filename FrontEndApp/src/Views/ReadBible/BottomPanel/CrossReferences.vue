<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { NButton, NEmpty, NSpin, NVirtualList } from 'naive-ui';
import { useCrossReferencesStore } from '../../../store/crossReferencesStore';
import { useBibleStore } from '../../../store/BibleStore';
import { bibleBooks } from '../../../util/books';
import CrossReferenceCard from './CrossReferenceCard.vue';

const crossRefStore = useCrossReferencesStore();
const bibleStore = useBibleStore();
const virtualList = ref<InstanceType<typeof NVirtualList> | null>(null);
const colors = ['#c44ab0', '#71a93d', '#26a9ad', '#cc9651', '#7a85d6'];
const items = computed(() => crossRefStore.references.map((reference, index, references) => ({
    key: reference.id,
    reference,
    group: index === 0 || references[index - 1].to_book !== reference.to_book
        ? {
            count: crossRefStore.groups.find(group => group.book_number === reference.to_book)?.count ?? 0,
            color: colors[crossRefStore.groups.findIndex(group => group.book_number === reference.to_book) % colors.length],
        }
        : undefined,
})));
const sourceBook = computed(() => bibleBooks.find(book => book.book_number === bibleStore.selectedBookNumber));

function checkForNextPage() {
    if (crossRefStore.isLoading || crossRefStore.error || !crossRefStore.hasMore) return;
    const container = virtualList.value?.getScrollContainer();
    // Hidden tabs have no viewport and should not prefetch additional pages.
    if (container && container.clientHeight > 0
        && container.scrollHeight - container.scrollTop - container.clientHeight < 240) {
        void crossRefStore.loadMore();
    }
}

watch(
    () => [bibleStore.selectedBookNumber, bibleStore.selectedChapter, bibleStore.selectedVerse,
        ...bibleStore.selectedBibleVersions],
    async () => {
        const { selectedBookNumber, selectedChapter, selectedVerse, selectedBibleVersions } = bibleStore;
        if (!selectedBookNumber || !selectedChapter || !selectedVerse) {
            crossRefStore.clear();
            return;
        }
        const loading = crossRefStore.fetchReferences(
            selectedBookNumber, selectedChapter, selectedVerse, [...selectedBibleVersions],
        );
        virtualList.value?.scrollTo({ top: 0, behavior: 'auto' });
        await loading;
        await nextTick();
        checkForNextPage();
    },
    { immediate: true },
);

watch(() => crossRefStore.references.length, async () => {
    await nextTick();
    checkForNextPage();
});

onBeforeUnmount(() => crossRefStore.clear());
</script>

<template>
    <section class="cross-reference-panel h-full flex flex-col p-2 gap-2 min-h-0" aria-label="Cross references">
        <div class="text-xs text-gray-500 dark:text-gray-400 shrink-0 flex items-center gap-2">
            <span>
                Cross References for
                <strong class="text-[var(--primary-color)]">
                    {{ sourceBook ? $t(sourceBook.title) : bibleStore.selectedBookNumber }}
                    {{ bibleStore.selectedChapter }}:{{ bibleStore.selectedVerse }}
                </strong>
            </span>
            <span v-if="crossRefStore.total" class="opacity-70">({{ crossRefStore.total }})</span>
        </div>

        <NVirtualList
            v-if="items.length"
            ref="virtualList"
            class="cross-reference-list flex-1 min-h-0"
            :items="items"
            :item-size="180"
            item-resizable
            :padding-bottom="12"
            @scroll="checkForNextPage"
            @resize="checkForNextPage"
        >
            <template #default="{ item }">
                <CrossReferenceCard :reference="item.reference" :group="item.group" />
            </template>
        </NVirtualList>

        <div v-if="crossRefStore.isLoading" class="cross-reference-status" role="status">
            <NSpin size="small" /><span>Loading references...</span>
        </div>
        <div v-else-if="crossRefStore.error" class="cross-reference-status" role="alert">
            <span>{{ crossRefStore.error }}</span>
            <NButton size="tiny" @click="crossRefStore.loadMore()">Retry</NButton>
        </div>
        <NEmpty
            v-else-if="!items.length"
            description="No cross references found"
            size="small"
            class="py-4"
        />
    </section>
</template>

<style scoped>
.cross-reference-list { overflow-anchor: none; }
.cross-reference-list :deep(*) { scroll-behavior: auto; }
.cross-reference-status {
    display: flex;
    flex-shrink: 0;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 8px;
    font-size: 12px;
}
</style>
