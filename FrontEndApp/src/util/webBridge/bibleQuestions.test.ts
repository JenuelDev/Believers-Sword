import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBibleQuestionBridge } from './bibleQuestions.ts';

test('pages call the public endpoint with every filter encoded', async () => {
    const paths: string[] = [];
    const bridge = createBibleQuestionBridge(async <T>(path: string) => {
        paths.push(path);
        return { questions: [], total: 0 } as T;
    });
    await bridge.getBibleQuestionPage({ search: 'God & me', category: 'Faith and Reason', offset: 30, limit: 30 });
    assert.deepEqual(paths, ['/bible-questions?search=God+%26+me&category=Faith+and+Reason&offset=30&limit=30']);
});

test('answers and categories come from their own endpoints', async () => {
    const paths: string[] = [];
    const bridge = createBibleQuestionBridge(async <T>(path: string) => {
        paths.push(path);
        return (path.endsWith('/categories') ? ['God'] : [{ id: 1, answer: 'A', type: 'md', references: [] }]) as T;
    });
    assert.deepEqual(await bridge.getBibleQuestionCategories(), ['God']);
    assert.equal((await bridge.getBibleQuestionAnswers(5)).length, 1);
    assert.deepEqual(paths, ['/bible-questions/categories', '/bible-questions/5/answers']);
});

test('a failed page or answers request is an error, not an empty library', async () => {
    const bridge = createBibleQuestionBridge(async (_path, fallback) => fallback);
    await assert.rejects(
        bridge.getBibleQuestionPage({ search: '', category: '', offset: 0, limit: 30 }),
        /Could not load questions/,
    );
    await assert.rejects(bridge.getBibleQuestionAnswers(5), /Could not load answers/);
    // Categories are optional chips; an outage just hides them.
    assert.deepEqual(await bridge.getBibleQuestionCategories(), []);
});
