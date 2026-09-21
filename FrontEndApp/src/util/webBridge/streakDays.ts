/** REST-backed streak storage shared by the browser bridge. */
export function createStreakBridge(
    apiFetch: <T>(path: string, fallback: T, options?: RequestInit) => Promise<T>,
) {
/**
 * Today's date in the BROWSER's local calendar, as YYYY-MM-DD.
 *
 * Streak days are keyed by local date on every platform (see the Electron
 * `todayKey` in IpcMainEvents/PrayerDays and the mobile provider), so the key
 * is built from local getters — `toISOString()` would return the UTC date and
 * mis-credit anyone east or west of UTC around midnight.
 */
function localDayKey(date = new Date()): string {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${mm}-${dd}`;
}

/**
 * Adopt streak days left in localStorage by the pre-backend web build.
 *
 * Until these endpoints existed, the web app recorded prayer/devotion days
 * only in localStorage, so a user's browser may hold days the server has
 * never seen — including one they completed today. Dropping straight to the
 * API would silently retire those, so the first server read of each streak
 * flushes the leftovers up.
 *
 * Only days the server does NOT already have are posted. That matters for
 * prayer time: `duration` is an increment, so re-posting a day the server
 * already holds (because it arrived from the phone via sync) would add the
 * browser's total on top of the synced one and inflate it.
 *
 * The localStorage key is cleared only after every post succeeds — a partial
 * flush stays put and is retried on the next read rather than losing days.
 * Returns the days that were adopted, so the caller can fold them into the
 * list it just fetched instead of issuing a second round trip.
 */
async function adoptLegacyStreakDays(
    storageKey: 'prayer_days' | 'devotion_days',
    endpoint: '/prayer-days' | '/devotion-days',
    knownDays: Set<string>,
): Promise<Array<{ day: string; duration: number }>> {
    let legacyDays: string[] = [];
    let legacyDurations: Record<string, number> = {};
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return [];
        legacyDays = JSON.parse(raw);
        if (!Array.isArray(legacyDays)) throw new Error('malformed');
        if (storageKey === 'prayer_days') {
            const durRaw = localStorage.getItem('prayer_days_duration');
            legacyDurations = durRaw ? JSON.parse(durRaw) : {};
        }
    } catch {
        // Unreadable leftovers are not worth retrying forever.
        try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
        return [];
    }

    const pending = legacyDays.filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day) && !knownDays.has(day));
    const adopted: Array<{ day: string; duration: number }> = [];

    for (const day of pending) {
        const duration = Math.max(0, Math.floor(legacyDurations[day] ?? 0));
        const body = storageKey === 'prayer_days' ? { day, duration } : { day };
        const res = await apiFetch<{ status?: string } | null>(endpoint, null, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        if (res?.status !== 'success') return adopted; // keep the key; retry next read
        adopted.push({ day, duration });
    }

    try {
        localStorage.removeItem(storageKey);
        if (storageKey === 'prayer_days') localStorage.removeItem('prayer_days_duration');
    } catch { /* ignore */ }

    return adopted;
}


return {
    // ---------- Prayer / devotion streak days ----------
    //
    // Real on web, like sermon favorites. Web has no local SQLite and cannot
    // use the sync protocol (util/Sync/sync.ts runs entirely through
    // window.browserWindow, which is *this* shim), so the backend is its only
    // store. These used to be localStorage-only, which made a streak
    // per-browser: a devotion finished in the browser never reached the user's
    // phone or desktop, and a devotion finished on the phone never showed here.
    //
    // The day key is computed HERE, from the browser's clock, and sent to the
    // server — never derived server-side. The streak is a local-calendar
    // concept, so a user in UTC+8 finishing at 9pm must be credited to their
    // day, not to the server's.
    getPrayerDays: async () => {
        const res = await apiFetch<{ data?: Array<{ day: string; duration?: number }> }>(
            '/prayer-days',
            {},
        );
        const rows = (res.data ?? []).map((r) => ({ day: r.day, duration: r.duration ?? 0 }));
        const adopted = await adoptLegacyStreakDays(
            'prayer_days',
            '/prayer-days',
            new Set(rows.map((r) => r.day)),
        );
        return [...rows, ...adopted];
    },
    markPrayedToday: async (durationSeconds = 0) => {
        const day = localDayKey();
        // `duration` is an increment, not a total — the backend accumulates it,
        // matching how Electron adds each session onto today's running total.
        const add = Math.max(0, Math.floor(durationSeconds || 0));
        const res = await apiFetch<{ status?: string } | null>('/prayer-days', null, {
            method: 'POST',
            body: JSON.stringify({ day, duration: add }),
        });
        // apiFetch swallows failures into the fallback. Returning null rather
        // than the day keeps the store from painting a streak the server never
        // recorded; the user retries instead of trusting a phantom tick.
        return res?.status === 'success' ? day : null;
    },
    getDevotionDays: async () => {
        const res = await apiFetch<{ data?: Array<{ day: string }> }>('/devotion-days', {});
        if (!Array.isArray(res.data)) throw new Error('Could not load devotion days');
        const rows = res.data.map((r) => ({ day: r.day }));
        const adopted = await adoptLegacyStreakDays(
            'devotion_days',
            '/devotion-days',
            new Set(rows.map((r) => r.day)),
        );
        return [...rows, ...adopted.map((a) => ({ day: a.day }))];
    },
    markDevotionToday: async () => {
        const day = localDayKey();
        const res = await apiFetch<{ status?: string } | null>('/devotion-days', null, {
            method: 'POST',
            body: JSON.stringify({ day }),
        });
        return res?.status === 'success' ? day : null;
    },

};
}
