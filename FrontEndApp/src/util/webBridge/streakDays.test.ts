import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStreakBridge } from './streakDays.ts';

test('a failed devotional refresh is distinguishable from an empty history', async () => {
    const bridge = createStreakBridge(async (_path, fallback) => fallback);
    await assert.rejects(bridge.getDevotionDays(), /Could not load devotion days/);
    assert.equal(await bridge.markDevotionToday(), null);
});

test('a successful empty history remains a valid empty result', async () => {
    const bridge = createStreakBridge(async <T>() => ({ data: [] }) as T);
    assert.deepEqual(await bridge.getDevotionDays(), []);
});

test('server dates retain their exact calendar keys', async () => {
    const bridge = createStreakBridge(async <T>() => ({ data: [{ day: '2026-09-21' }] }) as T);
    assert.deepEqual(await bridge.getDevotionDays(), [{ day: '2026-09-21' }]);
});

test('completion posts the local calendar day and waits for success', async () => {
    let body = '';
    const bridge = createStreakBridge(async <T>(_path: string, _fallback: T, options?: RequestInit) => {
        body = String(options?.body);
        return { status: 'success' } as T;
    });
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    assert.equal(await bridge.markDevotionToday(), expected);
    assert.deepEqual(JSON.parse(body), { day: expected });
});
