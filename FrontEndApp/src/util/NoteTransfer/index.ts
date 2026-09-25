import { htmlToMarkdown, markdownToHtml } from './markdown';
import { docxToHtml, htmlToDocxBlob } from './docx';
import { exportPdf, pdfToHtml } from './pdf';
import { extractTitle, sanitizeNoteHtml, type ImportedNote } from './sanitize';

export type NoteExportFormat = 'pdf' | 'docx' | 'md';

/** File extensions the import picker accepts. */
export const NOTE_IMPORT_ACCEPT = '.md,.markdown,.txt,.docx,.pdf';

function safeFileName(title: string): string {
    const cleaned = title.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
    return (cleaned || 'Note').slice(0, 80);
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Exports a single note. Returns false when the user cancelled a save dialog. */
export async function exportNote(title: string, html: string, format: NoteExportFormat): Promise<boolean> {
    const name = safeFileName(title);
    if (format === 'pdf') return exportPdf(title, html, `${name}.pdf`);
    if (format === 'docx') {
        downloadBlob(await htmlToDocxBlob(title, html), `${name}.docx`);
        return true;
    }
    const markdown = htmlToMarkdown(title, html);
    downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), `${name}.md`);
    return true;
}

/** Converts an imported file into note title + editor-safe HTML. */
export async function importNoteFile(file: File): Promise<ImportedNote> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'Imported Note';

    let html: string;
    if (ext === 'docx') html = await docxToHtml(await file.arrayBuffer());
    else if (ext === 'pdf') html = await pdfToHtml(await file.arrayBuffer());
    else if (ext === 'md' || ext === 'markdown' || ext === 'txt') html = markdownToHtml(await file.text());
    else throw new Error('Unsupported file type. Use .docx, .pdf or .md');

    const result = extractTitle(sanitizeNoteHtml(html), baseName);
    if (!result.html.trim()) throw new Error('No readable text was found in this file.');
    return result;
}
