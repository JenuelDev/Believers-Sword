export interface PassageBook {
    title: string;
    short_name: string;
    book_number: number;
    chapter_count: number;
    deuterocanonical_chapter_count?: number;
}

export interface BiblePassageReference {
    book: PassageBook;
    chapter: number;
    startVerse: number;
    endChapter: number;
    endVerse: number;
    label: string;
}

export interface BiblePassageMatch {
    start: number;
    end: number;
    reference: BiblePassageReference;
}

function normalizeName(value: string): string {
    return value.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
        .replace(/^(i{1,3}) /, (_, ordinal: string) => `${ordinal.length} `)
        .replace(/^([123])(?:st|nd|rd) /, '$1 ')
        .replace(/^([123])([a-z])/, '$1 $2');
}

/** Strict single-book citations; unsupported lists and whole chapters stay external. */
export function createBiblePassageParser(books: PassageBook[]) {
    const names = new Map<string, PassageBook>();
    for (const book of books) {
        names.set(normalizeName(book.title), book);
        names.set(normalizeName(book.short_name), book);
    }
    for (const [alias, number] of [['psalm', 230], ['song of songs', 260]] as const) {
        const book = books.find(item => item.book_number === number);
        if (book) names.set(alias, book);
    }

    function parse(value: string): BiblePassageReference | null {
        const normalized = value.trim().replace(/\s+\([A-Za-z0-9 .+\-]+\)$/, '')
            .replace(/[\u2013\u2014]/g, '-');
        const match = /^(.+?)\s+(\d{1,3})\s*:\s*(\d{1,3})(?:\s*-\s*(?:(\d{1,3})\s*:\s*)?(\d{1,3}))?$/.exec(normalized);
        if (!match) return null;
        const book = names.get(normalizeName(match[1]));
        if (!book) return null;
        const chapter = Number(match[2]);
        const startVerse = Number(match[3]);
        const endChapter = Number(match[4] ?? match[2]);
        const endVerse = Number(match[5] ?? match[3]);
        if (chapter < 1 || endChapter < chapter
            || endChapter > Math.max(book.chapter_count, book.deuterocanonical_chapter_count ?? 0)
            || startVerse < 1 || endVerse < 1 || (chapter === endChapter && endVerse < startVerse)) return null;
        const suffix = chapter !== endChapter ? `-${endChapter}:${endVerse}`
            : startVerse !== endVerse ? `-${endVerse}` : '';
        return { book, chapter, startVerse, endChapter, endVerse, label: `${book.title} ${chapter}:${startVerse}${suffix}` };
    }

    function fromLink(url: string, title = ''): BiblePassageReference | null {
        try {
            const uri = new URL(url);
            if (['http:', 'https:'].includes(uri.protocol)
                && (uri.hostname === 'biblegateway.com' || uri.hostname.endsWith('.biblegateway.com'))
                && uri.searchParams.has('search')) {
                return parse(uri.searchParams.get('search') ?? '');
            }
        } catch { /* A strict citation title can still identify a local passage. */ }
        return parse(title);
    }

    const patterns = [...names.keys()].sort((a, b) => b.length - a.length).map(name => {
        const ordinal = /^([123]) /.exec(name);
        let prefix = '';
        if (ordinal) {
            const number = Number(ordinal[1]);
            prefix = `(?:${number}(?:${['st', 'nd', 'rd'][number - 1]})?|${['I', 'II', 'III'][number - 1]})\\.?\\s*`;
            name = name.slice(2);
        }
        return prefix + name.split(' ').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+') + '\\.?';
    });
    const citationPattern = new RegExp('\\b(?:' + patterns.join('|')
        + ')\\s+\\d{1,3}\\s*:\\s*\\d{1,3}(?:\\s*[-\\u2013\\u2014]\\s*(?:\\d{1,3}\\s*:\\s*)?\\d{1,3})?(?![A-Za-z0-9_])', 'gi');
    const startsWithCitation = new RegExp('^(?:' + citationPattern.source + ')', 'i');

    function findInText(text: string): BiblePassageMatch[] {
        const found: BiblePassageMatch[] = [];
        citationPattern.lastIndex = 0;
        for (const match of text.matchAll(citationPattern)) {
            const start = match.index!;
            const end = start + match[0].length;
            const tail = text.slice(end);
            const continuation = /^\s*[,:\-\u2013\u2014]\s*(?=\d)/.exec(tail);
            if (continuation && !startsWithCitation.test(tail.slice(continuation[0].length))) continue;
            const reference = parse(match[0]);
            if (reference) found.push({ start, end, reference });
        }
        return found;
    }

    return { parse, fromLink, findInText };
}
