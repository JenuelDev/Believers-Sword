import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNoteSaveQueue, type NoteDraft } from './noteSaveQueue.ts';

const note = (content = 'Local edit'): NoteDraft => ({ id: 'n1', title: 'Title', content, created_at: '2026-10-26T12:00:00Z', updated_at: '2026-10-26T12:00:00Z' });
function storage() {
    const values = new Map<string, string>();
    return { getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
        removeItem: (key: string) => { values.delete(key); } };
}

test('failed saves remain dirty and survive reload until a confirmed retry', async () => {
    const disk = storage();
    let error = '';
    const first = createNoteSaveQueue({ key: 'user-1', storage: disk,
        write: async () => { throw new Error('Offline'); }, onError: (value) => { error = value; } });
    first.stage(note());
    assert.equal(await first.flush(), false);
    assert.equal(first.isDirty(note()), true);
    assert.ok(error);
    assert.equal(first.mergeRemote([])[0].content, 'Local edit');
    const restored = createNoteSaveQueue({ key: 'user-1', storage: disk, write: async () => ({ success: true }) });
    assert.equal(restored.pendingNotes[0].content, 'Local edit');
    assert.equal(await restored.flush(), true);
    assert.equal(restored.isDirty(note()), false);
    assert.equal(disk.getItem('user-1'), null);
});

test('drafts are scoped to the account and do not hide unrelated remote notes', () => {
    const disk = storage();
    const one = createNoteSaveQueue({ key: 'user-1', storage: disk, write: async () => ({ success: true }) });
    one.stage(note());
    const two = createNoteSaveQueue({ key: 'user-2', storage: disk, write: async () => ({ success: true }) });
    assert.deepEqual(two.pendingNotes, []);
    assert.equal(one.mergeRemote([{ ...note('Remote'), id: 'n2' }]).length, 2);
});

test('a failure result cannot seed the saved snapshot', async () => {
    const queue = createNoteSaveQueue({ key: 'test', write: async () => ({ success: false }) });
    queue.stage(note());
    assert.equal(await queue.flushOne('n1'), false);
    assert.equal(queue.pendingNotes.length, 1);
    assert.equal(queue.isDirty(note()), true);
});

test('writes for a note are serialized and an older response cannot mark a newer edit saved', async () => {
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const writes: string[] = [];
    const queue = createNoteSaveQueue({ key: 'test', write: async (value) => {
        writes.push(value.content);
        if (writes.length === 1) await waiting;
        return { success: true };
    } });
    queue.stage(note('First'));
    const first = queue.flushOne('n1');
    queue.stage(note('Second'));
    assert.equal(queue.flushOne('n1'), first);
    release();
    assert.equal(await first, true);
    assert.deepEqual(writes, ['First', 'Second']);
    assert.equal(queue.isDirty(note('Second')), false);
});

test('an edit completing during a remote read is preserved even after upload', async () => {
    const queue = createNoteSaveQueue({ key: 'test', write: async () => ({ success: true }) });
    queue.stage(note());
    const reading = queue.captureRead();
    await queue.flush();
    assert.equal(queue.mergeRemote([note('Old server content')], reading)[0].content, 'Local edit');
    assert.equal(queue.mergeRemote([note('New server content')])[0].content, 'New server content');
});

test('edits and deletions made after a remote read started beat that stale read', async () => {
    const queue = createNoteSaveQueue({ key: 'test', write: async () => ({ success: true }) });
    queue.mergeRemote([note('Original')]);
    const reading = queue.captureRead();
    queue.stage(note('Edited while loading'));
    await queue.flush();
    assert.equal(queue.mergeRemote([note('Original')], reading)[0].content, 'Edited while loading');
    const beforeDeletion = queue.captureRead();
    queue.discard('n1');
    assert.deepEqual(queue.mergeRemote([note('Old server content')], beforeDeletion), []);
});

test('recovered drafts are protected from reads that started before a retry completed', async () => {
    const disk = storage();
    disk.setItem('test', JSON.stringify([note()]));
    const queue = createNoteSaveQueue({ key: 'test', storage: disk, write: async () => ({ success: true }) });
    const reading = queue.captureRead();
    await queue.flush();
    assert.equal(queue.mergeRemote([], reading)[0].content, 'Local edit');
});

test('storage failures retain in-memory work and a successful write still recovers', async () => {
    let errors = 0;
    const queue = createNoteSaveQueue({ key: 'test', storage: { getItem: () => null,
        setItem: () => { throw new Error('Quota'); }, removeItem: () => {} },
        write: async () => ({ success: true }), onError: () => { errors++; } });
    queue.stage(note());
    assert.equal(queue.pendingNotes.length, 1);
    assert.equal(errors, 1);
    assert.equal(await queue.flush(), true);
});
