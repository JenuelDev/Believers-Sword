<script setup lang="ts">
import { computed, ref } from 'vue';
import { NButton, NIcon } from 'naive-ui';
import { Checkmark, Copy } from '@vicons/carbon';
import { useI18n } from 'vue-i18n';
import { useBibleStore } from '../../../store/BibleStore';
import { useModuleStore } from '../../../store/moduleStore';
import { bibleBooks } from '../../../util/books';
import { stripVerseHtml } from '../../../util/helper';
import type { CrossReference } from '../../../util/crossReferences';

const props = defineProps<{
    reference: CrossReference;
    group?: { count: number; color: string };
}>();
const bibleStore = useBibleStore();
const moduleStore = useModuleStore();
const { t } = useI18n();
const copied = ref(false);
const copyError = ref(false);
const bookTitle = computed(() => {
    const book = bibleBooks.find(book => book.book_number === props.reference.to_book);
    return book ? t(book.title) : String(props.reference.to_book);
});
const title = computed(() => {
    const reference = props.reference;
    const end = reference.to_verse_end ?? reference.to_verse_start;
    const verses = end === reference.to_verse_start ? String(end) : `${reference.to_verse_start}-${end}`;
    return `${bookTitle.value} ${reference.to_chapter}:${verses}`;
});

function versionTitle(version: string) {
    return moduleStore.bibleLists.find(item => item.file_name === version)?.title ?? version.replace(/\.SQLite3$/i, '');
}

async function copy() {
    try {
        await window.browserWindow.writeClipboard([title.value, ...props.reference.texts.map(
            item => `${props.reference.texts.length > 1 ? versionTitle(item.version) + ': ' : ''}${stripVerseHtml(item.text)}`,
        )].join('\n'));
        copied.value = true;
        copyError.value = false;
    } catch {
        copyError.value = true;
    }
}
</script>

<template>
    <div class="cross-reference-row">
        <div v-if="group" class="cross-reference-book">
            <span class="cross-reference-accent" :style="{ backgroundColor: group.color }"></span>
            <span>{{ bookTitle }}</span><span class="opacity-70">{{ group.count }}</span>
        </div>
        <article class="cross-reference-card">
            <header class="cross-reference-card-header">
                <button
                    class="cross-reference-title"
                    :aria-label="`Go to ${title}`"
                    @click="bibleStore.selectVerse(reference.to_book, reference.to_chapter, reference.to_verse_start)"
                >{{ title }}</button>
                <NButton
                    quaternary size="tiny" :title="copied ? 'Copied' : 'Copy verse'" :aria-label="`Copy ${title}`"
                    @click="copy"
                ><template #icon><NIcon><Checkmark v-if="copied" /><Copy v-else /></NIcon></template></NButton>
            </header>
            <div v-for="item in reference.texts" :key="item.version" class="cross-reference-translation">
                <div v-if="bibleStore.selectedBibleVersions.length > 1" class="cross-reference-version">{{ versionTitle(item.version) }}</div>
                <p class="cross-reference-text">{{ stripVerseHtml(item.text) }}</p>
            </div>
            <p v-if="!reference.texts.length" class="cross-reference-unavailable">
                Verse text is unavailable in the selected translations.
            </p>
            <span v-if="copyError" class="text-xs" role="status">Could not copy. Please try again.</span>
        </article>
    </div>
</template>

<style scoped>
.cross-reference-row { padding: 0 8px 10px 0; }
.cross-reference-book { display: flex; align-items: center; gap: 10px; padding: 14px 0 8px; font-size: 13px; opacity: .85; }
.cross-reference-accent { width: 18px; height: 4px; border-radius: 2px; }
.cross-reference-card { padding: 10px 12px; border-radius: 8px; background: rgba(128, 128, 128, .07); }
.cross-reference-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.cross-reference-title { padding: 0; font-size: 14px; font-weight: 600; color: inherit; background: transparent; border: 0; text-align: left; cursor: pointer; }
.cross-reference-title:hover { color: var(--primary-color); }
.cross-reference-title:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 3px; }
.cross-reference-text { margin: 3px 0 0; font-family: var(--bible-font-family, Georgia, 'Times New Roman', serif); font-size: 17px; line-height: 1.55; opacity: .85; overflow-wrap: anywhere; }
.cross-reference-version { margin-top: 7px; font-size: 10px; opacity: .6; }
.cross-reference-unavailable { margin: 5px 0 0; font-size: 12px; opacity: .6; }
</style>
