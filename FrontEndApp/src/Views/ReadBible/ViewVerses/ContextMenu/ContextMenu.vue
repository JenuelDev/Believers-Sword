<script setup lang="ts">
import { NIcon, NPopover, useMessage } from 'naive-ui';
import { BookmarkFilled } from '@vicons/carbon';
import { Icon } from '@iconify/vue';
import { onClickOutside } from '@vueuse/core';
import { ref, computed, nextTick, watch, type PropType } from 'vue';
import { ContextMenuOptions, ClearHighlightOption } from './ContextMenuOptions';
import { useBookmarkStore } from '../../../../store/bookmark';
import { useBibleStore } from '../../../../store/BibleStore';
import { debouncedRunSync } from '../../../../util/Sync/sync';
import { stripVerseHtml } from '../../../../util/helper';
import { colors } from '../../../../util/highlighter';

const bibleStore = useBibleStore();
const message = useMessage();
const contextMenuRef = ref(null);

// Shape of the verse reference `data` (the `data` prop below, sourced from
// bibleStore.renderVerses — see clickContextMenu() in ViewVerses.vue) that gets
// forwarded to CreateClipNote.vue's toggleClipNoteModal() to seed a new note.
// Exported so ViewVerses.vue's @create-clip-note handler can share the same
// type rather than redeclaring it.
export interface ClipNoteVerseRef {
    book_number: number;
    chapter: number;
    verse: number;
}

const emits = defineEmits<{
    close: [];
    'create-clip-note': [data: ClipNoteVerseRef];
}>();
const bookmarkStore = useBookmarkStore();
const showColorPicker = ref(false);

const props = defineProps({
    showContextMenu: {
        type: Boolean,
        default: false,
    },
    x: {
        type: Number,
        default: 0,
    },
    y: {
        type: Number,
        default: 0,
    },
    data: {
        type: Object,
        default: {},
    },
    selectedVersesData: {
        type: Array as PropType<any[]>,
        default: () => [],
    },
});

// Clamped open position. The parent passes the raw cursor x/y; a tall menu
// opened near the right/bottom edge would otherwise spill off-screen, so once
// the menu is rendered we measure it and pull it back inside the viewport.
const posX = ref(0);
const posY = ref(0);

watch(
    () => [props.showContextMenu, props.x, props.y] as const,
    async ([show, x, y]) => {
        if (!show) return;
        posX.value = x;
        posY.value = y;
        await nextTick();
        const el = contextMenuRef.value as HTMLElement | null;
        if (!el) return;
        const margin = 10;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const { offsetWidth: w, offsetHeight: h } = el;
        if (x + w + margin > vw) posX.value = Math.max(margin, vw - w - margin);
        if (y + h + margin > vh) posY.value = Math.max(margin, vh - h - margin);
    },
    { immediate: true },
);

// Whether every target verse is already bookmarked — flips the bookmark row
// to an "Unbookmark" (remove) action.
const isBookmarked = computed(() => {
    const verses =
        props.selectedVersesData.length > 0 ? props.selectedVersesData : [props.data];
    if (verses.length === 0) return false;
    return verses.every(
        (v) =>
            v &&
            bookmarkStore.isBookmarkExists(`${v.book_number}_${v.chapter}_${v.verse}`),
    );
});

// Whether the target verse(s) currently carry a highlight — gates the
// "Clear Highlight" row so it only appears when there's something to clear.
const hasHighlight = computed(() => {
    const verses =
        props.selectedVersesData.length > 0 ? props.selectedVersesData : [props.data];
    const map = bibleStore.chapterHighlights as any;
    return verses.some((v) => {
        if (!v) return false;
        const key = `${v.book_number}_${v.chapter}_${v.verse}`;
        return !!(map?.[key] || (v.key && map?.[v.key]));
    });
});

// Write [text] to the clipboard, preferring Electron's native clipboard. The
// renderer's navigator.clipboard is unreliable on desktop (it needs a secure
// context/focus and silently rejects — the cause of "Could not copy"), so route
// through the IPC bridge first and only fall back to the web API.
async function writeToClipboard(text: string): Promise<void> {
    const bridge = window.browserWindow as any;
    if (bridge?.writeClipboard) {
        await bridge.writeClipboard(text);
        return;
    }
    await navigator.clipboard.writeText(text);
}

// Copy the selected verse(s) as `"text" Book chapter:verse` to the clipboard.
// With no multi-selection this copies props.data — the verse the context menu
// was opened on.
async function copyVerses() {
    const book = bibleStore.selectedBook.title;
    const verses =
        props.selectedVersesData.length > 0 ? props.selectedVersesData : [props.data];
    const sorted = [...verses].sort((a, b) => (a.verse ?? 0) - (b.verse ?? 0));
    const text = sorted
        .map((v) => `"${stripVerseHtml(v.text ?? '')}" ${book} ${v.chapter}:${v.verse}`)
        .join('\n');
    try {
        await writeToClipboard(text);
        message.success(verses.length > 1 ? 'Verses copied' : 'Verse copied');
    } catch {
        message.error('Could not copy. Please try again.');
    }
}

async function highlightVerse(color: string) {
    const verses = props.selectedVersesData.length > 0 ? props.selectedVersesData : [props.data];
    for (const verseData of verses) {
        const { book_number, chapter, verse } = verseData;
        const key = `${book_number}_${chapter}_${verse}`;
        await window.browserWindow.saveHighlight(
            JSON.stringify({ key, book_number, chapter, verse, content: color }),
        );
    }
    await bibleStore.getChapterHighlights();
    await bibleStore.getHighlights();
    debouncedRunSync();
    showColorPicker.value = false;
    emits('close');
}

async function clickContextMenu(key: string) {
    if (key == 'add-to-bookmark') {
        const verses = props.selectedVersesData.length > 0 ? props.selectedVersesData : [props.data];
        if (isBookmarked.value) {
            for (const verseData of verses) {
                await window.browserWindow.deleteBookmark(JSON.stringify(verseData));
            }
            await bookmarkStore.getBookmarks();
        } else {
            for (const verseData of verses) {
                bookmarkStore.bookmarks = await window.browserWindow.saveBookMark(
                    JSON.stringify(verseData),
                );
            }
        }
        debouncedRunSync();
    } else if (key == 'copy-verse') {
        await copyVerses();
    } else if (key == 'create-clip-note') {
        // `data` is declared as a loose `Object` prop (see defineProps below —
        // it also stands in for bookmark/highlight payloads elsewhere in this
        // file), but a context-menu verse ref always carries these three
        // fields, exactly as relied on directly at props.data.book_number
        // etc. a few lines down for 'compare-verse'.
        emits('create-clip-note', props.data as ClipNoteVerseRef);
    } else if (key == 'highlight-verse') {
        showColorPicker.value = !showColorPicker.value;
        return; // Don't close menu
    } else if (key == 'compare-verse') {
        (window as any).browserWindow.openCompareVerseWindow({
            book_number: props.data.book_number,
            chapter: props.data.chapter,
            verse: props.data.verse,
            book_name: bibleStore.selectedBook.title,
        });
    } else if (key == 'clear-highlight') {
        const verses = props.selectedVersesData.length > 0 ? props.selectedVersesData : [props.data];
        for (const verseData of verses) {
            const verseKey = `${verseData.book_number}_${verseData.chapter}_${verseData.verse}`;
            await bibleStore.removeHighlightInDb(verseKey);
            await bibleStore.removeHighlightInDb(verseData.key);
        }
    }
    showColorPicker.value = false;
    emits('close');
}
onClickOutside(contextMenuRef, (event) => {
    showColorPicker.value = false;
    emits('close');
});
</script>
<template>
    <NPopover
        :show="showContextMenu"
        :x="posX"
        :y="posY"
        placement="bottom-start"
        trigger="manual"
        content-style="padding: 0 !important;"
        class="!p-0 !rounded-md"
    >
        <div
            ref="contextMenuRef"
            class="cm-root flex flex-col select-none"
        >
            <!-- ── Verse Actions ──────────────────────────────────── -->
            <div class="cm-section-label">{{ $t('Verse Actions') }}</div>
            <template v-for="option in ContextMenuOptions" :key="option.key">
                <div class="cm-action" @click="clickContextMenu(option.key)">
                    <div
                        class="cm-action__icon"
                        :style="{ color: option.color, background: `${option.color}1f` }"
                    >
                        <NIcon
                            size="17"
                            :component="option.key === 'add-to-bookmark' && isBookmarked ? BookmarkFilled : option.icon"
                        />
                    </div>
                    <span class="cm-action__label">
                        {{ option.key === 'add-to-bookmark' && isBookmarked ? 'Unbookmark' : $t(option.label) }}
                    </span>
                    <Icon icon="lucide:chevron-right" class="cm-action__chev" />
                </div>
                <!-- Color picker drops in directly under Highlight Verse. -->
                <div
                    v-if="showColorPicker && option.key === 'highlight-verse'"
                    class="cm-colors"
                >
                    <button
                        v-for="c in colors"
                        :key="c.color"
                        :style="`background: ${c.color}`"
                        class="h-24px w-24px rounded-full cursor-pointer border-2 border-transparent hover:border-white transition-all hover:scale-110"
                        :title="c.name"
                        @click="highlightVerse(c.color)"
                    ></button>
                </div>
            </template>

            <!-- ── Clear Highlight (destructive) ──────────────────── -->
            <template v-if="hasHighlight">
            <div class="cm-divider"></div>
            <div
                class="cm-action cm-action--danger"
                @click="clickContextMenu(ClearHighlightOption.key)"
            >
                <div
                    class="cm-action__icon"
                    :style="{ color: ClearHighlightOption.color, background: `${ClearHighlightOption.color}1f` }"
                >
                    <NIcon size="17" :component="ClearHighlightOption.icon" />
                </div>
                <div class="flex flex-col leading-tight min-w-0 flex-1">
                    <span class="cm-action__label">{{ $t(ClearHighlightOption.label) }}</span>
                    <span v-if="ClearHighlightOption.description" class="text-size-11px opacity-55">
                        {{ ClearHighlightOption.description }}
                    </span>
                </div>
                <Icon icon="lucide:chevron-right" class="cm-action__chev" />
            </div>
            </template>
        </div>
    </NPopover>
</template>

<style scoped>

/* ── Verse context menu layout ────────────────────────────────────────── */
.cm-root {
    width: 248px;
    padding: 8px;
    gap: 2px;
    /* Full height normally; only scrolls if the window is too short to fit. */
    max-height: calc(100vh - 20px);
    overflow-y: auto;
}

/* Small uppercase section heading ("Verse Actions"). */
.cm-section-label {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px 5px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.5;
}

/* Primary action row — tinted icon tile, label, trailing chevron. */
.cm-action {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 8px 10px;
    border-radius: 11px;
    cursor: pointer;
    transition: background 0.13s ease;
}
.cm-action:hover {
    background: color-mix(in srgb, var(--primary-color) 14%, transparent);
}
.cm-action__icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 9px;
}
.cm-action__label {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
}
.cm-action__chev {
    flex-shrink: 0;
    font-size: 15px;
    opacity: 0.35;
}
.cm-action--danger:hover {
    background: rgba(239, 68, 68, 0.12);
}
.cm-action--danger .cm-action__label {
    color: #ef4444;
}

.cm-divider {
    height: 1px;
    margin: 6px 4px;
    background: color-mix(in srgb, currentColor 14%, transparent);
}

.cm-colors {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 10px 10px;
}

</style>
