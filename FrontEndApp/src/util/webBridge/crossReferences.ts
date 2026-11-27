import { apiFetch } from './http';
import type { CrossReferencePage } from '../crossReferences';

export function createCrossReferenceBridge(): Pick<Window['browserWindow'],
    'getCrossReferencePage' | 'getCrossReferences' | 'getVerseText'> {
    return {
        getCrossReferencePage: async args => {
            const params = new URLSearchParams({
                book_number: String(args.book_number),
                chapter: String(args.chapter),
                verse: String(args.verse),
                page: '1',
                offset: String(args.offset ?? 0),
                limit: String(args.limit ?? 24),
            });
            args.bible_versions.forEach(version => params.append('versions[]', version));
            const page = await apiFetch<CrossReferencePage | null>(`/cross-references?${params}`, null);
            if (!page || !Array.isArray(page.references)) {
                throw new Error('Could not load cross references. Please retry.');
            }
            return page;
        },
        getCrossReferences: async args => {
            const params = new URLSearchParams({
                book_number: String(args.book_number),
                chapter: String(args.chapter),
                verse: String(args.verse),
            });
            return apiFetch(`/cross-references?${params}`, []);
        },
        getVerseText: async args => {
            const params = new URLSearchParams();
            args.bible_versions.forEach(version => params.append('versions[]', version));
            params.set('book_number', String(args.book_number));
            params.set('chapter', String(args.chapter));
            params.set('verse', String(args.verse));
            return apiFetch(`/bible/verse-text?${params}`, []);
        },
    };
}
