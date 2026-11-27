import type { Knex } from 'knex';
import { StoreDB } from './DataBase';
import { logSyncChange } from './SyncDB';

export async function backfillFourPicturesProgress() {
    await StoreDB.transaction(async (trx) => {
        const key = 'fpow_sync_backfill_v1';
        if (await trx('sync_settings').where({ key }).first()) return;
        for (const row of await trx('fpow_level_progress').select()) {
            await logSyncChange({ table_name: 'fpow_level_progress', record_key: `fpow_level_${row.level_id}`,
                action: 'updated', payload: row, synced: 0 }, trx);
        }
        const now = new Date().toISOString();
        await trx('sync_settings').insert({ key: 'last_sync_timestamp', value: '0', created_at: now, updated_at: now })
            .onConflict('key').merge({ value: '0', updated_at: now });
        await trx('sync_settings').insert({ key, value: '1', created_at: now, updated_at: now });
    });
}

export async function saveFourPicturesSolved(levelId: number) {
    if (!Number.isSafeInteger(levelId) || levelId <= 0) throw new Error('Invalid level');
    await StoreDB.transaction(async (trx) => {
        const existing = await trx('fpow_level_progress').where({ level_id: levelId }).first();
        const row = { level_id: levelId, solved_at: existing?.solved_at ?? new Date().toISOString(), hint_state: null };
        await trx('fpow_level_progress').insert(row).onConflict('level_id').merge(row);
        await logSyncChange({ table_name: 'fpow_level_progress', record_key: `fpow_level_${levelId}`,
            action: existing ? 'updated' : 'created', payload: row, synced: 0 }, trx);
    });
}

export async function deleteFourPicturesProgress() {
    await StoreDB.transaction(async (trx) => {
        for (const row of await trx('fpow_level_progress').select()) {
            await logSyncChange({ table_name: 'fpow_level_progress', record_key: `fpow_level_${row.level_id}`,
                action: 'deleted', payload: row, synced: 0 }, trx);
        }
        await trx('fpow_level_progress').del();
    });
}

export async function applyFourPicturesProgress(trx: Knex.Transaction, data: any) {
    for (const row of data.fpow_level_progress ?? []) {
        if (!Number.isSafeInteger(row.level_id) || row.level_id <= 0) continue;
        const existing = await trx('fpow_level_progress').where({ level_id: row.level_id }).first();
        const before = existing?.solved_at;
        const incoming = row.solved_at;
        const solved = !before ? incoming ?? null : !incoming ? before
            : Date.parse(before) <= Date.parse(incoming) ? before : incoming;
        const merged = { level_id: row.level_id, solved_at: solved,
            hint_state: solved ? null : row.hint_state ?? existing?.hint_state ?? null };
        await trx('fpow_level_progress').insert(merged).onConflict('level_id').merge(merged);
    }
}
