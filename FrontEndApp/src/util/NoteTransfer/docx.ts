import type { IParagraphOptions, IRunOptions, ParagraphChild } from 'docx';

type DocxLib = typeof import('docx');
type RunStyle = { bold?: boolean; italics?: boolean; underline?: boolean; strike?: boolean; code?: boolean; link?: boolean };
type ListContext = { ordered: boolean; level: number; instance: number };

/** 1 editor indent level (1em) is written as 0.5" in Word (720 twips). */
const TWIPS_PER_INDENT = 720;
const HEADINGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'] as const;

function indentOf(el: Element): number {
    const match = /([\d.]+)\s*em/.exec((el as HTMLElement).style?.paddingLeft ?? '');
    return match ? Math.round(parseFloat(match[1])) : 0;
}

function collectRuns(lib: DocxLib, node: Node, style: RunStyle, out: ParagraphChild[]) {
    node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
            const text = (child.textContent ?? '').replace(/\s+/g, ' ');
            if (!text) return;
            const opts: IRunOptions = {
                text,
                bold: style.bold,
                italics: style.italics,
                strike: style.strike,
                underline: style.underline ? {} : undefined,
                font: style.code ? 'Consolas' : undefined,
                style: style.link ? 'Hyperlink' : undefined,
            };
            out.push(new lib.TextRun(opts));
            return;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) return;
        const el = child as HTMLElement;
        switch (el.tagName) {
            case 'BR':
                out.push(new lib.TextRun({ text: '', break: 1 }));
                return;
            case 'STRONG':
            case 'B':
                return collectRuns(lib, el, { ...style, bold: true }, out);
            case 'EM':
            case 'I':
                return collectRuns(lib, el, { ...style, italics: true }, out);
            case 'U':
                return collectRuns(lib, el, { ...style, underline: true }, out);
            case 'S':
            case 'DEL':
            case 'STRIKE':
                return collectRuns(lib, el, { ...style, strike: true }, out);
            case 'CODE':
                return collectRuns(lib, el, { ...style, code: true }, out);
            case 'A': {
                const children: ParagraphChild[] = [];
                collectRuns(lib, el, { ...style, link: true }, children);
                const link = el.getAttribute('href');
                if (link) out.push(new lib.ExternalHyperlink({ link, children: children as any }));
                else out.push(...children);
                return;
            }
            case 'UL':
            case 'OL':
                return; // nested lists are handled by the block walker
            default:
                collectRuns(lib, el, style, out);
        }
    });
}

function buildBlocks(lib: DocxLib, root: Element) {
    const paragraphs: InstanceType<DocxLib['Paragraph']>[] = [];
    let listInstance = 0;

    const push = (el: Element, opts: Partial<IParagraphOptions>, style: RunStyle = {}) => {
        const children: ParagraphChild[] = [];
        collectRuns(lib, el, style, children);
        paragraphs.push(new lib.Paragraph({ ...opts, children }));
    };

    const walkList = (list: Element, ctx: ListContext) => {
        Array.from(list.children).forEach((li) => {
            if (li.tagName !== 'LI') return;
            const numbering = ctx.ordered
                ? { numbering: { reference: 'note-ordered', level: ctx.level, instance: ctx.instance } }
                : { bullet: { level: ctx.level } };
            push(li, numbering);
            Array.from(li.children).forEach((sub) => {
                if (sub.tagName === 'UL' || sub.tagName === 'OL') {
                    walkList(sub, { ordered: sub.tagName === 'OL', level: Math.min(ctx.level + 1, 8), instance: sub.tagName === 'OL' ? ++listInstance : ctx.instance });
                }
            });
        });
    };

    Array.from(root.children).forEach((el) => {
        const tag = el.tagName;
        const indent = indentOf(el);
        const indentOpt = indent > 0 ? { indent: { left: indent * TWIPS_PER_INDENT } } : {};
        const headingIndex = HEADINGS.indexOf(tag as (typeof HEADINGS)[number]);
        if (headingIndex >= 0) {
            const level = [lib.HeadingLevel.HEADING_1, lib.HeadingLevel.HEADING_2, lib.HeadingLevel.HEADING_3, lib.HeadingLevel.HEADING_4, lib.HeadingLevel.HEADING_5, lib.HeadingLevel.HEADING_6][headingIndex];
            push(el, { heading: level, ...indentOpt });
        } else if (tag === 'UL' || tag === 'OL') {
            walkList(el, { ordered: tag === 'OL', level: 0, instance: ++listInstance });
        } else if (tag === 'BLOCKQUOTE') {
            const inner = el.querySelectorAll(':scope > p');
            (inner.length ? Array.from(inner) : [el]).forEach((p) => push(p, { indent: { left: TWIPS_PER_INDENT } }, { italics: true }));
        } else if (tag === 'PRE') {
            push(el, {}, { code: true });
        } else if (tag === 'HR') {
            paragraphs.push(new lib.Paragraph({ border: { bottom: { style: lib.BorderStyle.SINGLE, size: 6, color: 'AAAAAA', space: 1 } }, children: [] }));
        } else {
            push(el, indentOpt);
        }
    });
    return paragraphs;
}

export async function htmlToDocxBlob(title: string, html: string): Promise<Blob> {
    const lib = await import('docx');
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    const levels = Array.from({ length: 9 }, (_, level) => ({
        level,
        format: lib.LevelFormat.DECIMAL,
        text: `%${level + 1}.`,
        alignment: lib.AlignmentType.START,
        style: { paragraph: { indent: { left: TWIPS_PER_INDENT * (level + 1), hanging: 360 } } },
    }));
    const document = new lib.Document({
        creator: 'Believers Sword',
        title,
        numbering: { config: [{ reference: 'note-ordered', levels }] },
        sections: [
            {
                children: [
                    new lib.Paragraph({ heading: lib.HeadingLevel.HEADING_1, children: [new lib.TextRun({ text: title })] }),
                    ...buildBlocks(lib, doc.body),
                ],
            },
        ],
    });
    return lib.Packer.toBlob(document);
}

export async function docxToHtml(buffer: ArrayBuffer): Promise<string> {
    const mammoth = (await import('mammoth')).default;
    const result = await mammoth.convertToHtml(
        { arrayBuffer: buffer },
        {
            styleMap: ['u => u', 'strike => s', "p[style-name='Title'] => h1:fresh"],
            // Images are dropped by the sanitizer anyway; skip decoding them.
            convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
        },
    );
    return result.value;
}
