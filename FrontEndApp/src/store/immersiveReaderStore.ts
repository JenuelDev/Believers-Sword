import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { getBibleService } from '../services/BibleService';
import { useBibleStore } from './BibleStore';
import { useSettingStore } from './settingStore';
import { bibleBooks, bookTitleByNumber, type BookInfo } from '../util/books';
import { stripVerseHtml } from '../util/helper';
import SESSION from '../util/session';

export type ImmersiveChapterDirection = 'next' | 'prev';

export interface ImmersiveVerse {
    verse: number;
    text: string;
}

const DEFAULT_FONT_SIZE = 18;
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 36;
const FONT_SIZE_KEY = 'immersive-reader-font-size';

function chapterCount(book: BookInfo, showDeuterocanonical: boolean): number {
    if (showDeuterocanonical && book.deuterocanonical_chapter_count) {
        return book.deuterocanonical_chapter_count;
    }
    return book.chapter_count;
}

function normalizeVerses(result: any): ImmersiveVerse[] {
    if (!Array.isArray(result)) return [];

    return result
        .filter((row) => row && Number.isFinite(Number(row.verse)))
        .map((row) => ({
            verse: Number(row.verse),
            text: stripVerseHtml(String(row.version?.[0]?.text ?? ''), true),
        }))
        .filter((row) => row.text.length > 0);
}

export const useImmersiveReaderStore = defineStore('immersiveReader', () => {
    const bibleStore = useBibleStore();
    const settingStore = useSettingStore();

    const isOpen = ref(false);
    const isLoading = ref(false);
    const loadError = ref(false);
    const verses = ref<ImmersiveVerse[]>([]);
    const activeBookNumber = ref(0);
    const activeChapter = ref(1);
    const selectedVersion = ref('');
    const savedFontSize = Number(SESSION.get(FONT_SIZE_KEY));
    const fontSize = ref(Number.isFinite(savedFontSize) && savedFontSize >= MIN_FONT_SIZE
        ? Math.min(MAX_FONT_SIZE, savedFontSize) : DEFAULT_FONT_SIZE);
    watch(fontSize, value => SESSION.set(FONT_SIZE_KEY, value));

    const bookTitle = computed(() => {
        return bookTitleByNumber(activeBookNumber.value) ?? '';
    });

    let requestId = 0;
    let windowModeRequest = Promise.resolve();

    function requestImmersiveWindowMode(enabled: boolean) {
        if (
            typeof window === 'undefined' ||
            !window.isElectron ||
            typeof window.browserWindow?.setImmersiveWindowMode !== 'function'
        ) {
            return;
        }

        // Keep rapid open/close/re-open transitions ordered without making
        // the reading surface depend on native window IPC succeeding.
        windowModeRequest = windowModeRequest
            .then(() => window.browserWindow.setImmersiveWindowMode(enabled))
            .catch(() => undefined);
    }

    function visibleBooks(): BookInfo[] {
        return bibleBooks.filter(
            (book) => settingStore.showDeuterocanonical || !book.deuterocanonical
                || book.book_number === activeBookNumber.value,
        );
    }

    async function loadChapter(bookNumber: number, chapter: number, version: string) {
        if (!version) return;
        const currentRequest = ++requestId;
        activeBookNumber.value = bookNumber;
        activeChapter.value = chapter;
        verses.value = [];
        loadError.value = false;
        isLoading.value = true;

        try {
            const result = await getBibleService().getVerses({
                bible_versions: [version],
                book_number: bookNumber,
                selected_chapter: chapter,
            });

            // A slower response from an earlier chapter must never replace the
            // chapter most recently requested by the reader.
            if (currentRequest !== requestId) return;
            verses.value = normalizeVerses(result);
        } catch {
            if (currentRequest !== requestId) return;
            verses.value = [];
            loadError.value = true;
        } finally {
            if (currentRequest === requestId) isLoading.value = false;
        }
    }

    async function open() {
        // The immersive window is an Electron-only reading surface. The web
        // bridge can expose a Bible API stub, but it must not open this mode.
        if (typeof window === 'undefined' || !window.isElectron) return;

        requestImmersiveWindowMode(true);

        const version = bibleStore.selectedBibleVersions[0] ?? '';
        const bookNumber = bibleStore.selectedBookNumber;
        const chapter = bibleStore.selectedChapter;

        selectedVersion.value = version;
        isOpen.value = true;

        // Do not send an empty version list to the Electron Bible service. Keep
        // the overlay open with its normal quiet error state instead.
        if (!version) {
            requestId++;
            activeBookNumber.value = bookNumber;
            activeChapter.value = chapter;
            verses.value = [];
            isLoading.value = false;
            loadError.value = true;
            return;
        }

        await loadChapter(bookNumber, chapter, version);
    }

    function close() {
        requestImmersiveWindowMode(false);
        requestId++;
        isOpen.value = false;
        isLoading.value = false;
        loadError.value = false;
        verses.value = [];
    }

    async function navigateChapter(direction: ImmersiveChapterDirection) {
        if (!isOpen.value || isLoading.value || !selectedVersion.value) return;
        const books = visibleBooks();
        const currentIndex = books.findIndex(
            (book) => book.book_number === activeBookNumber.value,
        );
        if (currentIndex < 0) return;

        const currentBook = books[currentIndex];
        const currentLimit = chapterCount(currentBook, settingStore.showDeuterocanonical);
        let nextBookNumber = activeBookNumber.value;
        let nextChapter = activeChapter.value;

        if (direction === 'next') {
            if (activeChapter.value < currentLimit) {
                nextChapter = activeChapter.value + 1;
            } else if (currentIndex < books.length - 1) {
                nextBookNumber = books[currentIndex + 1].book_number;
                nextChapter = 1;
            } else {
                return;
            }
        } else if (activeChapter.value > 1) {
            nextChapter = activeChapter.value - 1;
        } else if (currentIndex > 0) {
            const previousBook = books[currentIndex - 1];
            nextBookNumber = previousBook.book_number;
            nextChapter = chapterCount(previousBook, settingStore.showDeuterocanonical);
        } else {
            return;
        }

        await loadChapter(nextBookNumber, nextChapter, selectedVersion.value);
    }

    function adjustFontSize(delta: number) {
        const numericDelta = Number(delta);
        if (!Number.isFinite(numericDelta)) return;
        fontSize.value = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize.value + numericDelta));
    }

    return {
        isOpen,
        isLoading,
        loadError,
        verses,
        activeBookNumber,
        activeChapter,
        bookTitle,
        selectedVersion,
        fontSize,
        open,
        close,
        navigateChapter,
        adjustFontSize,
    };
});
