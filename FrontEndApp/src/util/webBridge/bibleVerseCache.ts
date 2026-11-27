type VerseFetch = (path: string) => Promise<any[]>;

/** Share successful chapter reads and in-flight work; failed requests retry. */
export function createBibleVerseLoader(fetchRows: VerseFetch) {
    const cache = new Map<string, Promise<any[]>>();
    return (version: string, book: number, chapter: number): Promise<any[]> => {
        const params = new URLSearchParams();
        params.append('versions[]', version);
        params.set('book_number', String(book));
        params.set('chapter', String(chapter));
        const path = `/bible/verses?${params}`;
        const existing = cache.get(path);
        if (existing) return existing;
        const request = Promise.resolve().then(() => fetchRows(path)).then((rows) => {
            if (!Array.isArray(rows)) throw new Error('The chapter could not be loaded.');
            return rows;
        }).catch((error) => {
            if (cache.get(path) === request) cache.delete(path);
            throw error;
        });
        cache.set(path, request);
        return request;
    };
}
