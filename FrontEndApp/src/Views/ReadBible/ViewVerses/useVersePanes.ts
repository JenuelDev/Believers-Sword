import { ref, nextTick, onUnmounted } from 'vue';
import SESSION from '../../../util/session';
import { useBibleStore } from '../../../store/BibleStore';
import { useModuleStore } from '../../../store/moduleStore';

export function useVersePanes({ bibleStore, moduleStore }: {
    bibleStore: ReturnType<typeof useBibleStore>;
    moduleStore: ReturnType<typeof useModuleStore>;
}) {
    // --- Split View ---
    const storageSplitPaneSizesKey = 'verse-split-pane-sizes';
    const storageScrollPositionKey = 'verse-scroll-position';
    const splitPaneSizes = ref<number[]>([100]);
    const scrollPaneRefs = ref<(HTMLElement | null)[]>([]);
    const verseSkeletonRows = [0, 1, 2, 3, 4];
    let activePaneIndex: number | null = null;
    let saveScrollTimeout: ReturnType<typeof setTimeout> | null = null;
    let scrollSyncAnimationFrame: number | null = null;
    let pendingScrollSourcePaneIndex: number | null = null;

    function changeVersion(paneIndex: number, newVersion: string) {
        bibleStore.selectedBibleVersions[paneIndex] = newVersion;
        bibleStore.getVerses();
    }

    // Display title for the version shown in a pane (the file name otherwise).
    function versionTitle(fileName: string) {
        const match = moduleStore.bibleLists.find((b: any) => b.file_name === fileName);
        return match?.title ?? fileName;
    }

    // Version picker dialog , opened from a pane header to switch that pane's version.
    const versionPickerOpen = ref(false);
    const versionPickerPane = ref(0);

    function openVersionPicker(paneIndex: number) {
        versionPickerPane.value = paneIndex;
        versionPickerOpen.value = true;
    }

    function onVersionPicked(fileName: string) {
        changeVersion(versionPickerPane.value, fileName);
    }

    async function versionHasCurrentChapter(versionFile: string) {
        const verseCount = await window.browserWindow.getVersesCount(
            JSON.stringify({
                bible_versions: [versionFile],
                book_number: bibleStore.selectedBookNumber,
                selected_chapter: bibleStore.selectedChapter,
            }),
        );

        return verseCount > 0;
    }

    async function addSplit() {
        if (bibleStore.selectedBibleVersions.length >= 6) return;
        const available = moduleStore.bibleLists.filter(
            (b: any) =>
                !b.title.includes('commentaries') &&
                !bibleStore.selectedBibleVersions.includes(b.file_name),
        );

        let newVersion = available[0]?.file_name ?? bibleStore.DefaultSelectedVersion;
        for (const candidate of available) {
            if (await versionHasCurrentChapter(candidate.file_name)) {
                newVersion = candidate.file_name;
                break;
            }
        }

        bibleStore.selectedBibleVersions.push(newVersion);
        // Distribute pane sizes evenly
        const count = bibleStore.selectedBibleVersions.length;
        splitPaneSizes.value = Array(count).fill(100 / count);
        SESSION.set(storageSplitPaneSizesKey, splitPaneSizes.value);
        bibleStore.getVerses();
    }

    function paneHasVisibleVerses(paneIndex: number) {
        return bibleStore.renderVerses.some((verse) => verse.version[paneIndex]?.text);
    }

    function showVerseSkeletons(paneIndex: number) {
        const versionFile = bibleStore.selectedBibleVersions[paneIndex];
        return (
            !window.isElectron &&
            bibleStore.isLoadingVerses &&
            bibleStore.loadingVerseVersions.includes(versionFile)
        );
    }

    function removeSplit(paneIndex: number) {
        if (bibleStore.selectedBibleVersions.length <= 1) return;
        bibleStore.selectedBibleVersions.splice(paneIndex, 1);
        // Redistribute sizes evenly
        const count = bibleStore.selectedBibleVersions.length;
        splitPaneSizes.value = Array(count).fill(100 / count);
        SESSION.set(storageSplitPaneSizesKey, splitPaneSizes.value);
    }

    function onSplitResized(sizes: Array<{ size: number }>) {
        splitPaneSizes.value = sizes.map((s) => s.size);
        SESSION.set(storageSplitPaneSizesKey, splitPaneSizes.value);
    }

    function getTopVisibleVerse(scrollEl: HTMLElement): { verse: number; proportion: number } | null {
        const scrollTop = scrollEl.scrollTop;
        const paneTop = scrollEl.offsetTop;
        const children = scrollEl.children;
        // Binary search for the first verse element whose bottom is below scrollTop
        let lo = 0;
        let hi = children.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            const el = children[mid] as HTMLElement;
            if (el.offsetTop - paneTop + el.offsetHeight <= scrollTop) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        const el = children[lo] as HTMLElement | undefined;
        if (!el) return null;
        const verseEl = el.querySelector<HTMLElement>('[data-verse]');
        if (!verseEl) return null;
        const elTop = verseEl.offsetTop - paneTop;
        return {
            verse: Number(verseEl.dataset.verse),
            proportion: (scrollTop - elTop) / (verseEl.offsetHeight || 1),
        };
    }

    function scrollPaneToVerse(scrollEl: HTMLElement, verse: number, proportion: number) {
        const targetVerseEl = scrollEl.querySelector<HTMLElement>(`[data-verse="${verse}"]`);
        if (!targetVerseEl) return;
        scrollEl.scrollTop = targetVerseEl.offsetTop - scrollEl.offsetTop + proportion * targetVerseEl.offsetHeight;
    }

    function getScrollRatio(scrollEl: HTMLElement) {
        const maxScrollTop = scrollEl.scrollHeight - scrollEl.clientHeight;
        if (maxScrollTop <= 0) return 0;

        return scrollEl.scrollTop / maxScrollTop;
    }

    function scrollPaneToRatio(scrollEl: HTMLElement, ratio: number) {
        const maxScrollTop = scrollEl.scrollHeight - scrollEl.clientHeight;
        scrollEl.scrollTop = maxScrollTop * ratio;
    }

    function saveScrollPosition(scrollEl: HTMLElement) {
        if (saveScrollTimeout) clearTimeout(saveScrollTimeout);
        saveScrollTimeout = setTimeout(() => {
            const pos = getTopVisibleVerse(scrollEl);
            if (pos) SESSION.set(storageScrollPositionKey, pos);
        }, 200);
    }

    let isRestoringScroll = false;

    function restoreScrollPosition() {
        const saved = SESSION.get(storageScrollPositionKey);
        if (!saved) return;
        isRestoringScroll = true;
        // Wait for DOM to render verses
        nextTick(() => {
            setTimeout(() => {
                scrollPaneRefs.value.forEach((el) => {
                    if (el) scrollPaneToVerse(el as HTMLElement, saved.verse, saved.proportion);
                });
                // Keep the flag on briefly so the renderVerses watcher doesn't override
                setTimeout(() => {
                    isRestoringScroll = false;
                }, 300);
            }, 100);
        });
    }

    function onPaneMouseEnter(paneIndex: number) {
        activePaneIndex = paneIndex;
    }

    function syncScroll(sourcePaneIndex: number) {
        if (activePaneIndex !== sourcePaneIndex) return;
        pendingScrollSourcePaneIndex = sourcePaneIndex;

        if (scrollSyncAnimationFrame !== null) return;

        scrollSyncAnimationFrame = requestAnimationFrame(() => {
            scrollSyncAnimationFrame = null;
            const sourcePaneIndex = pendingScrollSourcePaneIndex;
            pendingScrollSourcePaneIndex = null;

            if (sourcePaneIndex === null || activePaneIndex !== sourcePaneIndex) return;
            syncScrollToPanes(sourcePaneIndex);
        });
    }

    function syncScrollToPanes(sourcePaneIndex: number) {
        const source = scrollPaneRefs.value[sourcePaneIndex];
        if (!source) return;

        const pos = getTopVisibleVerse(source as HTMLElement);

        const panes = scrollPaneRefs.value;
        for (let i = 0; i < panes.length; i++) {
            if (i === sourcePaneIndex || !panes[i]) continue;
            if (pos) {
                scrollPaneToVerse(panes[i] as HTMLElement, pos.verse, pos.proportion);
            } else {
                scrollPaneToRatio(panes[i] as HTMLElement, getScrollRatio(source as HTMLElement));
            }
        }

        saveScrollPosition(source as HTMLElement);
    }

    function setScrollPaneRef(index: number, el: any) {
        scrollPaneRefs.value[index] = el as HTMLElement | null;
    }

    // Initialize split sizes from storage
    function initSplitSizes() {
        const saved = SESSION.get(storageSplitPaneSizesKey);
        const count = bibleStore.selectedBibleVersions.length;
        if (saved && saved.length === count) {
            splitPaneSizes.value = saved;
        } else {
            splitPaneSizes.value = Array(count).fill(100 / count);
        }
    }

    function scrollAllPanesToVerse(verseNumber: number) {
        if (isRestoringScroll) return;

        function doScroll() {
            scrollPaneRefs.value.forEach((el) => {
                if (!el) return;
                const pane = el as HTMLElement;
                const verseEl = pane.querySelector<HTMLElement>(`[data-verse="${verseNumber}"]`);
                if (!verseEl) return;
                const paneRect = pane.getBoundingClientRect();
                const verseRect = verseEl.getBoundingClientRect();
                pane.scrollTop += verseRect.top - paneRect.top - 10;
            });
            const firstPane = scrollPaneRefs.value[0] as HTMLElement | null;
            if (firstPane) {
                const pos = getTopVisibleVerse(firstPane);
                if (pos) SESSION.set(storageScrollPositionKey, pos);
            }
        }

        // Always wait for DOM to settle after verse data changes
        nextTick(() => {
            requestAnimationFrame(doScroll);
        });
    }


    onUnmounted(() => {
        if (scrollSyncAnimationFrame !== null) cancelAnimationFrame(scrollSyncAnimationFrame);
        if (saveScrollTimeout !== null) clearTimeout(saveScrollTimeout);
    });
    return {
        storageSplitPaneSizesKey, splitPaneSizes, scrollPaneRefs, verseSkeletonRows,
        changeVersion, versionTitle, versionPickerOpen, versionPickerPane, openVersionPicker,
        onVersionPicked, addSplit, paneHasVisibleVerses, showVerseSkeletons, removeSplit,
        onSplitResized, restoreScrollPosition, onPaneMouseEnter, syncScroll, setScrollPaneRef,
        initSplitSizes, scrollAllPanesToVerse,
    };
}
