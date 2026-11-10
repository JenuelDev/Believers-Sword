const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
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
let db;
let apply;
beforeEach(async () => {
    db = knex({ client: 'sqlite3', useNullAsDefault: true, connection: { filename: ':memory:' } });
    await db.schema.createTable('sync_logs', (t) => {
        t.increments('id'); t.text('table_name'); t.text('record_key'); t.text('action');
        t.integer('synced').defaultTo(0); t.text('created_at');
    });
    for (const table of ['bookmarks', 'highlights', 'clip_notes', 'prayer_lists']) {
        await db.schema.createTable(table, (t) => {
            t.text('key').primary(); t.integer('book_number'); t.integer('chapter'); t.integer('verse');
            t.text('content'); t.text('color'); t.text('title'); t.text('group'); t.integer('index');
            t.text('status'); t.text('created_at'); t.text('updated_at');
        });
    }
    const handlers = new Map();
    load('SyncHandlers.ts', { electron: { ipcMain: { handle: (name, fn) => handlers.set(name, fn) } },
        'electron-log': { error() {} }, '../../DataBase/SyncDB': {},
        '../../DataBase/DataBase': { StoreDB: db }, './notePull': load('notePull.ts', {}),
        './pendingPull': load('pendingPull.ts', {}),
    }).SyncHandlers({});
    apply = (page) => handlers.get('applyPullData')(null, page);
});
afterEach(async () => db.destroy());

for (const table of ['bookmarks', 'highlights', 'clip_notes', 'prayer_lists']) {
    const row = { key: '10_1_1', book_number: 10, chapter: 1, verse: 1,
        content: 'Remote', color: '#FFD26A', title: 'Remote', status: 'ongoing', index: 0 };
    test(`${table}: queued edits and deletions survive downloads; fresh rows still restore`, async () => {
        await db(table).insert({ ...row, content: 'Local', title: 'Local' });
        await db('sync_logs').insert({ table_name: table, record_key: row.key, action: 'updated' });
        const result = await apply({ [table]: [row, { ...row, key: '10_1_2', verse: 2 }],
            sync_logs: [{ table_name: table, record_key: row.key, action: 'deleted' }] });
        assert.equal(result.success, true);
        assert.equal(result.hasPendingChanges, true);
        assert.equal((await db(table).where({ key: row.key }).first()).content, 'Local');
        assert.ok(await db(table).where({ key: '10_1_2' }).first());
        await db(table).where({ key: row.key }).delete();
        await db('sync_logs').insert({ table_name: table, record_key: row.key, action: 'deleted' });
        await apply({ [table]: [row] });
        assert.equal(await db(table).where({ key: row.key }).first(), undefined);
        await db('sync_logs').update({ synced: 1 });
        assert.equal((await apply({ [table]: [row] })).hasPendingChanges, false);
        assert.ok(await db(table).where({ key: row.key }).first());
    });
}

test('a failed page rolls back every preceding write', async () => {
    await db('highlights').insert({ key: 'existing', content: 'Local' });
    await db.raw("CREATE TRIGGER reject_highlight BEFORE UPDATE ON highlights BEGIN SELECT RAISE(ABORT, 'fixture failure'); END");
    await assert.rejects(apply({ bookmarks: [{ key: 'new', book_number: 10, chapter: 1, verse: 1 }],
        highlights: [{ key: 'existing', content: 'Fail' }] }), /fixture failure/);
    assert.equal(await db('bookmarks').first(), undefined);
});
