import { markdownToHtml } from '../../../util/NoteTransfer/markdown';
import { escapeHtml, sanitizeNoteHtml } from '../../../util/NoteTransfer/sanitize';
import { bibleBooks } from '../../../util/books';
import { createBiblePassageParser } from '../../../util/biblePassageReference';
import { linkifyBibleAnswerHtml } from './answerBibleLinks';
import type { BibleAnswer } from './bibleQuestions';

/**
 * Markdown and HTML answers become sanitized HTML (no scripts, images or
 * unsafe links), matching the mobile reader. Plain text stays escaped/literal.
 * Prose citations become links to the existing in-app passage overlay.
 */
export function answerHtml(answer: BibleAnswer): string | null {
    if (answer.type === 'txt' && !passages.findInText(answer.answer).length) return null;
    const html = answer.type === 'txt' ? escapeHtml(answer.answer).replace(/\r?\n/g, '<br>')
        : sanitizeNoteHtml(answer.type === 'md' ? markdownToHtml(answer.answer) : answer.answer);
    return linkifyBibleAnswerHtml(html, passages.findInText);
}

const passages = createBiblePassageParser(bibleBooks);

export function isSafeLink(url: string | null | undefined): url is string {
    return Boolean(url && /^(https?:|mailto:)/i.test(url.trim()));
}
