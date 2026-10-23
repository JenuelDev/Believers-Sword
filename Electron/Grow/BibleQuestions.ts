import { app, ipcMain } from 'electron';
import type { Knex } from 'knex';
import path from 'path';
import Log from 'electron-log';
import {
    assertBibleQuestionsSchema,
    bibleQuestionAnswers,
    bibleQuestionCategories,
    bibleQuestionPage,
    openBibleQuestionsDb,
    type BibleQuestionPageArgs,
} from './bibleQuestionsQueries';

/**
 * The Questions Manager exports straight into contents/grow/questions, which
 * electron-builder ships as the `questions` extra resource. The app only reads
 * it, so it is opened read-only in place: an app update brings new content.
 */
function databasePath(): string {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'questions', 'questions.db')
        : path.resolve('contents', 'grow', 'questions', 'questions.db');
}

let opening: Promise<Knex> | null = null;

function database(): Promise<Knex> {
    opening ??= (async () => {
        const db = openBibleQuestionsDb(databasePath());
        try {
            await assertBibleQuestionsSchema(db);
            return db;
        } catch (error) {
            await db.destroy();
            throw error;
        }
    })().catch(error => {
        // Let the next request retry instead of caching the failure.
        opening = null;
        Log.error('Bible Questions database unavailable:', error);
        throw error;
    });
    return opening;
}

export function BibleQuestionsEvents(): void {
    ipcMain.handle('bibleQuestions:categories', async () => bibleQuestionCategories(await database()));
    ipcMain.handle('bibleQuestions:page', async (_event, args: BibleQuestionPageArgs) =>
        bibleQuestionPage(await database(), args ?? {}));
    ipcMain.handle('bibleQuestions:answers', async (_event, questionId: number) =>
        bibleQuestionAnswers(await database(), questionId));
}
