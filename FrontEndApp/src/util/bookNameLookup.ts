import { bibleBooks } from './books';

/**
 * Canonicalise a Bible book name for lookup:
 *  - lowercase, periods removed, whitespace collapsed and trimmed
 *  - leading roman ordinals folded onto digits   ("ii john"  -> "2 john")
 *  - leading English ordinals folded onto digits  ("2nd kings" -> "2 kings")
 *  - a digit glued to the name separated          ("1samuel"  -> "1 samuel")
 */
export function normalizeBookName(raw: string): string {
    let s = raw.toLowerCase().replace(/\./g, '');
    s = s.replace(/\s+/g, ' ').trim();
    // Roman numerals only when followed by a space, so "isaiah" is untouched.
    s = s.replace(/^(i{1,3}) /, (_m, r: string) => `${r.length} `);
    s = s.replace(/^([123])(?:st|nd|rd) /, (_m, d: string) => `${d} `);
    s = s.replace(/^([123])([a-z])/, (_m, d: string, c: string) => `${d} ${c}`);
    return s;
}

/**
 * Spellings the sermon catalog uses that `bibleBooks` does not carry.
 *
 * Verified against every scripture_refs entry in the website repo's
 * content/sermons/*.md: the catalog cites "Psalm" while the book list says
 * "Psalms". "Song of Songs" is defensive — the common alternate name for the
 * book the list calls "Song of Solomon".
 */
const ALIASES: Record<string, number> = {
    psalm: 230,
    'song of songs': 260,
};

// Index by `title` only — `short_name` is deliberately excluded. `books.ts`
// has a genuine collision on short_name 'Jud' (Judith 180 vs. Jude 720); a
// plain assignment would let one silently overwrite the other and resolve
// abbreviations to the wrong book. The Flutter app's equivalent
// (book_name_lookup.dart) also inverts a full-name-only map, so both
// platforms agree on what resolves.
const byName: Record<string, number> = (() => {
    const map: Record<string, number> = {};
    for (const book of bibleBooks) {
        map[normalizeBookName(book.title)] = book.book_number;
    }
    return { ...map, ...ALIASES };
})();

/**
 * Resolve an English book **name** to this app's book number.
 *
 * Supabase sermons carry scripture_refs whose `book` is a name ("John",
 * "1 Samuel"), while the reader takes an integer book number. Returns null for
 * anything unrecognised — callers MUST render plain, non-tappable text on
 * null, so an unusual spelling in a future sermon cannot break the detail view.
 *
 * Note: book numbers are not guessable from position. Matthew is 470 and John
 * is 500.
 */
export function bookNumberFromName(name: string | null | undefined): number | null {
    if (!name) return null;
    const key = normalizeBookName(name);
    if (!key) return null;
    return byName[key] ?? null;
}
