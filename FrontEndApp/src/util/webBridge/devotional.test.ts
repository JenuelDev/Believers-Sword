import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDevotionalBridge } from './devotional.ts';

// Desktop and mobile pick today's devotion from the device clock. The server
// runs on UTC, so the web build must say which timezone "today" is in.
function capturePath(): { paths: string[]; apiFetch: <T>(path: string, fallback: T) => Promise<T> } {
    const paths: string[] = [];
    return { paths, apiFetch: async <T>(path: string, fallback: T) => { paths.push(path); return fallback; } };
}

function query(path: string): URLSearchParams {
    return new URL(path, 'http://api.test').searchParams;
}

test("today's devotional is requested for the browser's timezone", async () => {
    const { paths, apiFetch } = capturePath();
    const bridge = createDevotionalBridge(apiFetch, () => 'Asia/Manila');

    await bridge.getTodayDevotional('ko');

    assert.equal(query(paths[0]).get('lang'), 'ko');
    assert.equal(query(paths[0]).get('tz'), 'Asia/Manila');
});

test('an unreported browser timezone leaves the server default in place', async () => {
    const { paths, apiFetch } = capturePath();
    const bridge = createDevotionalBridge(apiFetch, () => undefined);

    await bridge.getTodayDevotional('en');

    assert.equal(query(paths[0]).has('tz'), false);
});
