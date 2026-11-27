import { bookNumberFromName } from '../../util/bookNameLookup';

export type ScriptureRef = {
    book: string;          // as authored, e.g. "1 Samuel"
    bookNumber: number | null;
    chapter: number | null;
    verse_start: number | null;
    verse_end: number | null;
};

export type SermonType = {
    id: string;            // uuid
    slug: string;
    title: string;
    subtitle: string | null;
    summary: string | null;
    content: string | null;        // null on a card row
    content_format: 'markdown' | 'html' | 'plain';
    speaker_name: string;
    speaker_title: string | null;
    speaker_avatar_url: string | null;
    series_name: string | null;
    series_part: number | null;
    scripture_refs: ScriptureRef[];
    primary_scripture: string | null;
    topics: string[];
    video_url: string | null;
    audio_url: string | null;
    thumbnail_url: string | null;
    duration_seconds: number | null;
    featured: boolean;
    view_count: number;
    published_at: string | null;
    preached_at: string | null;
};

/**
 * Map a PostgREST row to SermonType.
 *
 * Tolerates a card-columns row (no `content`, `content_format` or
 * `scripture_refs`) as well as a full one , `content === null` is how the
 * detail modal knows to fetch or fall back to the offline message. Also
 * tolerates the stub payload `{ id: uuid }` that the sync applier writes for a
 * favorite pulled from another device.
 */
export function normalizeSermon(row: any): SermonType {
    return {
        id: String(row?.id ?? ''),
        slug: row?.slug ?? '',
        title: row?.title ?? 'Untitled',
        subtitle: row?.subtitle ?? null,
        summary: row?.summary ?? null,
        content: row?.content ?? null,
        content_format: row?.content_format ?? 'markdown',
        speaker_name: row?.speaker_name ?? '',
        speaker_title: row?.speaker_title ?? null,
        speaker_avatar_url: row?.speaker_avatar_url ?? null,
        series_name: row?.series_name ?? null,
        series_part: row?.series_part ?? null,
        scripture_refs: (row?.scripture_refs ?? []).map((ref: any) => ({
            book: ref?.book ?? '',
            // Supabase stores the book as a NAME; the reader needs a number.
            // Null when unrecognised , the view must then render plain text.
            bookNumber: bookNumberFromName(ref?.book),
            chapter: ref?.chapter ?? null,
            verse_start: ref?.verse_start ?? null,
            verse_end: ref?.verse_end ?? null,
        })),
        primary_scripture: row?.primary_scripture ?? null,
        topics: row?.topics ?? [],
        video_url: row?.video_url ?? null,
        audio_url: row?.audio_url ?? null,
        thumbnail_url: row?.thumbnail_url ?? null,
        duration_seconds: row?.duration_seconds ?? null,
        featured: Boolean(row?.featured),
        view_count: row?.view_count ?? 0,
        published_at: row?.published_at ?? null,
        preached_at: row?.preached_at ?? null,
    };
}

/** "Grief · Part 2", "Grief", or '' when standalone. Mirrors mobile's seriesLabel. */
export function sermonSeriesLabel(sermon: SermonType): string {
    if (!sermon.series_name) return '';
    return sermon.series_part
        ? `${sermon.series_name} · Part ${sermon.series_part}`
        : sermon.series_name;
}

/** Display label for one scripture ref: "John 11:1-44", "John 11", "Habakkuk". */
export function scriptureRefLabel(ref: ScriptureRef): string {
    if (!ref.book) return '';
    if (!ref.chapter) return ref.book;
    const base = `${ref.book} ${ref.chapter}`;
    if (!ref.verse_start) return base;
    const versePart =
        ref.verse_end && ref.verse_end !== ref.verse_start
            ? `${ref.verse_start}-${ref.verse_end}`
            : `${ref.verse_start}`;
    return `${base}:${versePart}`;
}

