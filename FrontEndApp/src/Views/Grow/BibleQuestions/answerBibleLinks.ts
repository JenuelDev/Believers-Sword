import type { BiblePassageMatch } from '../../../util/biblePassageReference';

/** Add render-only links to sanitized text nodes, preserving authored markup. */
export function linkifyBibleAnswerHtml(html: string, findCitations: (text: string) => BiblePassageMatch[]): string {
    const template = document.createElement('template');
    template.innerHTML = html;
    const skip = new Set(['A', 'CODE', 'PRE', 'SCRIPT', 'STYLE']);
    function visit(parent: Node) {
        for (const child of Array.from(parent.childNodes)) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                if (!skip.has((child as Element).tagName)) visit(child);
                continue;
            }
            if (child.nodeType !== Node.TEXT_NODE) continue;
            const text = child.textContent ?? '';
            const matches = findCitations(text);
            if (!matches.length) continue;
            const fragment = document.createDocumentFragment();
            let offset = 0;
            for (const match of matches) {
                fragment.append(document.createTextNode(text.slice(offset, match.start)));
                const anchor = document.createElement('a');
                anchor.href = 'https://www.biblegateway.com/passage/?' + new URLSearchParams({ search: match.reference.label });
                anchor.textContent = text.slice(match.start, match.end);
                fragment.append(anchor);
                offset = match.end;
            }
            fragment.append(document.createTextNode(text.slice(offset)));
            parent.replaceChild(fragment, child);
        }
    }
    visit(template.content);
    return template.innerHTML;
}
