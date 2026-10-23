import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerLabel, highlightSegments, referenceHost } from './bibleQuestions.ts';
import { createBibleQuestionList } from './useBibleQuestionList.ts';

type Args = { search: string; category: string; offset: number; limit: number };

const page = (offset: number, total: number) => ({
    questions: Array.from({ length: Math.max(0, Math.min(30, total - offset)) }, (_, index) => ({
        id: offset + index, question: `Question ${offset + index}?`, category: '', answer_count: 1,
    })),
    total,
});
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

test('highlight segments mark every case-insensitive match', () => {
    assert.deepEqual(highlightSegments('God loves; does god forgive?', ' god '), [
        { text: 'God', match: true },
        { text: ' loves; does ', match: false },
        { text: 'god', match: true },
        { text: ' forgive?', match: false },
    ]);
    assert.deepEqual(highlightSegments('Why pray?', ''), [{ text: 'Why pray?', match: false }]);
});

test('reference hosts drop www and fall back to the raw URL', () => {
    assert.equal(referenceHost('https://www.biblegateway.com/passage/?search=John+3'), 'biblegateway.com');
    assert.equal(referenceHost('https://youtu.be/abc'), 'youtu.be');
    assert.equal(referenceHost('not a url'), 'not a url');
});

test('answer labels only number multiple answers', () => {
    assert.equal(answerLabel(1, 1), 'Answer');
    assert.equal(answerLabel(2, 3), 'Answer 2 of 3');
});

test('the list pages to the end and keeps each filter when the other changes', async () => {
    const requests: Args[] = [];
    const list = createBibleQuestionList(async args => {
        requests.push(args);
        return page(args.offset, args.category ? 1 : 45);
    }, { debounceMs: 0 });
    await list.reset();
    assert.equal(list.questions.value.length, 30);
    await list.loadMore();
    assert.equal(list.questions.value.length, 45);
    assert.equal(list.hasMore.value, false);
    await list.loadMore();
    assert.equal(requests.length, 2);
    await list.reset({ category: 'Prayer' });
    await list.reset({ query: 'how' });
    assert.deepEqual(requests.slice(2).map(r => [r.search, r.category, r.offset]), [
        ['', 'Prayer', 0],
        ['how', 'Prayer', 0],
    ]);
    list.dispose();
});

test('stale responses are ignored and failed pages retry at the same offset', async () => {
    let releaseOld: (value: ReturnType<typeof page>) => void = () => {};
    let fail = false;
    const offsets: number[] = [];
    const list = createBibleQuestionList(args => {
        offsets.push(args.offset);
        if (args.search === 'old') return new Promise(resolve => { releaseOld = resolve; });
        if (fail) return Promise.reject(new Error('offline'));
        return Promise.resolve(page(args.offset, 40));
    }, { debounceMs: 0 });
    const old = list.reset({ query: 'old' });
    await list.reset({ query: 'new' });
    releaseOld(page(0, 999));
    await old;
    assert.equal(list.total.value, 40);
    fail = true;
    await list.loadMore();
    assert.ok(list.error.value);
    assert.equal(list.questions.value.length, 30);
    fail = false;
    await list.loadMore();
    assert.equal(list.error.value, null);
    assert.deepEqual(offsets.slice(-2), [30, 30]);
    assert.equal(list.questions.value.length, 40);
    list.dispose();
});

test('typing is debounced and disposal cancels a pending search', async () => {
    const searches: string[] = [];
    const list = createBibleQuestionList(async args => {
        searches.push(args.search);
        return page(0, 0);
    }, { debounceMs: 20 });
    void list.reset({ query: 'G', debounce: true });
    void list.reset({ query: 'God', debounce: true });
    assert.equal(list.loading.value, true);
    await tick(40);
    assert.deepEqual(searches, ['God']);
    void list.reset({ query: 'prayer', debounce: true });
    list.dispose();
    await tick(40);
    assert.deepEqual(searches, ['God']);
});
