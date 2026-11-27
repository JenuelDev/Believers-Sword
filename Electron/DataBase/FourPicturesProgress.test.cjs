const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const knex = require('knex');

function load(file, dependencies) {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', code)((name) => {
        if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
        return dependencies[name];
    }, module, module.exports);
    return module.exports;
}

test('native progress backfills once, logs solves and merges cloud completion', async () => {
    const db = knex({ client: 'sqlite3', useNullAsDefault: true, connection: { filename: ':memory:' } });
    try {
        await db.schema.createTable('fpow_level_progress', (t) => {
            t.integer('level_id').primary(); t.text('solved_at'); t.text('hint_state');
        });
        await db.schema.createTable('sync_settings', (t) => {
            t.text('key').primary(); t.text('value'); t.text('created_at'); t.text('updated_at');
        });
        await db.schema.createTable('sync_logs', (t) => {
            t.increments('id'); t.text('table_name'); t.text('record_key'); t.text('action');
            t.json('payload'); t.integer('synced'); t.text('created_at'); t.text('updated_at');
        });
        const sync = load('SyncDB.ts', { './DataBase': { StoreDB: db } });
        const fp = load('FourPicturesProgress.ts', { './DataBase': { StoreDB: db }, './SyncDB': sync });
        await db('fpow_level_progress').insert({ level_id: 17, solved_at: null, hint_state: '{"revealed":[0]}' });
        await db('sync_settings').insert({ key: 'last_sync_timestamp', value: '2026-11-01T00:00:00Z' });
        await fp.backfillFourPicturesProgress();
        assert.equal((await db('sync_settings').where({ key: 'last_sync_timestamp' }).first()).value, '0');
        assert.equal((await db('sync_logs').first()).record_key, 'fpow_level_17');
        const queued = (await db('sync_logs').first()).payload;
        assert.equal((typeof queued === 'string' ? JSON.parse(queued) : queued).level_id, 17);
        await fp.backfillFourPicturesProgress();
        assert.equal((await db('sync_logs').select()).length, 1);
        await fp.saveFourPicturesSolved(17);
        const solved = await db('fpow_level_progress').first();
        assert.ok(solved.solved_at);
        assert.equal(solved.hint_state, null);
        assert.equal((await db('sync_logs').select()).length, 2);
        await db.transaction((trx) => fp.applyFourPicturesProgress(trx, {
            fpow_level_progress: [{ level_id: 17, solved_at: '2026-01-01T00:00:00Z', hint_state: '{"revealed":[1]}' }],
        }));
        await db.transaction((trx) => fp.applyFourPicturesProgress(trx, {
            fpow_level_progress: [{ level_id: 17, solved_at: null, hint_state: '{"revealed":[2]}' }],
        }));
        const merged = await db('fpow_level_progress').first();
        assert.equal(merged.solved_at, '2026-01-01T00:00:00Z');
        assert.equal(merged.hint_state, null);
        await fp.deleteFourPicturesProgress();
        assert.equal((await db('fpow_level_progress').select()).length, 0);
        assert.equal((await db('sync_logs').where({ action: 'deleted' }).first()).record_key, 'fpow_level_17');
    } finally { await db.destroy(); }
});
