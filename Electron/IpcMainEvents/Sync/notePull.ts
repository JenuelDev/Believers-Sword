import type { Knex } from 'knex';

async function keepPendingNote(trx: Knex.Transaction, id: string, remoteTime?: string): Promise<boolean> {
    const pending = await trx('sync_logs')
        .where({ table_name: 'notes', record_key: id, synced: 0 })
        .orderBy('id', 'desc').first();
    if (!pending) return false;
    if (pending.action === 'deleted') return true;
    const remote = Date.parse(remoteTime ?? '');
    const local = Date.parse(pending.created_at ?? '');
    return !Number.isFinite(remote) || !Number.isFinite(local) || remote <= local;
}

/** Apply notes atomically with pending-work checks, using the shared schema. */
export async function applyNotePull(db: Knex, data: { sync_logs?: any[]; notes?: any[] }): Promise<void> {
    await db.transaction(async (trx) => {
        for (const log of data.sync_logs ?? []) {
            if (log.table_name !== 'notes' || log.action !== 'deleted' || !log.record_key) continue;
            if (!await keepPendingNote(trx, log.record_key)) {
                await trx('notes').where({ note_id: log.record_key }).delete();
            }
        }
        for (const note of data.notes ?? []) {
            if (!note.note_id) continue;
            const remoteTime = note.client_updated_at ?? note.updated_at;
            if (await keepPendingNote(trx, note.note_id, remoteTime)) continue;
            const existing = await trx('notes').where({ note_id: note.note_id }).first();
            const now = new Date().toISOString();
            const values = { title: note.title ?? '', content: note.content ?? '', updated_at: remoteTime ?? now };
            if (existing) {
                await trx('notes').where({ note_id: note.note_id }).update(values);
            } else {
                await trx('notes').insert({ note_id: note.note_id, ...values, created_at: note.created_at ?? now });
            }
        }
    });
}
