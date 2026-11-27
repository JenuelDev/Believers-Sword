export type NoteDraft = {
    id: string;
    title: string;
    content: string;
    created_at: string;
    updated_at: string;
};

type Options = {
    key: string;
    storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
    write: (note: NoteDraft) => Promise<{ success?: boolean }>;
    onSaved?: () => void;
    onError?: (message: string) => void;
};

const same = (a: Pick<NoteDraft, 'title' | 'content'> | undefined, b: NoteDraft) =>
    a?.title === b.title && a?.content === b.content;

/** Keep recoverable drafts until persistence confirms the exact saved version. */
export function createNoteSaveQueue(options: Options) {
    const pending = new Map<string, NoteDraft>();
    const snapshots = new Map<string, NoteDraft>();
    const inFlight = new Map<string, Promise<boolean>>();
    let revision = 0;
    const editedAt = new Map<string, number>();
    const deletedAt = new Map<string, number>();
    const failure = "Couldn't save your changes. Keep this window open and try again.";

    try {
        const drafts = JSON.parse(options.storage?.getItem(options.key) || '[]');
        if (Array.isArray(drafts)) {
            for (const draft of drafts) {
                if (draft && ['id', 'title', 'content', 'created_at', 'updated_at'].every((key) => typeof draft[key] === 'string')) {
                    pending.set(draft.id, draft);
                }
            }
        }
    } catch { options.onError?.(failure); }

    function persist() {
        try {
            if (pending.size) options.storage?.setItem(options.key, JSON.stringify([...pending.values()]));
            else options.storage?.removeItem(options.key);
        } catch { options.onError?.(failure); }
    }

    function isDirty(note: NoteDraft) {
        return pending.has(note.id) || !same(snapshots.get(note.id), note);
    }

    function stage(note: NoteDraft) {
        if (!isDirty(note)) return;
        if (same(pending.get(note.id), note)) return;
        pending.set(note.id, { ...note });
        editedAt.set(note.id, ++revision);
        deletedAt.delete(note.id);
        persist();
    }

    function captureRead() { return { revision, pending: new Set(pending.keys()) }; }

    function mergeRemote(rows: NoteDraft[], read = captureRead()) {
        const readRevision = read.revision;
        const merged = new Map(rows.filter((row) => (deletedAt.get(row.id) ?? 0) <= readRevision).map((row) => [row.id, row]));
        for (const row of rows) {
            if (!pending.has(row.id) && !read.pending.has(row.id) && (editedAt.get(row.id) ?? 0) <= readRevision) snapshots.set(row.id, { ...row });
        }
        for (const id of new Set([...editedAt.keys(), ...read.pending])) {
            if (((editedAt.get(id) ?? 0) > readRevision || read.pending.has(id)) && snapshots.has(id)) merged.set(id, { ...snapshots.get(id)! });
        }
        for (const row of pending.values()) merged.set(row.id, { ...row });
        return [...merged.values()];
    }

    function discard(id: string) {
        pending.delete(id);
        snapshots.delete(id);
        editedAt.delete(id);
        deletedAt.set(id, ++revision);
        persist();
    }

    function flushOne(id: string): Promise<boolean> {
        const active = inFlight.get(id);
        if (active) return active;
        const job = (async () => {
            while (pending.has(id)) {
                const writing = { ...pending.get(id)! };
                try {
                    const result = await options.write(writing);
                    if (!result?.success) throw new Error('Persistence was not confirmed.');
                } catch {
                    options.onError?.(failure);
                    return false;
                }
                snapshots.set(id, writing);
                if (same(pending.get(id), writing)) pending.delete(id);
                persist();
                options.onSaved?.();
            }
            return true;
        })();
        inFlight.set(id, job);
        void job.finally(() => { if (inFlight.get(id) === job) inFlight.delete(id); });
        return job;
    }

    async function flush() {
        return (await Promise.all([...pending.keys()].map(flushOne))).every(Boolean);
    }

    return { stage, isDirty, captureRead, mergeRemote, discard, flush, flushOne,
        get pendingNotes() { return [...pending.values()].map((note) => ({ ...note })); },
    };
}
