import { onBeforeMount, onMounted, onUnmounted, ref, watch, h, computed } from 'vue';
import { useBibleStore } from '../../../store/BibleStore';
import { useDialog } from 'naive-ui';
import SESSION from '../../../util/session';
import { useMouse } from '@vueuse/core';
import type { ClipNoteVerseRef } from './ContextMenu/ContextMenu.vue';
import { useBookmarkStore } from '../../../store/bookmark';
import { useClipNoteStore } from '../../../store/ClipNotes';
import { useI18n } from 'vue-i18n';
import { FastForward20Regular, SlideSearch28Regular } from '@vicons/fluent';
import { SlideSearch28Filled } from '@vicons/fluent';
import { useThemeStore } from '../../../store/theme';
import { useTTSStore } from '../../../store/ttsStore';
import { usePiperTTSStore } from '../../../store/piperTTSStore';
import { useSettingStore } from '../../../store/settingStore';
import { useMainStore } from '../../../store/main';
import { useFlipbookStore } from '../../../store/flipbookStore';
import { useImmersiveReaderStore } from '../../../store/immersiveReaderStore';
import { useModuleStore } from '../../../store/moduleStore';
import { useVersePanes } from './useVersePanes';
import { useVerseFonts } from './useVerseFonts';
import { useVerseFootnotes } from './useVerseFootnotes';
import { useStrongsPopover } from './useStrongsPopover';

export function useViewVerses() {
    const { t } = useI18n();
    const showPiperModels = ref(false);
    const voiceReaderLabel = computed(() => {
        return settingStore.verseReaderMode === 'piper-tts' ? 'Piper TTS' : 'Browser TTS';
    });
    const piperVoiceLabel = computed(() => {
        const id = settingStore.piperActiveModel;
        const parts = id.split('-');
        // parts: ['en_US', 'ryan', 'high'] → 'Ryan · High'
        const name = parts[1] ?? '';
        const quality = parts[2] ?? '';
        return `${name.charAt(0).toUpperCase() + name.slice(1)} · ${quality.charAt(0).toUpperCase() + quality.slice(1)}`;
    });
    const themeStore = useThemeStore();
    const ttsStore = useTTSStore();
    const piperStore = usePiperTTSStore();
    const settingStore = useSettingStore();
    const mainStore = useMainStore();
    const flipbookStore = useFlipbookStore();
    const immersiveReaderStore = useImmersiveReaderStore();
    const isElectron = Boolean(window.isElectron);
    const moduleStore = useModuleStore();
    const bibleStore = useBibleStore();
    const {
        storageSplitPaneSizesKey, splitPaneSizes, scrollPaneRefs, verseSkeletonRows,
        changeVersion, versionTitle, versionPickerOpen, versionPickerPane, openVersionPicker,
        onVersionPicked, addSplit, paneHasVisibleVerses, showVerseSkeletons, removeSplit,
        onSplitResized, restoreScrollPosition, onPaneMouseEnter, syncScroll, setScrollPaneRef,
        initSplitSizes, scrollAllPanesToVerse,
    } = useVersePanes({ bibleStore, moduleStore });

    function activeStore() {
        return settingStore.verseReaderMode === 'piper-tts' ? piperStore : ttsStore;
    }
    function playVerse(verseIndex: number, versionIndex: number) {
        // Stop both engines before playing to avoid overlap
        ttsStore.stop();
        piperStore.stop();
        switch (settingStore.verseReaderMode) {
            case 'piper-tts':
                if (!piperStore.isInstalled) {
                    dialog.warning({
                        title: 'Piper Not Installed',
                        content:
                            'Piper Neural TTS needs to be downloaded before use. Go to Settings → Verse Reader to install it.',
                        positiveText: 'Open Settings',
                        negativeText: 'Cancel',
                        onPositiveClick: () => {
                            mainStore.settingsTab = 'VerseReader';
                            mainStore.showSettings = true;
                        },
                    });
                    return;
                }
                piperStore.playFromVerse(verseIndex, versionIndex);
                break;
            case 'browser-tts':
            default:
                ttsStore.playFromVerse(verseIndex, versionIndex);
                break;
        }
    }
    const dialog = useDialog();
    const clipNoteStore = useClipNoteStore();
    const showContextMenu = ref(false);
    const contextMenuPositionX = ref<number>(0);
    const contextMenuPositionY = ref<number>(0);
    const contextMenuData = ref({});
    const contextMenuVerseKey = ref<string>('');
    const bookmarkStore = useBookmarkStore();
    const { x, y } = useMouse();
    let verseCopyListener: ((event: ClipboardEvent) => void) | null = null;
    const { footnotePopover, handleFootnoteHover } = useVerseFootnotes();
    const { strongsPopover, wrapStrongsWords, closeStrongsPopover, handleStrongsMouseDown, handleStrongsClick }
        = useStrongsPopover(() => settingStore.showStrongsNumbers);
    const createClipNoteRef = ref<null | { toggleClipNoteModal: Function }>(null);
    // Named handler (rather than an inline template arrow) so `data` gets its type
    // from an explicit annotation instead of relying on vue-tsc inferring it from
    // the ContextMenu emit signature, which this vue-tsc version does not do for
    // inline template listeners.
    function handleCreateClipNote(data: ClipNoteVerseRef) {
        createClipNoteRef.value?.toggleClipNoteModal(data);
    }
    const clipNoteRender: any = (key: any) => {
        return (clipNoteStore.chapterClipNotes as any)[key]
            ? (clipNoteStore.chapterClipNotes as any)[key]
            : false;
    };
    const { fontSizeOfShowChapter, fontSize, fontSelected, fontOptions, loadSystemFonts } = useVerseFonts();
    // Keep split sizes in sync with selected versions count
    watch(
        () => bibleStore.selectedBibleVersions.length,
        (count) => {
            if (splitPaneSizes.value.length !== count) {
                splitPaneSizes.value = Array(count).fill(100 / count);
                SESSION.set(storageSplitPaneSizesKey, splitPaneSizes.value);
            }
        },
    );
    // Stop TTS when the chapter or book changes , unless TTS itself triggered the chapter advance
    watch(
        () => [bibleStore.selectedChapter, bibleStore.selectedBookNumber],
        () => {
            const s = activeStore();
            if (s.isActive && !s.autoAdvancing) s.stop();
            clearVerseSelection();
        },
    );
    async function navigateChapter(action: 'next' | 'before') {
        if (action == 'before' && bibleStore.selectedChapter == 1) return;
        if (action == 'next' && bibleStore.selectedChapter == bibleStore.selectedBook.chapter_count)
            return;
        await bibleStore.selectChapter(
            action == 'next' ? bibleStore.selectedChapter + 1 : bibleStore.selectedChapter - 1,
        );
        bibleStore.AutoScrollSavedPosition();
    }
    function clickContextMenu(verse: Object, paneIndex: number) {
        const verseNum = (verse as any).verse;
        contextMenuData.value = verse;
        contextMenuVerseKey.value = (verse as any).key;
        if (selectedVersesSet.value.has(verseNum) && selectedVerseNumbers.value.length > 1) {
            contextMenuSelectedVerses.value = bibleStore.renderVerses
                .filter((v: any) => selectedVersesSet.value.has(v.verse))
                .map((v: any) => ({
                    book_number: v.book_number,
                    chapter: v.chapter,
                    verse: v.verse,
                    key: v.version[paneIndex]?.key ?? `${v.book_number}_${v.chapter}_${v.verse}`,
                }));
        } else {
            if (!selectedVersesSet.value.has(verseNum)) clearVerseSelection();
            contextMenuSelectedVerses.value = [];
        }
        if (showContextMenu.value) {
            showContextMenu.value = false;
            contextMenuVerseKey.value = '';
        } else {
            showContextMenu.value = true;
            contextMenuPositionX.value = x.value;
            contextMenuPositionY.value = y.value;
        }
    }
    watch(showContextMenu, (val) => {
        if (!val) contextMenuVerseKey.value = '';
    });
    function getCleanVerseTextForCopy(element: HTMLElement) {
        const clone = element.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('a, s, f').forEach((hiddenElement) => hiddenElement.remove());
        return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
    }
    function getSelectedVerseElements(selection: Selection) {
        if (!selection.rangeCount || !selection.toString().trim()) return [];
        const container = document.getElementById('view-verses-container');
        if (!container) return [];
        const range = selection.getRangeAt(0);
        return Array.from(container.querySelectorAll<HTMLElement>('.verse-select-text')).filter(
            (element) => {
                try {
                    return range.intersectsNode(element);
                } catch {
                    return false;
                }
            },
        );
    }
    function getSelectedPassageTextForCopy(includeRawFallback = true) {
        const selected = window.getSelection();
        if (!selected) return null;
        const selectedVerseElements = getSelectedVerseElements(selected);
        if (!selectedVerseElements.length) {
            return includeRawFallback ? selected.toString().trim() || null : null;
        }
        const selectedVerses = selectedVerseElements
            .map((element) => ({
                bookNumber: Number(element.dataset.book),
                chapter: Number(element.dataset.chapter),
                verse: Number(element.dataset.verse),
                text: getCleanVerseTextForCopy(element),
            }))
            .filter((verse) => verse.bookNumber && verse.chapter && verse.verse && verse.text);
        if (!selectedVerses.length) {
            return includeRawFallback ? selected.toString().trim() || null : null;
        }
        const firstVerse = selectedVerses[0];
        const lastVerse = selectedVerses[selectedVerses.length - 1];
        const bookName = bibleStore.getBook(firstVerse.bookNumber).title;
        const reference =
            firstVerse.verse === lastVerse.verse
                ? `${bookName} ${firstVerse.chapter}:${firstVerse.verse}`
                : `${bookName} ${firstVerse.chapter}:${firstVerse.verse}-${lastVerse.verse}`;
        return `"${selectedVerses.map((verse) => verse.text).join('\n')}"\n${reference}`;
    }
    function copySelectedPassageWithReference(event: ClipboardEvent) {
        const text = getSelectedPassageTextForCopy(false);
        if (!text || !event.clipboardData) return;
        event.clipboardData.setData('text/plain', text);
        event.preventDefault();
    }
    const selectedVerseNumbers = ref<number[]>([]);
    const lastMultiSelectVerse = ref<number | null>(null);
    const contextMenuSelectedVerses = ref<any[]>([]);
    const selectedVersesSet = computed(() => new Set(selectedVerseNumbers.value));
    function clearVerseSelection() {
        selectedVerseNumbers.value = [];
        lastMultiSelectVerse.value = null;
    }
    function handleVerseMouseDown(event: MouseEvent, verseNum: number) {
        if (event.button !== 0) return;
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            const idx = selectedVerseNumbers.value.indexOf(verseNum);
            if (idx >= 0) {
                selectedVerseNumbers.value.splice(idx, 1);
            } else {
                selectedVerseNumbers.value.push(verseNum);
                lastMultiSelectVerse.value = verseNum;
            }
            return;
        }
        if (event.shiftKey && lastMultiSelectVerse.value !== null) {
            event.preventDefault();
            const verses = bibleStore.renderVerses.map((v: any) => v.verse);
            const fromIdx = verses.indexOf(lastMultiSelectVerse.value);
            const toIdx = verses.indexOf(verseNum);
            if (fromIdx !== -1 && toIdx !== -1) {
                const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
                for (let i = start; i <= end; i++) {
                    const vNum = verses[i];
                    if (!selectedVersesSet.value.has(vNum)) {
                        selectedVerseNumbers.value.push(vNum);
                    }
                }
            }
            return;
        }
        bibleStore.setActiveVerse(verseNum);
    }
    const verseSelectorRef = ref<{ open: () => void } | null>(null);
    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            // Close the Strong's popover first, otherwise clear verse selection.
            if (strongsPopover.value.show) {
                closeStrongsPopover();
                return;
            }
            clearVerseSelection();
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
            event.preventDefault();
            verseSelectorRef.value?.open();
        }
    }
    function deleteClipNote(args: { book_number: number; chapter: number; verse: number }) {
        dialog.warning({
            title: t('Confirm'),
            content: t(
                'Are You Sure You want to remove? If you delete this clip note, you will not be able to undo it!',
            ),
            positiveText: t('Yes'),
            negativeText: t('No'),
            onPositiveClick: async () => {
                await clipNoteStore.deleteClipNote(args);
                await clipNoteStore.getChapterClipNotes(args.book_number, args.chapter);
            },
        });
    }
    onBeforeMount(() => {
        const savedFontSize = SESSION.get(fontSizeOfShowChapter);
        if (savedFontSize) fontSize.value = savedFontSize;
        initSplitSizes();
    });
    onMounted(() => {
        piperStore.checkInstalled();
        loadSystemFonts();
        restoreScrollPosition();
        // Scroll all panes when verse data changes (new chapter/book loaded)
        watch(
            () => bibleStore.verses,
            () => {
                scrollAllPanesToVerse(bibleStore.selectedVerse);
            },
        );
        // set initial font family
        const savedFontFamily = SESSION.get('font-family-of-show-chapter');
        if (savedFontFamily) {
            fontSelected.value = savedFontFamily;
            document.documentElement.style.setProperty('--bible-font-family', savedFontFamily);
        }
        const container = document.getElementById('view-verses-container');
        container?.addEventListener('dragstart', (event) => {
            event.preventDefault();
        });
        verseCopyListener = copySelectedPassageWithReference;
        document.addEventListener('copy', verseCopyListener);
        document.addEventListener('keydown', handleKeyDown);
        // Ctrl+scroll to change font size (works across all panes)
        container?.addEventListener('wheel', (event) => {
            if (event.ctrlKey) {
                if (event.deltaY > 0) {
                    if (fontSize.value <= 10) return;
                    fontSize.value--;
                } else if (event.deltaY < 0) {
                    fontSize.value++;
                }
                event.preventDefault();
            }
        });
    });
    onUnmounted(() => {
        if (verseCopyListener) {
            document.removeEventListener('copy', verseCopyListener);
        }
        document.removeEventListener('keydown', handleKeyDown);
    });
    return {
        h,
        FastForward20Regular,
        SlideSearch28Regular,
        SlideSearch28Filled,
        showPiperModels,
        voiceReaderLabel,
        piperVoiceLabel,
        themeStore,
        piperStore,
        settingStore,
        mainStore,
        flipbookStore,
        immersiveReaderStore,
        isElectron,
        bibleStore,
        splitPaneSizes,
        verseSkeletonRows,
        versionTitle,
        versionPickerOpen,
        versionPickerPane,
        openVersionPicker,
        onVersionPicked,
        addSplit,
        paneHasVisibleVerses,
        showVerseSkeletons,
        removeSplit,
        onSplitResized,
        onPaneMouseEnter,
        syncScroll,
        setScrollPaneRef,
        activeStore,
        playVerse,
        showContextMenu,
        contextMenuPositionX,
        contextMenuPositionY,
        contextMenuData,
        contextMenuVerseKey,
        bookmarkStore,
        footnotePopover,
        handleFootnoteHover,
        strongsPopover,
        wrapStrongsWords,
        handleStrongsMouseDown,
        handleStrongsClick,
        createClipNoteRef,
        handleCreateClipNote,
        clipNoteRender,
        fontSize,
        fontSelected,
        fontOptions,
        navigateChapter,
        clickContextMenu,
        selectedVerseNumbers,
        contextMenuSelectedVerses,
        selectedVersesSet,
        clearVerseSelection,
        handleVerseMouseDown,
        deleteClipNote,
    };
}
