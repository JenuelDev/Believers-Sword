const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const knex = require('knex');
const {
    assertBibleQuestionsSchema, bibleQuestionAnswers, bibleQuestionCategories, bibleQuestionPage, openBibleQuestionsDb,
} = require('../../dist/Grow/bibleQuestionsQueries.js');

const folder = path.join(__dirname, '..', '..', 'contents', 'grow', 'questions');
const openShipped = () => openBibleQuestionsDb(path.join(folder, 'questions.db'));

test('the shipped export matches its sidecar, is read-only and answers every question', async () => {
    const db = openShipped();
    try {
        await assertBibleQuestionsSchema(db);
        const sidecar = require(path.join(folder, 'version.json'));
        const page = await bibleQuestionPage(db, { limit: 100 });
        assert.equal(page.total, sidecar.count);
        for (const question of page.questions) {
            const answers = await bibleQuestionAnswers(db, question.id);
            assert.equal(answers.length, question.answer_count);
            assert.ok(answers.every(answer => ['md', 'html', 'txt'].includes(answer.type)));
        }
        const categories = await bibleQuestionCategories(db);
        assert.deepEqual(categories, [...categories].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
        const filtered = await bibleQuestionPage(db, { category: categories[0], limit: 100 });
        assert.ok(filtered.total > 0);
        assert.ok(filtered.questions.every(question => question.category === categories[0]));
        await assert.rejects(db('questions').del(), /readonly/);
        const missing = openBibleQuestionsDb(path.join(folder, 'missing.db'));
        await assert.rejects(assertBibleQuestionsSchema(missing));
        await missing.destroy();
        assert.equal(require('node:fs').existsSync(path.join(folder, 'missing.db')), false);
    } finally {
        await db.destroy();
    }
});

test('paging is bounded, search is literal and references stay under their answer', async () => {
    const shipped = openShipped();
    const db = knex({ client: 'sqlite3', useNullAsDefault: true, connection: { filename: ':memory:' } });
    try {
        const tables = await shipped('sqlite_master')
            .whereIn('name', ['metadata', 'questions', 'answers', 'answer_references'])
            .andWhere('type', 'table').select('name', 'sql');
        for (const name of ['metadata', 'questions', 'answers', 'answer_references']) {
            await db.raw(tables.find(table => table.name === name).sql);
        }
        await db('metadata').insert([{ key: 'schema_version', value: 3 }, { key: 'content_version', value: 1 }]);
        const now = '2026-10-23T00:00:00Z';
        const titles = ['100%?', 'A_B?', 'A\\B?', ...Array.from({ length: 40 }, (_, i) => `Question ${String(i).padStart(2, '0')}?`)];
        for (const [index, question] of titles.entries()) {
            await db('questions').insert({ question, category: index < 3 ? '' : 'Faith', created_at: now, updated_at: now });
        }
        const [answerId] = await db('answers').insert({ question_id: 4, answer: 'Body', type: 'md', position: 0, created_at: now, updated_at: now });
        await db('answers').insert({ question_id: 4, answer: 'Second', type: 'txt', position: 1, created_at: now, updated_at: now });
        await db('answer_references').insert([
            { answer_id: answerId, title: 'Second source', url: 'https://example.com/2', position: 1 },
            { answer_id: answerId, title: 'First source', url: 'https://example.com/1', position: 0 },
        ]);

        await assertBibleQuestionsSchema(db);
        for (const search of ['%', '_', '\\']) {
            assert.equal((await bibleQuestionPage(db, { search })).total, 1);
        }
        assert.equal((await bibleQuestionPage(db, { search: 'question 0' })).total, 10);
        assert.equal((await bibleQuestionPage(db, { search: 'question', category: 'Faith' })).total, 40);
        const first = await bibleQuestionPage(db, { limit: 1000 });
        assert.equal(first.questions.length, 43);
        assert.equal((await bibleQuestionPage(db, { offset: 40, limit: 30 })).questions.length, 3);
        assert.equal((await bibleQuestionPage(db, { offset: -5, limit: 0 })).questions.length, 1);
        assert.deepEqual(await bibleQuestionCategories(db), ['Faith']);

        const answers = await bibleQuestionAnswers(db, 4);
        assert.deepEqual(answers.map(answer => answer.answer), ['Body', 'Second']);
        assert.deepEqual(answers[0].references.map(reference => reference.title), ['First source', 'Second source']);
        assert.deepEqual(answers[1].references, []);
        assert.deepEqual(await bibleQuestionAnswers(db, 999), []);

        await db('metadata').where({ key: 'schema_version' }).update({ value: 2 });
        await assert.rejects(assertBibleQuestionsSchema(db), /Unsupported Bible Questions database/);
    } finally {
        await shipped.destroy();
        await db.destroy();
    }
});
