import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCrossReferenceState } from './crossReferencesStore.ts';
import type { CrossReferencePage, CrossReferenceRequest } from '../util/crossReferences';

function page(offset = 0, total = 1000): CrossReferencePage {
    return {
        total,
        groups: [{ book_number: 10, count: total }],
        references: Array.from({ length: Math.min(24, total - offset) }, (_, index) => ({
            id: offset + index + 1, to_book: 10, to_chapter: 1,
            to_verse_start: offset + index + 1, to_verse_end: offset + index + 1,
            votes: 3, texts: [{ version: 'KJV.SQLite3', text: `Verse ${offset + index + 1}` }],
        })),
    };
}

function deferred() {
    let resolve!: (page: CrossReferencePage) => void;
    const promise = new Promise<CrossReferencePage>(done => { resolve = done; });
    return { promise, resolve };
}

test('thousands of references load only one requested page at a time', async () => {
    const calls: CrossReferenceRequest[] = [];
    const state = createCrossReferenceState(async args => { calls.push(args); return page(args.offset); });
    await state.fetchReferences(10, 1, 1, ['KJV.SQLite3']);
    assert.equal(calls.length, 1);
    assert.equal(state.references.value.length, 24);
    assert.equal(state.total.value, 1000);
    const loading = state.loadMore();
    assert.equal(state.loadMore(), loading);
    await loading;
    assert.equal(calls.length, 2);
    assert.equal(calls[1].offset, 24);
    assert.equal(state.references.value.length, 48);
});

test('an old verse response cannot replace the new verse or its loading state', async () => {
    const old = deferred();
    const current = deferred();
    const state = createCrossReferenceState(args => args.verse === 1 ? old.promise : current.promise);
    const first = state.fetchReferences(10, 1, 1, ['KJV.SQLite3']);
    const second = state.fetchReferences(10, 1, 2, ['KJV.SQLite3']);
    old.resolve(page(0, 3));
    await first;
    assert.equal(state.references.value.length, 0);
    assert.equal(state.isLoading.value, true);
    current.resolve(page(0, 5));
    await second;
    assert.equal(state.references.value.length, 5);
    assert.equal(state.isLoading.value, false);
});

test('changing translations resets and reloads verse text', async () => {
    const calls: CrossReferenceRequest[] = [];
    const state = createCrossReferenceState(async args => { calls.push(args); return page(0, 2); });
    await state.fetchReferences(10, 1, 1, ['KJV.SQLite3']);
    await state.fetchReferences(10, 1, 1, ['KJV.SQLite3']);
    assert.equal(calls.length, 1);
    await state.fetchReferences(10, 1, 1, ['NASB.SQLite3']);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].bible_versions, ['NASB.SQLite3']);
    assert.equal(calls[1].offset, 0);
});

test('a failed page preserves earlier cards and retries the same offset', async () => {
    let fail = true;
    const offsets: number[] = [];
    const state = createCrossReferenceState(async args => {
        offsets.push(args.offset!);
        if (args.offset === 24 && fail) throw new Error('Offline');
        return page(args.offset, 27);
    });
    await state.fetchReferences(10, 1, 1, ['KJV.SQLite3']);
    await state.loadMore();
    assert.equal(state.error.value, 'Offline');
    assert.equal(state.references.value.length, 24);
    fail = false;
    await state.loadMore();
    assert.deepEqual(offsets, [0, 24, 24]);
    assert.equal(state.references.value.length, 27);
    assert.equal(state.error.value, '');
    assert.equal(state.hasMore.value, false);
    await state.loadMore();
    assert.equal(offsets.length, 3);
});

test('clearing an in-flight list discards its eventual response', async () => {
    const pending = deferred();
    const state = createCrossReferenceState(() => pending.promise);
    const loading = state.fetchReferences(10, 1, 1, []);
    state.clear();
    pending.resolve(page());
    await loading;
    assert.equal(state.references.value.length, 0);
    assert.equal(state.isLoading.value, false);
    assert.equal(state.currentKey.value, '');
});
