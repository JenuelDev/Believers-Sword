import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ref } from 'vue';
import { useDevotionCompletion } from './useDevotionCompletion.ts';

test('a completion pulled after mount immediately finishes the screen', () => {
    const completed = ref(false);
    const state = useDevotionCompletion(() => completed.value, async () => true);
    assert.equal(state.finished.value, false);
    completed.value = true;
    assert.equal(state.finished.value, true);
    state.readAgain();
    assert.equal(state.finished.value, false);
});

test('failed persistence stays unfinished and can be retried', async () => {
    const completed = ref(false);
    let succeeds = false;
    const state = useDevotionCompletion(() => completed.value, async () => {
        completed.value = succeeds;
        return succeeds;
    });
    await state.finishDevotion();
    assert.equal(state.finished.value, false);
    assert.ok(state.saveError.value);
    succeeds = true;
    await state.finishDevotion();
    assert.equal(state.finished.value, true);
    assert.equal(state.saveError.value, '');
    state.readAgain();
    await state.finishDevotion();
    assert.equal(state.finished.value, true);
});

test('waits for persistence and suppresses duplicate Finish requests', async () => {
    const completed = ref(false);
    let calls = 0;
    let resolve!: (value: boolean) => void;
    const state = useDevotionCompletion(() => completed.value, () => {
        calls++;
        return new Promise<boolean>((done) => { resolve = done; });
    });
    const pending = state.finishDevotion();
    await state.finishDevotion();
    assert.equal(calls, 1);
    assert.equal(state.saving.value, true);
    assert.equal(state.finished.value, false);
    completed.value = true;
    resolve(true);
    await pending;
    assert.equal(state.finished.value, true);
    assert.equal(state.saving.value, false);
});

test('a rejected write leaves a retryable error', async () => {
    const state = useDevotionCompletion(() => false, async () => {
        throw new Error('offline');
    });
    await state.finishDevotion();
    assert.equal(state.finished.value, false);
    assert.equal(state.saving.value, false);
    assert.ok(state.saveError.value);
});
