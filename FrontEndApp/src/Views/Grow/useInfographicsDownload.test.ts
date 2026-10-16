import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectScope, watch } from 'vue';
import { createInfographicsDownload } from './useInfographicsDownload.ts';

test('a download and card progress survive page scope removal without starting another job', async () => {
    let requests = 0;
    let reads = 0;
    let subscriptions = 0;
    let progress: (value: { percent: number | null; phase: string }) => void = () => {};
    const item = { title: 'Timeline', category: 'The Bible', fileName: 'The Bible/Timeline.png', size: 4,
        isPdf: false, url: 'infographics://collection/The%20Bible/Timeline.png' };
    let complete!: (value: { success: boolean; resources: typeof item[] }) => void;
    const response = new Promise<{ success: boolean; resources: typeof item[] }>(resolve => { complete = resolve; });
    const state = createInfographicsDownload({
        listInfographics: async () => { reads++; return []; },
        downloadInfographics: () => { requests++; return response; },
        onInfographicsProgress: callback => { subscriptions++; progress = callback; return () => {}; },
    });
    await state.initialize();
    const job = state.start();
    assert.equal(job, state.start());
    await Promise.resolve();
    const page = effectScope();
    let observed = 0;
    page.run(() => watch(state.percent, () => { observed++; }, { flush: 'sync' }));
    progress({ percent: 0.42, phase: 'Downloading' });
    assert.equal(observed, 1);
    page.stop();
    progress({ percent: 0.63, phase: 'Downloading' });
    assert.equal(observed, 1);
    assert.equal(state.percent.value, 0.63);
    assert.equal(state.busy.value, true);
    await state.initialize();
    assert.equal(requests, 1);
    assert.equal(reads, 1);
    assert.equal(subscriptions, 1);
    complete({ success: true, resources: [item] });
    await job;
    assert.equal(state.busy.value, false);
    assert.equal(state.resources.value.length, 1);
    assert.equal(state.percent.value, 1);
    state.dispose();
});

test('failure remains visible after page navigation and retry starts a new job', async () => {
    let attempts = 0;
    const state = createInfographicsDownload({
        listInfographics: async () => [],
        downloadInfographics: async () => ++attempts === 1
            ? { success: false, error: 'Connection lost.' }
            : { success: true, resources: [] },
        onInfographicsProgress: () => () => {},
    });
    await state.start();
    assert.match(state.error.value, /Connection lost/);
    assert.equal(state.busy.value, false);
    await state.initialize();
    assert.match(state.error.value, /Connection lost/);
    await state.start();
    assert.equal(state.error.value, '');
    assert.equal(attempts, 2);
    state.dispose();
});
