import Log from 'electron-log';
import { StoreDB } from '../../../DataBase/DataBase';

/**
 * `cached_sermons` mirrors the top-N sermons from the public Supabase catalog
 * so the Sermons view has something to render when the network is unreachable.
 * Stores the full sermon JSON **including the body**, so offline users can read
 * and not merely browse.
 *
 * Keyed by the Supabase uuid. There is no version counter in this migration
 * system, so `hasColumn('sermon_uuid')` is the marker: a table without that
 * column is the pre-Supabase integer-keyed shape and gets dropped. Existing
 * rows keyed Laravel sermon ids that clients no longer browse, so there is
 * nothing worth converting.
 */
const createTable = async () => {
    await StoreDB.schema.createTable('cached_sermons', (table) => {
        table.string('sermon_uuid').primary();
        table.integer('position').notNullable();
        table.text('payload').notNullable();
        table.string('cached_at').notNullable();
    });
};

export default async () => {
    try {
        const exists = await StoreDB.schema.hasTable('cached_sermons');
        if (!exists) {
            await createTable();
            return;
        }
        const migrated = await StoreDB.schema.hasColumn('cached_sermons', 'sermon_uuid');
        if (migrated) return;

        await StoreDB.schema.dropTable('cached_sermons');
        await createTable();
    } catch (e) {
        Log.error('cached_sermons migration failed:', e);
    }
};
