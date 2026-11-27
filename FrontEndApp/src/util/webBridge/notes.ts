type Request = <T>(path: string, options?: RequestInit) => Promise<T>;

/** The legacy API returns JSON null on success; rejected requests must throw. */
export function createNoteBridge(request: Request) {
    return {
        getNotes: async (): Promise<any[]> => {
            const rows = await request<unknown>('/notes');
            if (!Array.isArray(rows)) throw new Error('Notes could not be loaded.');
            return rows;
        },
        upsertNote: async (note: { note_id: string; title: string; content: string }) => {
            await request('/notes', { method: 'POST', body: JSON.stringify(note) });
            return { success: true };
        },
        deleteNote: async ({ note_id }: { note_id: string }) => {
            await request(`/notes/${encodeURIComponent(note_id)}`, { method: 'DELETE' });
            return { success: true };
        },
    };
}
