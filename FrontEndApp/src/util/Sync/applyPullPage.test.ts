import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPullPage } from './applyPullPage.ts';

test('rejected or failed local writes leave the cursor untouched', async () => {
    let cursor = 'previous';
    const page = { has_more: false, last_sync_timestamp: 'new' };
    const updateLastSyncTimestamp = async (value: string) => { cursor = value; };
    await assert.rejects(applyPullPage({ applyPullData: async () => ({ success: false, error: 'Disk full' }), updateLastSyncTimestamp }, page), /Disk full/);
    await assert.rejects(applyPullPage({ applyPullData: async () => { throw new Error('SQLite error'); }, updateLastSyncTimestamp }, page), /SQLite/);
    assert.equal(cursor, 'previous');
});

test('only a persisted final page advances the cursor', async () => {
    let cursor = 'previous';
    const bridge = { applyPullData: async () => ({ success: true }), updateLastSyncTimestamp: async (value: string) => { cursor = value; } };
    await applyPullPage(bridge, { has_more: true, last_sync_timestamp: 'ignored' });
    assert.equal(cursor, 'previous');
    await applyPullPage(bridge, { has_more: false, last_sync_timestamp: 'new' });
    assert.equal(cursor, 'new');
});

test('protected pending edits keep the cursor retryable until upload', async () => {
    let cursor = 'previous';
    let pending = true;
    const bridge = { applyPullData: async () => ({ success: true, hasPendingChanges: pending }),
        updateLastSyncTimestamp: async (value: string) => { cursor = value; } };
    const page = { has_more: false, last_sync_timestamp: 'new' };
    await applyPullPage(bridge, page);
    assert.equal(cursor, 'previous');
    pending = false;
    await applyPullPage(bridge, page);
    assert.equal(cursor, 'new');
});
