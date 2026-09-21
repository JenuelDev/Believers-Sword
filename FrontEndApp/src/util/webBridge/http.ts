const API_BASE = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api`;

export async function apiFetch<T>(path: string, fallback: T, options: RequestInit = {}): Promise<T> {
    try {
        const token = localStorage.getItem('auth_token');
        const isPublic = path.startsWith('/bible/') || path.startsWith('/devotional/');
        if (!isPublic && !token) return fallback;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(options.headers as Record<string, string> ?? {}),
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const r = await fetch(`${API_BASE}${path}`, { ...options, headers });
        if (!r.ok) return fallback;
        return r.json() as Promise<T>;
    } catch {
        return fallback;
    }
}

/**
 * Largest `limit` the REST API accepts on paginated list endpoints
 * (clip-notes, highlights). Requests above this 422 with a validation error.
 */
const API_MAX_LIMIT = 200;

/**
 * Fetch a paginated list endpoint, honoring the caller's requested `limit`.
 *
 * Callers (e.g. the sidebar lists) pass a large `limit` to mean "give me the
 * whole dataset for virtual scrolling", but the API caps `limit` at
 * {@link API_MAX_LIMIT}. When more is requested we page through the endpoint in
 * API-legal chunks and concatenate, stopping once a short page signals the end.
 */
export async function fetchPagedList(
    path: string,
    opts: { page?: number; search?: string | null; limit?: number },
): Promise<any[]> {
    const requested = Number(opts.limit) || API_MAX_LIMIT;
    const search = opts.search ?? null;

    // Small request — a single page honoring the caller's page/limit verbatim.
    if (requested <= API_MAX_LIMIT) {
        const params = new URLSearchParams({ page: String(opts.page ?? 1), limit: String(requested) });
        if (search) params.set('search', String(search));
        return apiFetch(`${path}?${params}`, []);
    }

    // Large request — walk every page until the dataset is exhausted. The page
    // cap is a safety net against an unbounded loop, set well above any realistic
    // per-user record count.
    const all: any[] = [];
    const MAX_PAGES = 500;
    for (let page = 1; page <= MAX_PAGES; page++) {
        const params = new URLSearchParams({ page: String(page), limit: String(API_MAX_LIMIT) });
        if (search) params.set('search', String(search));
        const rows = await apiFetch<any[]>(`${path}?${params}`, []);
        if (!Array.isArray(rows) || rows.length === 0) break;
        all.push(...rows);
        if (rows.length < API_MAX_LIMIT) break;
    }
    return all;
}

