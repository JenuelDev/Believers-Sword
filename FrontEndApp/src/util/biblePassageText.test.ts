import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bibleBooks } from './books.ts';
import { createBiblePassageParser } from './biblePassageReference.ts';

const parser = createBiblePassageParser(bibleBooks);

test('finds the reported prose citations with punctuation and complete verse ranges', () => {
    const text = 'Read (Exodus 21:26\u201327), Matthew 19:8, 1 Timothy 1:10, Philemon 1:16 and John 7:53-8:11.';
    const found = parser.findInText(text);
    assert.deepEqual(found.map(m => m.reference.label), ['Exodus 21:26-27', 'Matthew 19:8', '1 Timothy 1:10', 'Philemon 1:16', 'John 7:53-8:11']);
    assert.deepEqual(found.map(m => text.slice(m.start, m.end)), ['Exodus 21:26\u201327', 'Matthew 19:8', '1 Timothy 1:10', 'Philemon 1:16', 'John 7:53-8:11']);
});

test('aliases and ordinal forms work in sentences, and repeated scans are independent', () => {
    const text = 'Read Ps. 23:1; II Timothy 3:16 and Song of Songs 2:1.';
    const expected = ['Psalms 23:1', '2 Timothy 3:16', 'Song of Solomon 2:1'];
    assert.deepEqual(parser.findInText(text).map(m => m.reference.label), expected);
    assert.deepEqual(parser.findInText(text).map(m => m.reference.label), expected);
    assert.deepEqual(parser.findInText('1Cor. 13:4-7').map(m => m.reference.label), ['1 Corinthians 13:4-7']);
});

test('invalid references, embedded names and unsupported lists never become partial links', () => {
    const text = 'John 3:16,18; John 0:1; John 3:17-16; NotJohn 3:16; John 3:1600; John 3:16-9999.';
    assert.deepEqual(parser.findInText(text), []);
    assert.deepEqual(parser.findInText('An ordinary sentence without citations.'), []);
});
