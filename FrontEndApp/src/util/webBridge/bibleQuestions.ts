import type {
    BibleAnswer,
    BibleQuestionPage,
    BibleQuestionPageArgs,
} from '../../Views/Grow/BibleQuestions/bibleQuestions';

type ApiFetch = <T>(path: string, fallback: T, options?: RequestInit) => Promise<T>;

/**
 * Browser Bible Questions read the backend's public /api/bible-questions
 * endpoints (the uploaded Questions Manager export); Electron reads the
 * bundled questions.db over IPC instead.
 */
export function createBibleQuestionBridge(apiFetch: ApiFetch): Pick<Window['browserWindow'],
    'getBibleQuestionCategories' | 'getBibleQuestionPage' | 'getBibleQuestionAnswers'> {
    return {
        getBibleQuestionCategories: async () => {
            const categories = await apiFetch<string[] | null>('/bible-questions/categories', null);
            return Array.isArray(categories) ? categories : [];
        },
        getBibleQuestionPage: async (args: BibleQuestionPageArgs) => {
            const params = new URLSearchParams({
                search: args.search,
                category: args.category,
                offset: String(args.offset),
                limit: String(args.limit),
            });
            const page = await apiFetch<BibleQuestionPage | null>(`/bible-questions?${params}`, null);
            if (!page || !Array.isArray(page.questions)) throw new Error('Could not load questions. Please retry.');
            return page;
        },
        getBibleQuestionAnswers: async (questionId: number) => {
            const answers = await apiFetch<BibleAnswer[] | null>(`/bible-questions/${questionId}/answers`, null);
            if (!Array.isArray(answers)) throw new Error('Could not load answers. Please retry.');
            return answers;
        },
    };
}
