import { markdownToHtml } from '../../../util/NoteTransfer/markdown';
import { sanitizeNoteHtml } from '../../../util/NoteTransfer/sanitize';
import type { BibleAnswer } from './bibleQuestions';

/**
 * Markdown and HTML answers become sanitized HTML (no scripts, images or
 * unsafe links), matching the mobile reader. Plain text returns null so the
 * caller renders it literally.
 */
export function answerHtml(answer: BibleAnswer): string | null {
    if (answer.type === 'txt') return null;
    return sanitizeNoteHtml(answer.type === 'md' ? markdownToHtml(answer.answer) : answer.answer);
}

export function isSafeLink(url: string | null | undefined): url is string {
    return Boolean(url && /^(https?:|mailto:)/i.test(url.trim()));
}
