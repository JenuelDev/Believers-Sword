import type { Knex } from 'knex';
import type { SyncLogEntry } from '../../DataBase/SyncDB';

type LogWriter = (entry: SyncLogEntry, executor: Knex.Transaction) => Promise<unknown>;
type NoteWrite = { note_id: string; title: string; content: string };

export async function saveNote(db: Knex, log: LogWriter, note: NoteWrite): Promise<void> {
    await db.transaction(async (trx) => {
        const existing = await trx('notes').where({ note_id: note.note_id }).first();
        const now = new Date().toISOString();
        if (existing) {
            await trx('notes').where({ note_id: note.note_id }).update({ ...note, updated_at: now });
        } else {
            await trx('notes').insert({ ...note, created_at: now, updated_at: now });
        }
        await log({ table_name: 'notes', record_key: note.note_id, action: existing ? 'updated' : 'created', payload: note, synced: 0 }, trx);
    });
}

export async function removeNote(db: Knex, log: LogWriter, noteId: string): Promise<void> {
    await db.transaction(async (trx) => {
        await trx('notes').where({ note_id: noteId }).delete();
        await log({ table_name: 'notes', record_key: noteId, action: 'deleted', payload: { note_id: noteId }, synced: 0 }, trx);
    });
}
