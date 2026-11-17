import { defineStore } from 'pinia';
import { onBeforeMount, ref, watch } from 'vue';
import axios from 'axios';
import { debouncedRunSync } from '../util/Sync/sync';
import { normalizeSermon, type SermonType } from './sermons/sermonModels';
import { sermonTopicQuery } from './sermons/sermonTopics';
export type { SermonType, ScriptureRef } from './sermons/sermonModels';
export { sermonSeriesLabel, scriptureRefLabel } from './sermons/sermonModels';

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

/**
 * Full row columns — card columns plus everything the detail modal needs.
 * Deliberately omits `search_vector` (generated tsvector) and `transcript`,
 * neither of which normalizeSermon reads; `select=*` on the live catalog
 * ships ~1.7x the bytes this does. Mirrors mobile's sermonFullColumns exactly
 * so both clients query identically.
 */
const FULL_COLUMNS = `${CARD_COLUMNS},content,content_format,speaker_title,speaker_avatar_url,scripture_refs,video_url,audio_url`;

export const useSermonStore = defineStore('useSermonStore', () => {
    // Feed (public sermons)
    const sermons = ref<SermonType[]>([]);
    const loading = ref(false);
    const page = ref(1);
    const hasMore = ref(true);
    const search = ref('');
    const topicFilter = ref<string[]>([]);
    const sort = ref<'recent' | 'popular' | 'oldest'>('recent');

    // Topics (for the multi-select)
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
                `${REST_URL}/sermons?select=${FULL_COLUMNS}&order=featured.desc,published_at.desc&limit=${CACHE_LIMIT}`,
                { headers: supabaseHeaders() },
            );
            const rows = (res.data ?? []).map(normalizeSermon);
            // Strip Vue reactive wrappers before crossing IPC.
            const plain = JSON.parse(JSON.stringify(rows));
            // Pass the cap through rather than letting the Electron side hardcode
            // its own copy of it — otherwise raising CACHE_LIMIT here silently
            // does nothing on the write side.
            await window.browserWindow.replaceCachedSermons(plain, CACHE_LIMIT);
        } catch (e) {
            console.warn('replaceCachedSermons failed', e);
        }
    }

    let pendingRefresh = false;

    async function getSermons(fresh = false) {
        // Coalesce changes during a request, then fetch the latest filters.
        if (loading.value) {
            if (fresh) pendingRefresh = true;
            return;
        }
        if (!fresh && !hasMore.value) return;
        if (fresh) {
            page.value = 1;
            sermons.value = [];
        }
        loading.value = true;

        const trimmedSearch = search.value.trim();
        const topicsQuery = sermonTopicQuery(topicFilter.value);
        const isFirstUnfiltered = fresh && !trimmedSearch && !topicsQuery && sort.value === 'recent';

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
            if (trimmedSearch) params.set('search_vector', `plfts(english).${trimmedSearch}`);
            if (topicsQuery) params.set('topics', topicsQuery);
            params.set(
                'order',
                sort.value === 'oldest' ? 'published_at.asc'
                : sort.value === 'popular' ? 'view_count.desc'
                // Featured-first only on a browse feed; pinning featured rows to the top of
                // a search result reads as broken.
                : trimmedSearch ? 'published_at.desc'
                : 'featured.desc,published_at.desc',
            );
            const res = await axios.get(`${REST_URL}/sermons?${params}`, { headers: supabaseHeaders() });
            if (pendingRefresh) return;
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
            if (pendingRefresh) return;
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
            if (pendingRefresh) {
                pendingRefresh = false;
                await getSermons(true);
            }
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

    /** Clear the in-memory favorites — used when signing out so the previous
     *  user's stars don't linger on screen. */
    function clearFavorites() {
        favoriteIds.value = new Set();
        favorites.value = [];
    }

    async function loadFavorites() {
        try {
            const [ids, items] = await Promise.all([
                window.browserWindow.getSermonFavoriteIds(),
                window.browserWindow.getSermonFavorites(),
            ]);
            favoriteIds.value = new Set(ids.map(String));
            // normalizeSermon gives a bare stub ({ id: uuid }) safe defaults
            // (title: 'Untitled', etc.) instead of rendering a blank card and
            // opening a blank-titled modal.
            favorites.value = (items as any[]).map(normalizeSermon);

            // Favorites need a body fetch in two cases: a bare stub pulled from
            // another device ({ id: uuid } — the backend only stores the uuid),
            // or a card-columns payload favorited straight off the feed (has a
            // `slug` but `content` is still null). The probe is therefore a
            // missing `content`, NOT a missing `slug` — the latter only tells
            // you it's a bare stub, and would skip the card-row case entirely,
            // leaving a sermon the user just starred unavailable offline.
            // Pruning (dropping favorites the backend no longer has) keys on
            // `slug` instead and is out of scope here.
            let needsBody = favorites.value.filter((s) => !s.content);
            if (!needsBody.length) return;

            // Satisfy from the local cache first — those top-N rows already
            // carry a full body precisely so this can work offline, and a
            // sermon that's already cached hydrates with zero network calls.
            if (window.isElectron) {
                try {
                    const cached = await loadCachedSermons();
                    const cachedById = new Map(
                        cached.filter((s) => s.content).map((s) => [s.id, s]),
                    );
                    const fromCache = needsBody
                        .map((s) => cachedById.get(s.id))
                        .filter((s): s is SermonType => !!s);
                    if (fromCache.length) {
                        const byId = new Map(fromCache.map((s) => [s.id, s]));
                        favorites.value = favorites.value.map((s) => byId.get(s.id) ?? s);
                        // update()-only, no sync_log — see refreshSermonFavoritePayload.
                        for (const full of fromCache) {
                            await window.browserWindow.refreshSermonFavoritePayload(
                                JSON.parse(JSON.stringify(full)),
                            );
                        }
                        needsBody = needsBody.filter((s) => !byId.has(s.id));
                    }
                } catch (e) {
                    console.warn('cache favorite hydration failed', e);
                }
            }

            if (needsBody.length && supabaseConfigured()) {
                try {
                    const ids2 = needsBody.map((s) => s.id);
                    const res = await axios.get(
                        `${REST_URL}/sermons?select=${FULL_COLUMNS}&id=in.(${ids2.join(',')})`,
                        { headers: supabaseHeaders() },
                    );
                    const hydrated: SermonType[] = (res.data ?? []).map(normalizeSermon);
                    if (hydrated.length) {
                        // Persist locally so Electron can read favorites offline. Web has
                        // no local store — its bridge keeps only the uuid — so for web
                        // the in-memory list below is the only place bodies ever live.
                        //
                        // Writes through refreshSermonFavoritePayload, NOT
                        // addSermonFavorite: that helper is update()-only and logs no
                        // sync change, because (a) these favorites already exist
                        // server-side so hydrating them must queue nothing, and (b) if
                        // the user unstarred while this fetch was in flight, the row is
                        // already gone — addSermonFavorite would re-insert it and push a
                        // resurrection to the server while the in-memory state says
                        // un-starred. The Flutter app has the same helper for the same
                        // reason.
                        if (window.isElectron) {
                            for (const full of hydrated) {
                                await window.browserWindow.refreshSermonFavoritePayload(
                                    JSON.parse(JSON.stringify(full)),
                                );
                            }
                        }
                        // Merge into the rendered list on BOTH platforms, replacing the
                        // stub entries in place so order is preserved.
                        const byId = new Map(hydrated.map((s) => [s.id, s]));
                        favorites.value = favorites.value.map((s) => byId.get(s.id) ?? s);
                    }
                } catch (e) {
                    console.warn('favorite hydration failed', e);
                }
            }
        } catch (e) {
            console.warn('loadFavorites failed', e);
        }
    }

    /**
     * Toggle a favorite. Returns `false` on a failed write so the caller can
     * surface an error — on web `{ success: false }` is `apiFetch`'s fallback
     * for "no token" / any non-2xx / any network error; on Electron it means
     * the local SQLite write genuinely failed. Either way, applying the
     * favoriteIds/favorites mutation anyway would light up (or extinguish) the
     * star for a change that never actually persisted, and a signed-out or
     * offline user would lose it on reload. The mutation below only runs
     * after a successful write, so on failure there is nothing to roll back.
     */
    async function toggleFavorite(sermon: SermonType): Promise<boolean> {
        const isFav = favoriteIds.value.has(sermon.id);
        try {
            if (isFav) {
                const res = await window.browserWindow.removeSermonFavorite(sermon.id);
                if (!res?.success) {
                    console.warn('removeSermonFavorite failed', res?.error);
                    return false;
                }
                favoriteIds.value.delete(sermon.id);
                favorites.value = favorites.value.filter((s) => s.id !== sermon.id);
            } else {
                // Strip Vue's reactive Proxy before crossing the IPC boundary —
                // structured clone can't serialise reactive wrappers.
                const plain = JSON.parse(JSON.stringify(sermon));
                const res = await window.browserWindow.addSermonFavorite(plain);
                if (!res?.success) {
                    console.warn('addSermonFavorite failed', res?.error);
                    return false;
                }
                favoriteIds.value.add(sermon.id);
                favorites.value = [sermon, ...favorites.value.filter((s) => s.id !== sermon.id)];
            }
            favoriteIds.value = new Set(favoriteIds.value);
            debouncedRunSync();
            return true;
        } catch (e) {
            console.warn('toggleFavorite failed', e);
            return false;
        }
    }

    /** Distinct topics across the catalog, for the topic selector. Best-effort:
     *  topics are optional, so any failure degrades to an empty list. */
    async function fetchTopics() {
        if (topics.value.length || !supabaseConfigured()) return;
        try {
            const res = await axios.get(
                `${REST_URL}/sermons?select=topics&limit=1000`,
                { headers: supabaseHeaders() },
            );
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
                `${REST_URL}/sermons?select=${FULL_COLUMNS}&slug=eq.${encodeURIComponent(slug)}&limit=1`,
                { headers: supabaseHeaders() },
            );
            const row = (res.data ?? [])[0];
            return row ? normalizeSermon(row) : null;
        } catch (e) {
            console.warn('fetchBySlug failed', e);
            return null;
        }
    }

    /**
     * Full row for one sermon by id — used when a favorite stub has no slug
     * yet (fetchBySlug can't key on an empty string) and hydration hasn't
     * filled one in.
     */
    async function fetchById(id: string): Promise<SermonType | null> {
        if (!supabaseConfigured()) return null;
        try {
            const res = await axios.get(
                `${REST_URL}/sermons?select=${FULL_COLUMNS}&id=eq.${encodeURIComponent(id)}&limit=1`,
                { headers: supabaseHeaders() },
            );
            const row = (res.data ?? [])[0];
            return row ? normalizeSermon(row) : null;
        } catch (e) {
            console.warn('fetchById failed', e);
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
        fetchById,
        recordSermonView,
        // Offline + favorites
        feedStatus,
        favoriteIds,
        favorites,
        loadFavorites,
        clearFavorites,
        toggleFavorite,
        isFavorite: (id: string) => favoriteIds.value.has(id),
    };
});

// Keep legacy export name for existing imports
export const userSermonStore = useSermonStore;
export type { SermonType as SERMON_TYPE };
