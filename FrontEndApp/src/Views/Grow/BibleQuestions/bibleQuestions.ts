// Shapes returned by the Electron `bibleQuestions:*` handlers
// (Electron/Grow/bibleQuestionsQueries.ts) plus small display helpers.

/** Shown behind the Preview badge until the library has been fully reviewed (same text as mobile). */
export const BIBLE_QUESTIONS_PREVIEW_NOTE = 'Bible Questions is a preview. Answers are still being reviewed and may '
    + 'contain mistakes, so check them against Scripture.';

export interface BibleQuestionSummary {
    id: number;
    question: string;
    category: string;
    answer_count: number;
}

export interface BibleAnswerReference {
    title: string;
    url: string;
}

export interface BibleAnswer {
    id: number;
    answer: string;
    type: 'md' | 'html' | 'txt';
    references: BibleAnswerReference[];
}

export interface BibleQuestionPageArgs {
    search: string;
    category: string;
    offset: number;
    limit: number;
}

export interface BibleQuestionPage {
    questions: BibleQuestionSummary[];
    total: number;
}

/** Splits `text` into runs, flagging every case-insensitive match of `query`. */
export function highlightSegments(text: string, query: string): { text: string; match: boolean }[] {
    const needle = query.trim().toLowerCase();
    const haystack = text.toLowerCase();
    // Some characters change length when lowercased, which would shift indexes.
    if (!needle || haystack.length !== text.length) return [{ text, match: false }];
    const segments: { text: string; match: boolean }[] = [];
    let start = 0;
    for (let match = haystack.indexOf(needle); match >= 0; match = haystack.indexOf(needle, start)) {
        if (match > start) segments.push({ text: text.slice(start, match), match: false });
        start = match + needle.length;
        segments.push({ text: text.slice(match, start), match: true });
    }
    if (start < text.length) segments.push({ text: text.slice(start), match: false });
    return segments;
}

/** The site a reference opens, without `www.`; falls back to the raw URL. */
export function referenceHost(url: string): string {
    try {
        const host = new URL(url).hostname;
        if (!host) return url;
        return host.startsWith('www.') ? host.slice(4) : host;
    } catch {
        return url;
    }
}

export function answerLabel(index: number, total: number): string {
    return total === 1 ? 'Answer' : `Answer ${index} of ${total}`;
}

export function countLabel(count: number, noun: string): string {
    return `${count} ${count === 1 ? noun : `${noun}s`}`;
}
