const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const knex = require('knex');
const path = require('node:path');
const compiled = path.resolve(__dirname, '../../../dist');
const { applyNotePull } = require(path.join(compiled, 'IpcMainEvents/Sync/notePull.js'));
const { saveNote, removeNote } = require(path.join(compiled, 'IpcMainEvents/notes/notePersistence.js'));
// SyncDB's executor is supplied by these tests; do not initialize a real Store.db.
const databaseModule = path.join(compiled, 'DataBase/DataBase.js');
const previous = require.cache[databaseModule];
require.cache[databaseModule] = { id: databaseModule, filename: databaseModule, loaded: true, exports: { StoreDB: null } };
const { logSyncChange } = require(path.join(compiled, 'DataBase/SyncDB.js'));
if (previous) require.cache[databaseModule] = previous;
else delete require.cache[databaseModule];
let db;
beforeEach(async () => {
    db = knex({ client: 'sqlite3', useNullAsDefault: true, connection: { filename: ':memory:' } });
    await db.schema.createTable('notes', (table) => {
        table.string('note_id').primary(); table.text('title'); table.text('content'); table.text('created_at'); table.text('updated_at');
    });
    await db.schema.createTable('sync_logs', (table) => {
        table.increments('id'); table.string('table_name'); table.string('record_key'); table.string('action'); table.text('payload');
        table.integer('synced'); table.text('created_at'); table.text('updated_at');
    });
});
afterEach(async () => db.destroy());
const local = { note_id: 'n1', title: 'Local title', content: 'Local edit' };
const remote = { note_id: 'n1', title: 'Remote title', content: 'Remote edit', client_updated_at: '2026-10-25T12:00:00Z', updated_at: '2026-10-28T12:00:00Z' };
async function queueLocal() {
    await saveNote(db, logSyncChange, local);
    await db('sync_logs').update({ created_at: '2026-10-26T12:00:00Z' });
}

test('older pulls preserve pending notes, including remote receipt after the local edit', async () => {
    await queueLocal();
    await applyNotePull(db, { notes: [remote] });
    assert.equal((await db('notes').first()).content, local.content);
    assert.equal((await db('sync_logs').first()).synced, 0);
    assert.equal(JSON.parse((await db('sync_logs').first()).payload).content, local.content);
});

test('newer remote edits win and uploaded notes accept remote changes', async () => {
    await queueLocal();
    await applyNotePull(db, { notes: [{ ...remote, client_updated_at: '2026-10-27T12:00:00Z' }] });
    assert.equal((await db('notes').first()).content, remote.content);
    await db('sync_logs').update({ synced: 1 });
    await applyNotePull(db, { notes: [{ ...remote, content: 'Synced authoritative text' }] });
    assert.equal((await db('notes').first()).content, 'Synced authoritative text');
});

test('pending deletions are not resurrected and pending edits survive remote deletion', async () => {
    await queueLocal();
    const sync_logs = [{ table_name: 'notes', record_key: 'n1', action: 'deleted' }];
    await applyNotePull(db, { sync_logs });
    assert.equal((await db('notes').first()).content, local.content);
    await removeNote(db, logSyncChange, 'n1');
    await applyNotePull(db, { notes: [remote] });
    assert.equal(await db('notes').first(), undefined);
});

test('queue write failures roll back note saves and deletions', async () => {
    const rejectLog = async () => { throw new Error('Queue write failed'); };
    await assert.rejects(saveNote(db, rejectLog, local), /Queue write/);
    assert.equal(await db('notes').first(), undefined);
    await db('notes').insert(local);
    await assert.rejects(removeNote(db, rejectLog, 'n1'), /Queue write/);
    assert.equal((await db('notes').first()).content, local.content);
});

test('a failed pulled note rolls back earlier notes in that page', async () => {
    await db('notes').insert([local, { ...local, note_id: 'n2' }]);
    await db.raw("CREATE TRIGGER reject_note BEFORE UPDATE ON notes WHEN NEW.content = 'fail' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END");
    await assert.rejects(applyNotePull(db, { notes: [remote, { ...remote, note_id: 'n2', content: 'fail' }] }), /fixture failure/);
    assert.equal((await db('notes').where({ note_id: 'n1' }).first()).content, local.content);
});
