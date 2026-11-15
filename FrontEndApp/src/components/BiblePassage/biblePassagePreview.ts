import { ref, shallowRef } from 'vue';
import type { BiblePassageReference } from '../../util/biblePassageReference';

export interface PassageSelection {
    reference: BiblePassageReference;
    version: string | null;
    versionLabel: string;
    fontSize: number;
    fontFamily: string;
}

export interface PassageVerse { chapter: number; verse: number; text: string }
export type ChapterLoader = (version: string, book: number, chapter: number) => Promise<any[]>;

/** Independent chapter reads, inclusive bounds and no changes to the main reader. */
export async function loadBiblePassage(selection: PassageSelection, getChapter: ChapterLoader): Promise<PassageVerse[]> {
    if (!selection.version) return [];
    const { reference, version } = selection;
    const verses: PassageVerse[] = [];
    for (let chapter = reference.chapter; chapter <= reference.endChapter; chapter++) {
        const rows = await getChapter(version, reference.book.book_number, chapter);
        if (!Array.isArray(rows)) throw new Error('Could not load the chapter.');
        const start = chapter === reference.chapter ? reference.startVerse : 1;
        const end = chapter === reference.endChapter ? reference.endVerse : Infinity;
        const found = new Map<number, PassageVerse>();
        for (const row of rows) {
            if (!row || Number(row.book_number) !== reference.book.book_number || Number(row.chapter) !== chapter) continue;
            const number = Number(row.verse);
            if (!Number.isInteger(number) || number < start || number > end) continue;
            const text = Array.isArray(row.version)
                ? row.version.find((item: any) => item?.version === version)?.text
                : row.version === version ? row.text : undefined;
            if (typeof text === 'string' && text.trim()) found.set(number, { chapter, verse: number, text });
        }
        const ordered = [...found.values()].sort((a, b) => a.verse - b.verse);
        // Never show a misleading partial range when a chapter is unavailable.
        if (!ordered.length) return [];
        verses.push(...ordered);
    }
    return verses;
}

export function createBiblePassagePreview(getChapter: ChapterLoader) {
    const selection = shallowRef<PassageSelection | null>(null);
    const verses = ref<PassageVerse[]>([]);
    const state = ref<'loading' | 'ready' | 'empty' | 'error' | 'missing-version'>('loading');
    let revision = 0;

    async function retry() {
        const current = selection.value;
        const token = ++revision;
        verses.value = [];
        if (!current?.version) { state.value = 'missing-version'; return; }
        state.value = 'loading';
        try {
            const result = await loadBiblePassage(current, getChapter);
            if (token !== revision) return;
            verses.value = result;
            state.value = result.length ? 'ready' : 'empty';
        } catch {
            if (token === revision) state.value = 'error';
        }
    }

    function open(value: PassageSelection) {
        selection.value = { ...value };
        return retry();
    }

    function close() { ++revision; selection.value = null; }
    return { selection, verses, state, open, retry, close };
}
