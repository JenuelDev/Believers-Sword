import { test } from 'node:test';
import assert from 'node:assert/strict';
import { healCursorOnce } from './cursorHeal.ts';

test('old healed devices perform one new full pull and then keep their cursor', async () => {
    const settings = new Map<string, unknown>([['cursor_heal_v1', true]]);
    let cursor = 'old cursor';
    const bridge = {
        getSyncSetting: async (key: string) => settings.get(key),
        setSyncSetting: async (key: string, value: unknown) => { settings.set(key, value); },
        updateLastSyncTimestamp: async (value: string) => { cursor = value; },
    };
    await healCursorOnce(bridge);
    assert.equal(cursor, '0');
    cursor = 'new successful cursor';
    await healCursorOnce(bridge);
    assert.equal(cursor, 'new successful cursor');
});

test('a failed cursor reset remains retryable', async () => {
    let marked = false;
    await assert.rejects(healCursorOnce({
        getSyncSetting: async () => null,
        updateLastSyncTimestamp: async () => { throw new Error('Disk error'); },
        setSyncSetting: async () => { marked = true; },
    }), /Disk error/);
    assert.equal(marked, false);
});
