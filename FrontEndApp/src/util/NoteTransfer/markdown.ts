import TurndownService from 'turndown';
import { marked } from 'marked';

let turndown: TurndownService | null = null;

function getTurndown(): TurndownService {
    if (turndown) return turndown;
    turndown = new TurndownService({
        headingStyle: 'atx',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '*',
    });
    // Markdown has no underline; keep it as inline HTML so it survives re-import.
    turndown.addRule('underline', {
        filter: ['u'],
        replacement: (content) => `<u>${content}</u>`,
    });
    turndown.addRule('strike', {
        filter: (node) => ['S', 'DEL', 'STRIKE'].includes(node.nodeName),
        replacement: (content) => `~~${content}~~`,
    });
    return turndown;
}

export function htmlToMarkdown(title: string, html: string): string {
    const body = getTurndown().turndown(html || '');
    return `# ${title}\n\n${body}\n`;
}

export function markdownToHtml(markdown: string): string {
    return marked.parse(markdown, { async: false, gfm: true, breaks: false }) as string;
}
