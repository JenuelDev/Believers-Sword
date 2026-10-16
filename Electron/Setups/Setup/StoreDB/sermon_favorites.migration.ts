import Log from 'electron-log';
import { StoreDB } from '../../../DataBase/DataBase';

/**
 * `sermon_favorites` holds sermons the user has starred, with the full sermon
 * payload alongside the key so favorites stay readable offline.
 *
 * Synced to the backend `user_sermon_favorites` via sync_logs entries with
 * table_name = 'sermon_favorites' and record_key = the Supabase sermon uuid.
 *
 * Same `hasColumn('sermon_uuid')` marker as cached_sermons. The sync_logs
 * cleanup is NOT optional: an integer-keyed favorite push queued before this
 * upgrade would otherwise be sent to a backend that now expects uuids, whose
 * 36-char guard would happily accept a short integer and store a junk row.
 */
const createTable = async () => {
    await StoreDB.schema.createTable('sermon_favorites', (table) => {
        table.string('sermon_uuid').primary();
        table.text('payload').notNullable();
        table.string('created_at').notNullable();
        table.string('updated_at').notNullable();
    });
};

export default async () => {
    try {
        const exists = await StoreDB.schema.hasTable('sermon_favorites');
        if (!exists) {
            await createTable();
            return;
        }
        const migrated = await StoreDB.schema.hasColumn('sermon_favorites', 'sermon_uuid');
        if (migrated) return;

        // Cleanup runs FIRST, before dropTable: if createTable then threw, the
        // table would already be dropped with no cleanup having run, and the
        // next boot would take the `!exists` branch above — which has no
        // cleanup at all — permanently stranding stale integer-keyed
        // sermon_favorites sync_logs that sync.ts would happily push to a
        // backend whose 36-char guard accepts a short integer without
        // complaint. Running it first is harmless on a fresh install too:
        // there is nothing to delete yet.
        await StoreDB('sync_logs').where({ table_name: 'sermon_favorites' }).delete();
        await StoreDB.schema.dropTable('sermon_favorites');
        await createTable();
    } catch (e) {
        Log.error('sermon_favorites migration failed:', e);
    }
};
