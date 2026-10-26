import { defineStore } from 'pinia';
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue';
import { debouncedRunSync, runPushSync } from '../util/Sync/sync';
import SESSION from '../util/session';
import { useAuthStore } from './authStore';
import { createNoteSaveQueue } from './noteSaveQueue';

export type NoteItem = {
    id: string;        // = note_id in DB
    title: string;
    content: string;
    created_at: string;
    updated_at: string;
};

export default defineStore('useNotesStore', () => {
    const notes = ref<Array<NoteItem>>([]);
    const selectedNoteId = ref<string>('');
    const showNote = ref<boolean>(true);
    const isHydrating = ref(false);

    const showNoteKey = 'show-note-panel';

    onMounted(() => {
        const saved = SESSION.get(showNoteKey);
        if (saved !== null && saved !== undefined)
            showNote.value = saved !== false && saved !== 'false';
    });

    watch(() => showNote.value, (val) => SESSION.set(showNoteKey, val));

    function createDefaultNote(): NoteItem {
        const now = new Date().toISOString();
        return {
            id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title: 'Note 1',
            content: '',
            created_at: now,
            updated_at: now,
        };
    }

    function normalizeTitle(content: string, fallback: string): string {
        const plainText = content
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return plainText ? plainText.slice(0, 28) : fallback;
    }

    function ensureSelectedNote() {
        if (!notes.value.length) {
            selectedNoteId.value = '';
            return;
        }
        const exists = notes.value.some((n) => n.id === selectedNoteId.value);
        if (!exists) selectedNoteId.value = notes.value[0].id;
    }

    const selectedNote = computed(() => {
        if (!notes.value.length) return undefined;
        ensureSelectedNote();
        return notes.value.find((n) => n.id === selectedNoteId.value) ?? notes.value[0];
    });

    const currentNoteContent = computed({
        get() { return selectedNote.value?.content ?? ''; },
        set(value: string) {
            const selected = selectedNote.value;
            if (!selected) return;
            selected.content = value;
            selected.updated_at = new Date().toISOString();
        },
    });

    let loadGeneration = 0;
    const saveError = ref<string | null>(null);
    const auth = useAuthStore();
    const draftScope = computed(() => window.isElectron ? 'desktop' : `web-user-${auth.user?.id ?? 'signed-out'}`);
    const queues = new Map<string, ReturnType<typeof createNoteSaveQueue>>();
    let notesSyncTimer: ReturnType<typeof setTimeout> | null = null;

    function queueForScope(): ReturnType<typeof createNoteSaveQueue> {
        const scope = draftScope.value;
        let queue = queues.get(scope);
        if (!queue) {
            queue = createNoteSaveQueue({
                key: `note-drafts:v1:${scope}`,
                storage: localStorage,
                write: (note) => {
                    if (draftScope.value !== scope) return Promise.reject(new Error('The account changed.'));
                    return window.browserWindow.upsertNote({ note_id: note.id, title: note.title, content: note.content });
                },
                onError: (message) => { if (draftScope.value === scope) saveError.value = message; },
                onSaved: () => {
                    if (draftScope.value !== scope) return;
                    if (!queueForScope().pendingNotes.length) saveError.value = null;
                    if (notesSyncTimer) clearTimeout(notesSyncTimer);
                    notesSyncTimer = setTimeout(() => { notesSyncTimer = null; void runPushSync(); }, 15_000);
                },
            });
            queues.set(scope, queue);
        }
        return queue;
    }

    async function retryPendingSaves() {
        const scope = draftScope.value;
        const success = await queueForScope().flush();
        if (success && scope === draftScope.value) saveError.value = null;
        return success;
    }

    // Preserve queued edits when refreshing from the server or restoring a page.
    async function loadNote() {
        const generation = ++loadGeneration;
        const queue = queueForScope();
        const readSnapshot = queue.captureRead();
        try {
            const rows: any[] = await window.browserWindow.getNotes();
            if (generation !== loadGeneration) return;
            const loaded = rows.map((r) => ({
                id: r.note_id, title: r.title ?? '', content: r.content ?? '',
                created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
                updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
            }));
            isHydrating.value = true;
            notes.value = queue.mergeRemote(loaded, readSnapshot);
            ensureSelectedNote();
        } catch {
            if (generation !== loadGeneration) return;
            isHydrating.value = true;
            notes.value = queue.mergeRemote(notes.value, readSnapshot);
            ensureSelectedNote();
            saveError.value = 'Notes could not be refreshed. Your pending edits have been kept.';
        } finally {
            if (generation === loadGeneration) isHydrating.value = false;
        }
        if (generation === loadGeneration && queue.pendingNotes.length) void retryPendingSaves();
    }

    // ─── CRUD ────────────────────────────────────────────────────

    function selectNote(noteId: string) {
        selectedNoteId.value = noteId;
    }

    function addNote(title?: string, content?: string) {
        const note = createDefaultNote();
        const nextNumber = notes.value.length + 1;
        const cleaned = (title ?? '').trim();
        note.title = cleaned ? cleaned.slice(0, 60) : `Note ${nextNumber}`;
        if (content) note.content = content;
        notes.value = [...notes.value, note];
        selectedNoteId.value = note.id;
    }

    function renameNote(noteId: string, title: string) {
        const note = notes.value.find((n) => n.id === noteId);
        if (!note) return;
        const cleaned = (title ?? '').trim();
        note.title = cleaned.slice(0, 60) || 'Untitled Note';
        note.updated_at = new Date().toISOString();
    }

    async function deleteNote(noteId: string) {
        const queue = queueForScope();
        const scope = draftScope.value;
        await queue.flushOne(noteId);
        if (scope !== draftScope.value) return;
        try {
            const result = await window.browserWindow.deleteNote({ note_id: noteId });
            if (!result?.success) throw new Error('Deletion was not confirmed.');
            queue.discard(noteId);
            if (scope !== draftScope.value) return;
            notes.value = notes.value.filter((n) => n.id !== noteId);
            ensureSelectedNote();
            debouncedRunSync();
        } catch {
            if (scope === draftScope.value) saveError.value = 'This note could not be deleted. Please try again.';
        }
    }

    async function storeNote(note: NoteItem) {
        const queue = queueForScope();
        queue.stage(note);
        return queue.flushOne(note.id);
    }

    watch(
        () => notes.value,
        (newNotes) => {
            if (isHydrating.value) return;
            const queue = queueForScope();
            const changed = newNotes.filter((note) => queue.isDirty(note));
            for (const note of changed) queue.stage(note);
            if (!changed.length) return;
            clearTimeout(window.takingNoteTimeOut);
            window.takingNoteTimeOut = setTimeout(() => {
                for (const note of changed) void storeNote(note);
            }, 700);
        },
        { deep: true, flush: 'sync' }
    );

    const onOnline = () => { void retryPendingSaves(); };
    window.addEventListener('online', onOnline);
    onScopeDispose(() => {
        window.removeEventListener('online', onOnline);
        clearTimeout(window.takingNoteTimeOut);
        if (notesSyncTimer) clearTimeout(notesSyncTimer);
    });
    watch(draftScope, () => {
        loadGeneration++;
        clearTimeout(window.takingNoteTimeOut);
        if (notesSyncTimer) clearTimeout(notesSyncTimer);
        notes.value = [];
        selectedNoteId.value = '';
        saveError.value = null;
        isHydrating.value = false;
    }, { flush: 'sync' });

    return {
        notes,
        selectedNote,
        selectedNoteId,
        currentNoteContent,
        addNote,
        renameNote,
        deleteNote,
        selectNote,
        loadNote,
        storeNote,
        showNote,
        normalizeTitle,
        saveError,
        retryPendingSaves,
    };
});
