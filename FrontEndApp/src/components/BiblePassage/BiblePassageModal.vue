<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NModal, NSpin } from 'naive-ui';
import { stripVerseHtml } from '../../util/helper';
import type { PassageSelection, PassageVerse } from './biblePassagePreview';

const props = defineProps<{
    selection: PassageSelection | null;
    verses: PassageVerse[];
    state: 'loading' | 'ready' | 'empty' | 'error' | 'missing-version';
}>();
const emit = defineEmits<{ (event: 'close'): void; (event: 'retry'): void }>();
const readerStyle = computed(() => ({
    fontSize: `${props.selection?.fontSize ?? 15}px`,
    fontFamily: props.selection?.fontFamily || 'var(--bible-font-family, Georgia, serif)',
}));
</script>

<template>
    <NModal
        :show="selection !== null"
        preset="card"
        :title="selection?.reference.label ?? 'Bible passage'"
        class="bible-passage-modal"
        style="width: min(680px, 94vw); max-height: 85vh"
        content-style="overflow-y: auto; min-height: 0; overscroll-behavior: contain"
        :bordered="false"
        @update:show="value => { if (!value) emit('close'); }"
    >
        <p class="passage-translation">{{ selection?.versionLabel || 'Selected Bible' }}</p>
        <div v-if="state === 'loading'" class="passage-state" role="status">
            <NSpin size="small" /><span>Loading passage...</span>
        </div>
        <div v-else-if="state === 'missing-version'" class="passage-state" role="status">
            Select a Bible translation in the reader, then open this passage again.
        </div>
        <div v-else-if="state === 'error' || state === 'empty'" class="passage-state" :role="state === 'error' ? 'alert' : 'status'">
            <p>{{ state === 'error' ? 'Could not load this passage. Please try again.' : 'This passage is unavailable in the selected translation.' }}</p>
            <NButton size="small" @click="emit('retry')">Retry</NButton>
        </div>
        <div v-else class="passage-verses" :style="readerStyle">
            <p v-for="verse in verses" :key="`${verse.chapter}:${verse.verse}`" class="passage-verse">
                <sup>{{ selection?.reference.chapter !== selection?.reference.endChapter ? `${verse.chapter}:` : '' }}{{ verse.verse }}</sup>
                {{ stripVerseHtml(verse.text) }}
            </p>
        </div>
        <template #footer><NButton @click="emit('close')">Close passage</NButton></template>
    </NModal>
</template>

<style scoped>
.passage-translation { margin: 0 0 18px; color: var(--theme-text-soft); font-size: 13px; line-height: 1.5; }
.passage-state { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 28px 8px; color: var(--theme-text-soft); text-align: center; }
.passage-state p { margin: 0; }
.passage-verses { line-height: 1.75; overflow-wrap: anywhere; user-select: text; }
.passage-verse { margin: 0 0 14px; }
.passage-verse sup { margin-right: 6px; color: var(--primary-color); font: 600 11px Arial, sans-serif; }
</style>
