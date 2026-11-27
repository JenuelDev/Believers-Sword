import { ipcMain } from 'electron';
import Log from 'electron-log';
import type { Knex } from 'knex';
import { CrossReferencesDB } from '../../DataBase/DataBase';
import { getBibleVersionDb } from '../../Modules/Bible/Common/BibleVersionCache';

export default () => {
    ipcMain.handle('getCrossReferencePage', async (_event, args: {
        book_number: number; chapter: number; verse: number;
        bible_versions: string[]; offset?: number; limit?: number;
    }) => {
        const offset = Math.max(0, Math.floor(Number(args.offset) || 0));
        const limit = Math.max(1, Math.min(50, Math.floor(Number(args.limit) || 24)));
        const query = CrossReferencesDB('cross_references').where({
            from_book: args.book_number, from_chapter: args.chapter, from_verse: args.verse,
        });
        const groupRows = await query.clone().select('to_book').count<{ to_book: number; count: number }[]>({ count: '*' })
            .groupBy('to_book').orderBy('to_book');
        const groups = groupRows.map(row => ({ book_number: Number(row.to_book), count: Number(row.count) }));
        const references: {
            id: number; to_book: number; to_chapter: number;
            to_verse_start: number; to_verse_end: number | null; votes: number;
        }[] = await query.clone()
            .orderBy('to_book').orderBy('to_chapter').orderBy('to_verse_start').orderBy('id')
            .limit(limit).offset(offset)
            .select('id', 'to_book', 'to_chapter', 'to_verse_start', 'to_verse_end', 'votes');
        const cards = references.map(row => ({
            ...row,
            to_verse_end: row.to_verse_end ?? row.to_verse_start,
            texts: [] as { version: string; text: string }[],
        }));
        if (cards.length) {
            for (const version of [...new Set(args.bible_versions)].slice(0, 10)) {
                try {
                    const verses: { book_number: number; chapter: number; verse: number; text: string }[] = await getBibleVersionDb(version)('verses')
                        .where((builder: Knex.QueryBuilder) => {
                            for (const reference of cards) {
                                builder.orWhere((part: Knex.QueryBuilder) => part.where({
                                    book_number: reference.to_book, chapter: reference.to_chapter,
                                }).whereBetween('verse', [reference.to_verse_start, reference.to_verse_end]));
                            }
                        })
                        .select('book_number', 'chapter', 'verse', 'text').orderBy('verse');
                    for (const card of cards) {
                        const text = verses.filter(row => Number(row.book_number) === card.to_book
                            && Number(row.chapter) === card.to_chapter
                            && Number(row.verse) >= card.to_verse_start && Number(row.verse) <= card.to_verse_end)
                            .map(row => row.text).join(' ');
                        if (text) card.texts.push({ version, text });
                    }
                } catch (error) {
                    Log.error('Cross-reference verse text unavailable:', version, error);
                }
            }
        }
        return { references: cards, groups, total: groups.reduce((sum, group) => sum + group.count, 0) };
    });

    ipcMain.handle(
        'getCrossReferences',
        async (_event, args: { book_number: number; chapter: number; verse: number }) => {
            return CrossReferencesDB('cross_references')
                .where({
                    from_book: args.book_number,
                    from_chapter: args.chapter,
                    from_verse: args.verse,
                })
                .orderBy('votes', 'desc')
                .select('to_book', 'to_chapter', 'to_verse_start', 'to_verse_end', 'votes');
        }
    );

    ipcMain.handle(
        'getVerseText',
        async (
            _event,
            args: { bible_versions: string[]; book_number: number; chapter: number; verse: number }
        ) => {
            const results: { version: string; text: string }[] = [];
            Log.info('getVerseText args:', JSON.stringify(args));
            for (const version of args.bible_versions) {
                try {
                    const db = getBibleVersionDb(version);
                    const row = await db('verses')
                        .where('book_number', args.book_number)
                        .where('chapter', args.chapter)
                        .where('verse', args.verse)
                        .first();
                    if (row) results.push({ version, text: row.text });
                } catch (e) {
                    Log.error('getVerseText error for version', version, e);
                }
            }
            Log.info('getVerseText results count:', results.length);
            return results;
        }
    );
};
