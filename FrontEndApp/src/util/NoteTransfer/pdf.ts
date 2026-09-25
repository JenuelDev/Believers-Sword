import { escapeHtml } from './sanitize';

type Line = { text: string; y: number; height: number };

function median(values: number[]): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

async function loadPdfjs() {
    const pdfjs = await import('pdfjs-dist');
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
}

/**
 * Extracts text from a PDF. PDFs don't store paragraphs/lists, only positioned
 * text, so structure is inferred: a larger vertical gap starts a new paragraph
 * and noticeably larger text becomes a heading. Inline formatting is lost.
 */
export async function pdfToHtml(buffer: ArrayBuffer): Promise<string> {
    const pdfjs = await loadPdfjs();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    const blocks: string[] = [];

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();
        const lines: Line[] = [];
        let current: Line | null = null;

        for (const item of content.items as any[]) {
            if (typeof item.str !== 'string') continue;
            const y = item.transform[5];
            const height = Math.abs(item.height || item.transform[3] || 0);
            if (!current) current = { text: '', y, height };
            current.text += item.str;
            current.height = Math.max(current.height, height);
            if (item.hasEOL) {
                if (current.text.trim()) lines.push(current);
                current = null;
            }
        }
        if (current?.text.trim()) lines.push(current);
        if (!lines.length) continue;

        const bodyHeight = median(lines.map((l) => l.height)) || 1;
        const gaps = lines.slice(1).map((l, i) => lines[i].y - l.y).filter((g) => g > 0);
        // The tightest gap is ordinary line spacing; anything clearly larger is a
        // paragraph break. The cap handles pages where every line is its own paragraph.
        const paragraphGap = gaps.length ? Math.min(Math.min(...gaps) * 1.3, bodyHeight * 1.9) : Infinity;

        let paragraph = '';
        const flush = () => {
            if (paragraph.trim()) blocks.push(`<p>${escapeHtml(paragraph.trim())}</p>`);
            paragraph = '';
        };

        lines.forEach((line, i) => {
            const text = line.text.replace(/\s+/g, ' ').trim();
            if (line.height > bodyHeight * 1.25) {
                flush();
                const tag = pageNo === 1 && blocks.length === 0 ? 'h1' : 'h2';
                blocks.push(`<${tag}>${escapeHtml(text)}</${tag}>`);
                return;
            }
            const gap = i > 0 ? lines[i - 1].y - line.y : 0;
            if (i > 0 && (gap > paragraphGap || gap < 0)) flush();
            if (paragraph.endsWith('-')) paragraph = paragraph.slice(0, -1) + text;
            else paragraph += (paragraph ? ' ' : '') + text;
        });
        flush();
    }

    await pdf.destroy();
    return blocks.join('');
}

function printableHtml(title: string, html: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
    body { font-family: Georgia, 'Times New Roman', serif; color: #222; max-width: 700px; margin: 24px auto; padding: 0 16px; font-size: 14px; line-height: 1.6; }
    h1 { font-size: 24px; margin: 0 0 16px; }
    p { margin: 6px 0; }
    blockquote { border-left: 3px solid #ccc; margin: 8px 0; padding-left: 12px; color: #555; }
    code, pre { font-family: Consolas, monospace; }
    a { color: #1a5fb4; }
</style></head><body><h1>${escapeHtml(title)}</h1>${html}</body></html>`;
}

/** Electron: render off-screen and save via the existing `exportToPdf` IPC. Web: print dialog ("Save as PDF"). */
export async function exportPdf(title: string, html: string, filename: string): Promise<boolean> {
    const doc = printableHtml(title, html);
    if (window.isElectron) {
        const result = await window.browserWindow.exportToPdf({ html: doc, filename });
        if (result?.error) throw new Error(result.error);
        return !!result?.success;
    }

    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);
    const win = frame.contentWindow!;
    win.document.open();
    win.document.write(doc);
    win.document.close();
    await new Promise((resolve) => setTimeout(resolve, 150));
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 1000);
    return true;
}
