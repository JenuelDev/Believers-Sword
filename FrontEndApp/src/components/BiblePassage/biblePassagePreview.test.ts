import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBiblePassagePreview, loadBiblePassage, type PassageSelection } from './biblePassagePreview.ts';

function selection(overrides: Partial<PassageSelection> = {}): PassageSelection {
    return {
        reference: { book: { title: 'John', short_name: 'John', book_number: 500, chapter_count: 21 },
            chapter: 3, startVerse: 16, endChapter: 3, endVerse: 17, label: 'John 3:16-17' },
        version: 'primary.SQLite3', versionLabel: 'Primary', fontSize: 19, fontFamily: 'Georgia', ...overrides,
    };
}
function row(chapter: number, verse: number, text = `verse ${verse}`) {
    return { book_number: 500, chapter, verse, version: [{ version: 'secondary.SQLite3', text: 'wrong translation' },
        { version: 'primary.SQLite3', text }] };
}

test('loads only the captured primary version and inclusive verses from sparse chapter rows', async () => {
    const calls: unknown[] = [];
    const sparse: any[] = [];
    sparse[14] = row(3, 15);
    sparse[15] = row(3, 16);
    sparse[16] = row(3, 17);
    sparse[17] = row(3, 18);
    const result = await loadBiblePassage(selection(), async (...args) => { calls.push(args); return sparse; });
    assert.deepEqual(calls, [['primary.SQLite3', 500, 3]]);
    assert.deepEqual(result, [{ chapter: 3, verse: 16, text: 'verse 16' }, { chapter: 3, verse: 17, text: 'verse 17' }]);
});

test('cross-chapter passages include each chapter once with inclusive endpoint bounds', async () => {
    const value = selection();
    value.reference = { ...value.reference, chapter: 7, startVerse: 53, endChapter: 8, endVerse: 11 };
    const chapters: number[] = [];
    const result = await loadBiblePassage(value, async (_, __, chapter) => {
        chapters.push(chapter);
        return chapter === 7 ? [row(7, 52), row(7, 53)] : Array.from({ length: 12 }, (_, index) => row(8, index + 1));
    });
    assert.deepEqual(chapters, [7, 8]);
    assert.deepEqual(result.map(item => [item.chapter, item.verse]), [[7, 53], ...Array.from({ length: 11 }, (_, i) => [8, i + 1])]);
});

test('missing translations and chapters cannot leak another translation or a partial chapter range', async () => {
    assert.deepEqual(await loadBiblePassage(selection(), async () => [{ ...row(3, 16), version: [{ version: 'other', text: 'wrong' }] }]), []);
    const value = selection();
    value.reference = { ...value.reference, endChapter: 4 };
    assert.deepEqual(await loadBiblePassage(value, async (_, __, chapter) => chapter === 3 ? [row(3, 16)] : []), []);
});

test('failed and empty passage loads remain retryable, preserving captured typography and version', async () => {
    let attempt = 0;
    const preview = createBiblePassagePreview(async () => {
        if (++attempt === 1) throw new Error('offline');
        return attempt === 2 ? [] : [row(3, 16)];
    });
    const value = selection();
    await preview.open(value);
    value.version = 'changed-reader.SQLite3';
    assert.equal(preview.state.value, 'error');
    assert.equal(preview.selection.value?.version, 'primary.SQLite3');
    assert.equal(preview.selection.value?.fontSize, 19);
    await preview.retry();
    assert.equal(preview.state.value, 'empty');
    await preview.retry();
    assert.equal(preview.state.value, 'ready');
    assert.equal(preview.verses.value[0].text, 'verse 16');
});

test('closed and replaced requests cannot overwrite the current passage', async () => {
    let release: (rows: any[]) => void = () => {};
    let calls = 0;
    const preview = createBiblePassagePreview(() => ++calls === 1 ? new Promise(resolve => { release = resolve; }) : Promise.resolve([row(3, 17)]));
    const first = preview.open(selection());
    preview.close();
    await preview.open(selection());
    release([row(3, 16)]);
    await first;
    assert.equal(preview.state.value, 'ready');
    assert.equal(preview.verses.value[0].verse, 17);
    preview.close();
    assert.equal(preview.selection.value, null);
});

test('missing primary version shows a local state without any chapter request', async () => {
    const preview = createBiblePassagePreview(async () => { assert.fail('No translation selected'); });
    await preview.open(selection({ version: null }));
    assert.equal(preview.state.value, 'missing-version');
});
