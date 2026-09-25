/**
 * Normalizes imported HTML down to the subset both note editors understand
 * (desktop TipTap and mobile Quill via `flutter_quill_delta_from_html`), so an
 * imported note renders and syncs identically on every platform.
 *
 * - Unknown tags are unwrapped (their text is kept).
 * - Images, scripts, styles and embeds are dropped (they bloat the sync payload).
 * - The only style kept is block indent as inline `padding-left: {level}em` —
 *   the exact format the Indent extension and the mobile editor round-trip.
 *   Never emit `ql-indent-N` classes; they do not survive mobile sync.
 */

const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'ul', 'ol', 'li', 'hr']);
const INLINE_TAGS = new Set(['strong', 'em', 'u', 's', 'a', 'br', 'code']);
const RENAME: Record<string, string> = { b: 'strong', i: 'em', strike: 's', del: 's', ins: 'u' };
const DROP = new Set(['script', 'style', 'img', 'svg', 'iframe', 'object', 'embed', 'video', 'audio', 'head', 'title', 'meta', 'link', 'noscript']);
const INDENT_TYPES = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const MAX_INDENT = 8;

function indentLevel(el: HTMLElement): number {
    const match = /([\d.]+)\s*em/.exec(el.style?.paddingLeft || el.style?.marginLeft || '');
    if (!match) return 0;
    return Math.max(0, Math.min(MAX_INDENT, Math.round(parseFloat(match[1]))));
}

function safeHref(href: string | null): string | null {
    if (!href) return null;
    return /^(https?:|mailto:)/i.test(href.trim()) ? href.trim() : null;
}

function cleanNode(node: Node, out: Node, doc: Document) {
    node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent ?? '';
            // Drop formatting whitespace between block tags (e.g. marked's newlines).
            const parentTag = (out as HTMLElement).tagName?.toLowerCase();
            if (!text.trim() && text.includes('\n') && (out.nodeName === 'BODY' || ['ul', 'ol', 'li', 'blockquote'].includes(parentTag))) return;
            out.appendChild(doc.createTextNode(text));
            return;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) return;

        const el = child as HTMLElement;
        const raw = el.tagName.toLowerCase();
        if (DROP.has(raw)) return;

        // Table rows become paragraphs with cells separated by " | ".
        if (raw === 'tr') {
            const p = doc.createElement('p');
            const cells = Array.from(el.children).map((c) => (c.textContent ?? '').trim());
            p.textContent = cells.filter(Boolean).join(' | ');
            if (p.textContent) out.appendChild(p);
            return;
        }

        const tag = RENAME[raw] ?? raw;
        if (!BLOCK_TAGS.has(tag) && !INLINE_TAGS.has(tag)) {
            // div/section/span/table/font/etc: keep children only.
            if (raw === 'div' && out.nodeName === 'BODY') {
                const p = doc.createElement('p');
                cleanNode(el, p, doc);
                if (p.textContent?.trim()) out.appendChild(p);
                return;
            }
            cleanNode(el, out, doc);
            return;
        }

        const copy = doc.createElement(tag);
        if (tag === 'a') {
            const href = safeHref(el.getAttribute('href'));
            if (!href) {
                cleanNode(el, out, doc);
                return;
            }
            copy.setAttribute('href', href);
        }
        if (INDENT_TYPES.has(tag)) {
            const level = indentLevel(el);
            if (level > 0) copy.setAttribute('style', `padding-left: ${level}em`);
        }
        cleanNode(el, copy, doc);
        out.appendChild(copy);
    });
}

/** Wrap stray top-level text / inline runs in `<p>` so the editors get block content. */
function wrapLooseInline(body: HTMLElement, doc: Document) {
    let buffer: HTMLParagraphElement | null = null;
    Array.from(body.childNodes).forEach((child) => {
        const isBlock = child.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((child as HTMLElement).tagName.toLowerCase());
        if (isBlock) {
            buffer = null;
            return;
        }
        if (child.nodeType === Node.TEXT_NODE && !(child.textContent ?? '').trim()) {
            child.remove();
            return;
        }
        if (!buffer) {
            buffer = doc.createElement('p');
            body.insertBefore(buffer, child);
        }
        buffer.appendChild(child);
    });
}

export function sanitizeNoteHtml(html: string): string {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const doc = document.implementation.createHTMLDocument('');
    cleanNode(parsed.body, doc.body, doc);
    wrapLooseInline(doc.body, doc);
    // Remove empty blocks left behind by dropped content (keep <hr>).
    doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote').forEach((el) => {
        if (!el.textContent?.trim() && !el.querySelector('br')) el.remove();
    });
    return doc.body.innerHTML.trim();
}

export type ImportedNote = { title: string; html: string };

/**
 * A leading `<h1>` becomes the note title (exports write the title that way),
 * otherwise the file name is used.
 */
export function extractTitle(html: string, fallbackTitle: string): ImportedNote {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const first = doc.body.firstElementChild;
    const heading = first?.tagName === 'H1' ? (first.textContent ?? '').trim() : '';
    if (heading && heading.length <= 60) {
        first!.remove();
        return { title: heading, html: doc.body.innerHTML.trim() };
    }
    return { title: fallbackTitle.slice(0, 60), html };
}

export function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
