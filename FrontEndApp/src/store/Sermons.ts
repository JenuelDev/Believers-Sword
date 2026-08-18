import { defineStore } from 'pinia';
import { onBeforeMount, ref, watch } from 'vue';
import axios from 'axios';
import { debouncedRunSync } from '../util/Sync/sync';
import { bookNumberFromName } from '../util/bookNameLookup';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const REST_URL = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1`;

const supabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// PostgREST wants `apikey`; RLS reads `Authorization: Bearer`. Send both.
const supabaseHeaders = () => ({
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
});

const PAGE_SIZE = 20;
const CACHE_LIMIT = 10;

/**
 * Columns the feed needs. Mirrors the website's cardColumns
 * (believers-sword-website/app/composables/useSermons.ts) plus view_count,
 * which the apps show and the website does not. `content` is deliberately
 * absent — it is the large column and the feed never renders it.
 */
const CARD_COLUMNS = [
    'id', 'slug', 'title', 'subtitle', 'summary', 'speaker_name',
    'series_name', 'series_part', 'primary_scripture', 'topics',
    'thumbnail_url', 'duration_seconds', 'published_at', 'preached_at',
    'featured', 'view_count',
].join(',');

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
 * `scripture_refs`) as well as a full one — `content === null` is how the
 * detail modal knows to fetch or fall back to the offline message. Also
 * tolerates the stub payload `{ id: uuid }` that the sync applier writes for a
 * favorite pulled from another device.
 */
function normalizeSermon(row: any): SermonType {
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
            // Null when unrecognised — the view must then render plain text.
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

// Guards loadFavorites()'s re-entrant hydration call so filling in stub
// favorites (see loadFavorites below) can never recurse more than once.
let hydrating = false;

export const useSermonStore = defineStore('useSermonStore', () => {
    // Feed (public sermons)
    const sermons = ref<SermonType[]>([]);
    const loading = ref(false);
    const page = ref(1);
    const hasMore = ref(true);
    const search = ref('');
    const topicFilter = ref('');
    const sort = ref<'recent' | 'popular' | 'oldest'>('recent');

    // Topics (for filter chips)
    const topics = ref<string[]>([]);

    // Offline / favorites
    const favoriteIds = ref<Set<string>>(new Set());
    const favorites = ref<SermonType[]>([]);
    /**
     * Status of the most recent feed fetch — drives offline banner / empty
     * messaging in the Sermons view.
     */
    const feedStatus = ref<'loading' | 'fresh' | 'staleOffline' | 'staleError' | 'emptyOffline' | 'emptyError'>('loading');

    const viewedSermonIds = new Set<string>();
    const pendingViewSermonIds = new Set<string>();

    /**
     * Refresh the offline cache with full sermon bodies (card columns alone
     * would leave an offline reader unable to open anything they cached).
     * Best-effort and web-safe: no-ops outside Electron.
     */
    async function refreshCache() {
        if (!window.isElectron) return;
        try {
            const res = await axios.get(
                `${REST_URL}/sermons?select=*&order=featured.desc,published_at.desc&limit=${CACHE_LIMIT}`,
                { headers: supabaseHeaders() },
            );
            const rows = (res.data ?? []).map(normalizeSermon);
            // Strip Vue reactive wrappers before crossing IPC.
            const plain = JSON.parse(JSON.stringify(rows));
            await window.browserWindow.replaceCachedSermons(plain);
        } catch (e) {
            console.warn('replaceCachedSermons failed', e);
        }
    }

    async function getSermons(fresh = false) {
        if (fresh) {
            page.value = 1;
            sermons.value = [];
        }
        if (loading.value || (!fresh && !hasMore.value)) return;
        loading.value = true;

        const isFirstUnfiltered = fresh && !search.value && !topicFilter.value && sort.value === 'recent';

        try {
            // Skip the request entirely when unconfigured so a build without the
            // env vars falls straight into the cached-or-error branch below
            // instead of hitting /rest/v1 with an empty base URL.
            if (!supabaseConfigured()) throw new Error('Supabase is not configured');

            const params = new URLSearchParams({
                select: CARD_COLUMNS,
                limit: String(PAGE_SIZE + 1),   // the extra row is the has-more sentinel
                offset: String((page.value - 1) * PAGE_SIZE),
            });
            if (search.value) params.set('search_vector', `plfts(english).${search.value}`);
            if (topicFilter.value) params.set('topics', `cs.{${topicFilter.value}}`);
            params.set(
                'order',
                sort.value === 'oldest' ? 'published_at.asc'
                : sort.value === 'popular' ? 'view_count.desc'
                // Featured-first only on a browse feed; pinning featured rows to the top of
                // a search result reads as broken.
                : search.value ? 'published_at.desc'
                : 'featured.desc,published_at.desc',
            );
            const res = await axios.get(`${REST_URL}/sermons?${params}`, { headers: supabaseHeaders() });
            const rows = (res.data ?? []).map(normalizeSermon);
            hasMore.value = rows.length > PAGE_SIZE;
            const pageRows = rows.slice(0, PAGE_SIZE);
            sermons.value = fresh ? pageRows : [...sermons.value, ...pageRows];

            if (isFirstUnfiltered) {
                feedStatus.value = 'fresh';
                // Replace offline cache with the top rows we just received.
                await refreshCache();
            }
        } catch (e: any) {
            console.error('getSermons error', e);
            if (isFirstUnfiltered) {
                const offline = !navigator.onLine || !e?.response;
                const cached = await loadCachedSermons();
                if (cached.length) {
                    sermons.value = cached;
                    feedStatus.value = offline ? 'staleOffline' : 'staleError';
                } else {
                    feedStatus.value = offline ? 'emptyOffline' : 'emptyError';
                }
            }
        } finally {
            loading.value = false;
        }
    }

    async function loadCachedSermons(): Promise<SermonType[]> {
        if (!window.isElectron) return [];
        try {
            return (await window.browserWindow.getCachedSermons()) as SermonType[];
        } catch (e) {
            console.warn('getCachedSermons failed', e);
            return [];
        }
    }

    async function loadFavorites() {
        if (!window.isElectron) return;
        try {
            const [ids, items] = await Promise.all([
                window.browserWindow.getSermonFavoriteIds(),
                window.browserWindow.getSermonFavorites(),
            ]);
            favoriteIds.value = new Set(ids.map(String));
            favorites.value = items as SermonType[];

            if (hydrating) return;

            // Favorites pulled from another device arrive as a stub payload
            // ({ id: uuid }) because the backend stores only the uuid. Fill in bodies
            // from Supabase. The probe is a missing `slug`, NOT a null payload — the
            // pull applier always writes a stub, so a null check would never fire.
            const stubs = (items as SermonType[]).filter((s) => !s.slug).map((s) => s.id);
            if (stubs.length && supabaseConfigured()) {
                hydrating = true;
                try {
                    const res = await axios.get(
                        `${REST_URL}/sermons?select=*&id=in.(${stubs.join(',')})`,
                        { headers: supabaseHeaders() },
                    );
                    for (const row of res.data ?? []) {
                        const full = normalizeSermon(row);
                        await window.browserWindow.addSermonFavorite(
                            JSON.parse(JSON.stringify(full)),
                        );
                    }
                    // Only re-fetch if hydration actually wrote something — every
                    // stub id pointing at a deleted/unpublished sermon means an
                    // empty result, and re-running loadFavorites() would just be a
                    // pointless extra IPC round-trip.
                    if (res.data?.length) {
                        await loadFavorites();
                    }
                } catch (e) {
                    console.warn('favorite hydration failed', e);
                } finally {
                    hydrating = false;
                }
            }
        } catch (e) {
            console.warn('loadFavorites failed', e);
        }
    }

    async function toggleFavorite(sermon: SermonType) {
        const isFav = favoriteIds.value.has(sermon.id);
        try {
            if (isFav) {
                await window.browserWindow.removeSermonFavorite(sermon.id);
                favoriteIds.value.delete(sermon.id);
                favorites.value = favorites.value.filter((s) => s.id !== sermon.id);
            } else {
                // Strip Vue's reactive Proxy before crossing the IPC boundary —
                // structured clone can't serialise reactive wrappers.
                const plain = JSON.parse(JSON.stringify(sermon));
                await window.browserWindow.addSermonFavorite(plain);
                favoriteIds.value.add(sermon.id);
                favorites.value = [sermon, ...favorites.value.filter((s) => s.id !== sermon.id)];
            }
            favoriteIds.value = new Set(favoriteIds.value);
            debouncedRunSync();
        } catch (e) {
            console.warn('toggleFavorite failed', e);
        }
    }

    /** Distinct topics across the catalog, for the filter chips. Best-effort:
     *  chips are optional, so any failure degrades to an empty list. */
    async function fetchTopics() {
        if (topics.value.length || !supabaseConfigured()) return;
        try {
            const res = await axios.get(`${REST_URL}/sermons?select=topics`, { headers: supabaseHeaders() });
            const all = new Set<string>();
            for (const row of res.data ?? []) for (const t of row.topics ?? []) all.add(t);
            topics.value = [...all].sort();
        } catch (e) {
            console.warn('fetchTopics failed', e);
        }
    }

    /** Full row for one sermon — used when the cached/feed row has no body. */
    async function fetchBySlug(slug: string): Promise<SermonType | null> {
        if (!supabaseConfigured()) return null;
        try {
            const res = await axios.get(
                `${REST_URL}/sermons?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`,
                { headers: supabaseHeaders() },
            );
            const row = (res.data ?? [])[0];
            return row ? normalizeSermon(row) : null;
        } catch (e) {
            console.warn('fetchBySlug failed', e);
            return null;
        }
    }

    async function recordSermonView(sermon: SermonType) {
        if (viewedSermonIds.has(sermon.id) || pendingViewSermonIds.has(sermon.id)) return;
        pendingViewSermonIds.add(sermon.id);
        try {
            await axios.post(
                `${REST_URL}/rpc/increment_sermon_views`,
                { sermon_slug: sermon.slug },
                { headers: { ...supabaseHeaders(), 'Content-Type': 'application/json' } },
            );
            // The RPC returns void, so the local bump is the only source of the new
            // number. Best-effort: a failed count never surfaces to the reader.
            const feedSermon = sermons.value.find((s) => s.id === sermon.id);
            if (feedSermon) feedSermon.view_count += 1;
            viewedSermonIds.add(sermon.id);
        } catch (e) {
            console.warn('recordSermonView failed', e);
        } finally {
            pendingViewSermonIds.delete(sermon.id);
        }
    }

    watch(() => page.value, () => getSermons());

    onBeforeMount(async () => {
        await Promise.all([getSermons(true), fetchTopics(), loadFavorites()]);
    });

    return {
        // Feed
        sermons,
        loading,
        page,
        hasMore,
        search,
        topicFilter,
        sort,
        getSermons,
        // Topics
        topics,
        fetchTopics,
        // Detail
        fetchBySlug,
        recordSermonView,
        // Offline + favorites
        feedStatus,
        favoriteIds,
        favorites,
        loadFavorites,
        toggleFavorite,
        isFavorite: (id: string) => favoriteIds.value.has(id),
    };
});

// Keep legacy export name for existing imports
export const userSermonStore = useSermonStore;
export type { SermonType as SERMON_TYPE };
