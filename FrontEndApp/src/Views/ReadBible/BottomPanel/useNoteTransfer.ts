import { ref } from 'vue';
import { useMessage } from 'naive-ui';
import useNoteStore from '../../../store/useNoteStore';
import { NOTE_IMPORT_ACCEPT, exportNote, importNoteFile, type NoteExportFormat } from '../../../util/NoteTransfer';

export const exportOptions = [
    { label: 'Export as PDF', key: 'pdf' },
    { label: 'Export as Word (.docx)', key: 'docx' },
    { label: 'Export as Markdown (.md)', key: 'md' },
];

export const importOptions = [{ label: 'Import from file (.docx, .pdf, .md)…', key: 'import' }];

/** Single-note export and import-as-new-note for the Notes panel. */
export default function useNoteTransfer() {
    const noteStore = useNoteStore();
    const message = useMessage();
    const busy = ref(false);

    async function handleExport(key: string | number) {
        const note = noteStore.selectedNote;
        if (!note || busy.value) return;
        busy.value = true;
        try {
            const done = await exportNote(note.title || 'Note', note.content, key as NoteExportFormat);
            if (done) message.success('Note exported');
        } catch (err: any) {
            message.error(`Export failed: ${err?.message ?? err}`);
        } finally {
            busy.value = false;
        }
    }

    function pickImportFile() {
        if (busy.value) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = NOTE_IMPORT_ACCEPT;
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            busy.value = true;
            try {
                const { title, html } = await importNoteFile(file);
                noteStore.addNote(title, html);
                message.success(`Imported "${title}"`);
            } catch (err: any) {
                message.error(`Import failed: ${err?.message ?? err}`);
            } finally {
                busy.value = false;
            }
        };
        input.click();
    }

    return { busy, handleExport, pickImportFile };
}
