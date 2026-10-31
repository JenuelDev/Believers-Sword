const browserTimeZone = (): string | undefined => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Daily devotional for the browser bridge, served by the backend's /api/devotional. */
export function createDevotionalBridge(
    apiFetch: <T>(path: string, fallback: T, options?: RequestInit) => Promise<T>,
    timeZone: () => string | undefined = browserTimeZone,
) {
    return {
        getTodayDevotional: async (languageCode: string = 'en') => {
            // Desktop/mobile pick "today" from the device clock; the server runs
            // on UTC, so tell it which local day (and time-of-day block) we mean.
            const params = new URLSearchParams({ lang: languageCode });
            const tz = timeZone();
            if (tz) params.set('tz', tz);
            return apiFetch(`/devotional/today?${params}`, null);
        },
        getDevotionalByDay: async (day: number, languageCode: string = 'en') => {
            const params = new URLSearchParams({ lang: languageCode });
            return apiFetch(`/devotional/${day}?${params}`, null);
        },
    };
}
