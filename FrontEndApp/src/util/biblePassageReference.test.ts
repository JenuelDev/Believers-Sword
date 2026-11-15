import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { bibleBooks } from './books.ts';
import { createBiblePassageParser } from './biblePassageReference.ts';

const parser = createBiblePassageParser(bibleBooks);

test('citations normalize names, ordinals, aliases, translation suffixes and cross-chapter ranges', () => {
    for (const [input, label] of [
        ['Galatians 1:18-19 (KJV)', 'Galatians 1:18-19'],
        ['Luke 1:1-4', 'Luke 1:1-4'],
        ['II John 1:3', '2 John 1:3'],
        ['1st Samuel 3:1', '1 Samuel 3:1'],
        ['1Cor. 13:4-7', '1 Corinthians 13:4-7'],
        ['Psalm 23:1', 'Psalms 23:1'],
        ['Song of Songs 2:1', 'Song of Solomon 2:1'],
        ['John 7:53-8:11', 'John 7:53-8:11'],
        ['John 3:16\u201317', 'John 3:16-17'],
    ]) assert.equal(parser.parse(input)?.label, label, input);
});

test('malformed, reversed and ambiguous passages are not reduced to partial ranges', () => {
    for (const value of ['John 0:1', 'John 22:1', 'John 3:0', 'John 3:17-16', 'John 8:1-7:53',
        'John 3', 'John 3:16,18', 'John 3:16; Romans 1:1', 'Unknown 1:1', 'Read John 3:16']) {
        assert.equal(parser.parse(value), null, value);
    }
});

test('trusted query wins over title and its translation never determines the selected module', () => {
    assert.equal(parser.fromLink('https://www.biblegateway.com/passage/?search=Luke+1%3A1-4&version=KJV', 'John 3:16')?.label, 'Luke 1:1-4');
    assert.equal(parser.fromLink('https://www.biblegateway.com/passage/?search=John+3%3A16%2C18', 'John 3:16'), null);
    assert.equal(parser.fromLink('https://biblegateway.com.evil.test/?search=John+3%3A16'), null);
    assert.equal(parser.fromLink('https://example.com/article', 'Was Jesus real?'), null);
    assert.equal(parser.fromLink('https://example.com/source', 'Galatians 1:18-19 (KJV)')?.label, 'Galatians 1:18-19');
    assert.equal(parser.fromLink('mailto:someone@example.com'), null);
});

test('every shipped BibleGateway reference is supported', () => {
    const database = new DatabaseSync(fileURLToPath(new URL('../../../contents/grow/questions/questions.db', import.meta.url)), { readOnly: true });
    try {
        const rows = database.prepare('SELECT title, url FROM answer_references').all() as { title: string; url: string }[];
        const citations = rows.filter(row => /biblegateway\.com/.test(row.url));
        assert.ok(citations.length > 100);
        for (const citation of citations) assert.ok(parser.fromLink(citation.url, citation.title), JSON.stringify(citation));
    } finally { database.close(); }
});
