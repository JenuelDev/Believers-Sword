import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNoteBridge } from './notes.ts';
import { createBibleVerseLoader } from './bibleVerseCache.ts';

test('JSON null is a successful note write but HTTP errors remain failures', async () => {
    const success = createNoteBridge(async <T>() => null as T);
    assert.deepEqual(await success.upsertNote({ note_id: 'n1', title: 'Title', content: '' }), { success: true });
    const failure = createNoteBridge(async () => { throw new Error('HTTP 503'); });
    await assert.rejects(failure.upsertNote({ note_id: 'n1', title: 'Title', content: 'Text' }), /503/);
    await assert.rejects(failure.getNotes(), /503/);
    await assert.rejects(failure.deleteNote({ note_id: 'n1' }), /503/);
});

test('a failed chapter request is evicted and can recover on the next visit', async () => {
    let calls = 0;
    const load = createBibleVerseLoader(async () => {
        calls++;
        if (calls === 1) throw new Error('Offline');
        return [{ verse: 1, text: 'Recovered' }];
    });
    const first = load('KJV', 10, 1);
    assert.equal(load('KJV', 10, 1), first);
    await assert.rejects(first, /Offline/);
    assert.equal((await load('KJV', 10, 1))[0].text, 'Recovered');
    await load('KJV', 10, 1);
    assert.equal(calls, 2);
});

test('successful empty chapters stay valid and versions have separate caches', async () => {
    let calls = 0;
    const load = createBibleVerseLoader(async () => { calls++; return []; });
    await load('One', 10, 1);
    await load('One', 10, 1);
    await load('Two', 10, 1);
    assert.equal(calls, 2);
});
