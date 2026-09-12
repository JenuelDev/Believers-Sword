/**
 * Bible module selection helpers for the reader panes.
 *
 * Desktop seeds its own `bs_*` modules into the user's data dir (see
 * `Electron/Setups/Setup/SetDefaultBible.ts`), while the web app can only read
 * the modules the API serves — and those two sets are not identical. Because the
 * pane selection is persisted in localStorage, a pane pinned to a module the
 * current platform doesn't have stays dead across reloads: the header falls back
 * to the raw file name and the chapter renders empty.
 */

/**
 * Bundled modules that were replaced by a newer build, old file name ->
 * successor. Desktop deletes the old file on launch, so persisted selections
 * are rewritten to the successor there.
 */
export const REPLACED_BIBLE_VERSIONS: Record<string, string> = {
    'King James Version - 1769.SQLite3': 'bs_KJV - 1769.SQLite3',
};

/** Successor -> the module it replaced, used as a substitute when it's missing. */
const PREDECESSOR_BIBLE_VERSIONS: Record<string, string> = Object.fromEntries(
    Object.entries(REPLACED_BIBLE_VERSIONS).map(([oldName, newName]) => [newName, oldName]),
);

/** Rewrite replaced modules to their successor. Desktop-only — see the note above. */
export function migrateReplacedVersions(versions: string[]): string[] {
    return versions.map((version) => REPLACED_BIBLE_VERSIONS[version] ?? version);
}

/**
 * Swap every selected module that isn't in `available` for one that is, keeping
 * the pane count and the order of the panes that are fine.
 *
 * A missing module prefers the other half of its replaced/successor pair (same
 * translation, so the pane barely changes), then any available module that
 * isn't already open in another pane, and only duplicates an open one as a last
 * resort — a duplicated pane is at least readable and removable, a dead one is
 * not.
 *
 * `available` being empty means "not known yet" (the list loads asynchronously),
 * so the selection is returned untouched.
 */
export function resolveAvailableVersions(selected: string[], available: string[]): string[] {
    if (!available.length) return [...selected];

    const availableSet = new Set(available);
    const taken = new Set(selected.filter((version) => availableSet.has(version)));

    return selected.map((version) => {
        if (availableSet.has(version)) return version;

        const counterpart =
            PREDECESSOR_BIBLE_VERSIONS[version] ?? REPLACED_BIBLE_VERSIONS[version];
        const substitute =
            (counterpart && availableSet.has(counterpart) && !taken.has(counterpart)
                ? counterpart
                : undefined) ??
            available.find((candidate) => !taken.has(candidate)) ??
            (counterpart && availableSet.has(counterpart) ? counterpart : undefined) ??
            available[0];

        taken.add(substitute);
        return substitute;
    });
}
