import knex, { type Knex } from 'knex';
import { pathToFileURL } from 'url';

// Reads the Questions Manager export (scripts/questions in the mobile repo):
// schema v3 questions / answers / answer_references, same queries as the
// mobile BibleQuestionService.
export const BIBLE_QUESTIONS_SCHEMA = 3;

/**
 * knex ORs extra flags into READWRITE | CREATE, so read-only access goes
 * through a `mode=ro` URI instead. It also never creates a missing file.
 */
export function openBibleQuestionsDb(filename: string): Knex {
    return knex({
        client: 'sqlite3',
        useNullAsDefault: true,
        connection: { filename: `${pathToFileURL(filename).href}?mode=ro`, flags: ['OPEN_URI'] },
    });
}

export interface BibleQuestionSummary {
    id: number;
    question: string;
    category: string;
    answer_count: number;
}

export interface BibleAnswerReference {
    title: string;
    url: string;
}

export interface BibleAnswer {
    id: number;
    answer: string;
    type: 'md' | 'html' | 'txt';
    references: BibleAnswerReference[];
}

export interface BibleQuestionPageArgs {
    search?: string;
    category?: string;
    offset?: number;
    limit?: number;
}

/** Rejects an export made for another schema before any query runs. */
export async function assertBibleQuestionsSchema(db: Knex): Promise<void> {
    const row = await db('metadata').where({ key: 'schema_version' }).first('value');
    if (Number(row?.value) !== BIBLE_QUESTIONS_SCHEMA) {
        throw new Error('Unsupported Bible Questions database.');
    }
}

export async function bibleQuestionCategories(db: Knex): Promise<string[]> {
    const rows: { category: string }[] = await db('questions')
        .distinct('category')
        .whereRaw("trim(category) != ''")
        .orderByRaw('category COLLATE NOCASE');
    return rows.map(row => String(row.category));
}

/** Only titles, categories and answer counts are loaded while browsing. */
export async function bibleQuestionPage(db: Knex, args: BibleQuestionPageArgs) {
    const search = String(args.search ?? '').trim();
    const category = String(args.category ?? '');
    const offset = Math.max(0, Math.floor(Number(args.offset) || 0));
    const requested = Math.floor(Number(args.limit ?? 30));
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(100, requested)) : 30;
    const filtered = () => {
        const query = db('questions');
        if (search) {
            // Literal substring: escape LIKE wildcards and the escape character.
            query.whereRaw("question LIKE ? ESCAPE '\\'", [`%${search.replace(/[\\%_]/g, c => `\\${c}`)}%`]);
        }
        if (category) query.where('category', category);
        return query;
    };
    const [{ total }] = await filtered().count<{ total: number }[]>({ total: '*' });
    const rows: BibleQuestionSummary[] = await filtered()
        .select(
            'id',
            'question',
            'category',
            db.raw('(SELECT COUNT(*) FROM answers WHERE question_id = questions.id) AS answer_count')
        )
        .orderByRaw('question COLLATE NOCASE')
        .orderBy('id')
        .limit(limit)
        .offset(offset);
    return {
        questions: rows.map(row => ({
            id: Number(row.id),
            question: String(row.question),
            category: String(row.category ?? ''),
            answer_count: Number(row.answer_count),
        })),
        total: Number(total),
    };
}

/** Ordered answers with their ordered references, loaded when a question opens. */
export async function bibleQuestionAnswers(db: Knex, questionId: number): Promise<BibleAnswer[]> {
    const id = Math.floor(Number(questionId));
    const answers: Omit<BibleAnswer, 'references'>[] = await db('answers')
        .where({ question_id: id })
        .orderBy([{ column: 'position' }, { column: 'id' }])
        .select('id', 'answer', 'type');
    const references: (BibleAnswerReference & { answer_id: number })[] = await db('answer_references as r')
        .join('answers as a', 'a.id', 'r.answer_id')
        .where('a.question_id', id)
        .orderBy([{ column: 'a.position' }, { column: 'r.position' }, { column: 'r.id' }])
        .select('r.answer_id', 'r.title', 'r.url');
    const byAnswer = new Map<number, BibleAnswerReference[]>();
    for (const row of references) {
        const list = byAnswer.get(Number(row.answer_id)) ?? [];
        list.push({ title: String(row.title), url: String(row.url) });
        byAnswer.set(Number(row.answer_id), list);
    }
    return answers.map(answer => ({
        id: Number(answer.id),
        answer: String(answer.answer),
        type: answer.type,
        references: byAnswer.get(Number(answer.id)) ?? [],
    }));
}
