const keys: Record<string, string> = {
    bookmarks: 'key', highlights: 'key', clip_notes: 'key', prayer_lists: 'key',
    sermon_favorites: 'sermon_id', prayer_days: 'day', devotion_days: 'day',
    ai_conversations: 'conversation_id',
};
export const pendingPullTables = [...Object.keys(keys), 'notes'];

/** Called inside the same transaction as the page's writes. Notes retain LWW. */
export function filterPendingPull<T extends Record<string, any>>(data: T, pending: any[]): T {
    const blocked = new Map<string, Set<string>>();
    for (const log of pending) {
        if (!keys[log.table_name] || typeof log.record_key !== 'string') continue;
        if (!blocked.has(log.table_name)) blocked.set(log.table_name, new Set());
        blocked.get(log.table_name)!.add(log.record_key);
    }
    const result: Record<string, any> = { ...data };
    for (const [table, ids] of blocked) {
        result[table] = (data[table] ?? []).filter((row: any) => !ids.has(row[keys[table]]));
    }
    result.sync_logs = (data.sync_logs ?? []).filter((log: any) =>
        !blocked.get(log.table_name)?.has(log.record_key));
    return result as T;
}
