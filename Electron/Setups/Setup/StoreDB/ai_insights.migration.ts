import { StoreDB } from '../../../DataBase/DataBase';
import Log from 'electron-log';

/**
 * `ai_insights` is a *local cache* of generated AI verse content (an AI Insight
 * or a verse Sermon), so reopening the same verse shows the result instantly
 * without spending another AI credit. Keyed by `${mode}:${reference}:${version}`.
 *
 * This is a throwaway cache — entries are pruned after 3 days (see the
 * former AiInsights IPC handlers) and were never synced to the backend.
 * Retained after the AI features were removed from the desktop app so
 * existing rows survive; nothing reads or writes it any more.
 */
export default async () => {
    await StoreDB.schema.hasTable('ai_insights').then(async (exists) => {
        if (exists) return;
        try {
            await StoreDB.schema.createTable('ai_insights', (table) => {
                table.string('key').primary();
                table.string('mode').notNullable(); // 'insight' | 'sermon'
                table.string('reference').notNullable();
                table.string('version').nullable();
                table.text('content').notNullable();
                table.string('created_at').notNullable();
            });
        } catch (e) {
            Log.error(e);
        }
    });
};
