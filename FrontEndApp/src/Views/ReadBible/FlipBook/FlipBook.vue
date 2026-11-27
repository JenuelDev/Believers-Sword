<script lang="ts" setup>
import { ref, shallowRef, watch, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { NButton, NIcon, NInputNumber, NDropdown, NSlider, NSpin, NScrollbar, NModal, NCard, NInput } from 'naive-ui';
import { Icon } from '@iconify/vue';
import { useFlipbookStore } from '../../../store/flipbookStore';
import { useSettingStore } from '../../../store/settingStore';
import { useTTSStore } from '../../../store/ttsStore';
import { usePiperTTSStore } from '../../../store/piperTTSStore';
import { bibleBooks, type BookInfo } from '../../../util/books';
import { stripVerseHtml as stripHtml } from '../../../util/helper';

const flipbookStore = useFlipbookStore();
const settingStore = useSettingStore();
const mainTtsStore = useTTSStore();
const mainPiperStore = usePiperTTSStore();

const goToVerseNumber = ref<number | null>(null);
const showGoToInput = ref(false);

// Book/chapter picker state
const showBookPicker = ref(false);
const showChapterPicker = ref(false);
const pickerSelectedBook = ref<BookInfo | null>(null);
const bookSearchQuery = ref('');

const filteredBooks = computed(() => {
    const q = bookSearchQuery.value.toLowerCase().trim();
    if (!q) return bibleBooks;
    return bibleBooks.filter(b => b.title.toLowerCase().includes(q) || b.short_name.toLowerCase().includes(q));
});

function pickBook(book: BookInfo) {
    pickerSelectedBook.value = book;
    showBookPicker.value = false;
    showChapterPicker.value = true;
}

async function pickChapter(chapter: number) {
    showChapterPicker.value = false;
    if (!pickerSelectedBook.value) return;
    stopTTS();
    await flipbookStore.navigateToBook(pickerSelectedBook.value.book_number, chapter);
}

function openBookPicker() {
    bookSearchQuery.value = '';
    pickerSelectedBook.value = null;
    showBookPicker.value = true;
}
const flipDirection = ref<'next' | 'prev' | ''>('');
const isFlipping = ref(false);
const turnStarted = ref(false);
const turningPageHtml = ref('');
const outgoingPageHtml = ref('');
const pageContentRef = shallowRef<HTMLElement | null>(null);
let flipTimeout: ReturnType<typeof setTimeout> | null = null;
let flipGeneration = 0;
const scrollbarRef = ref<InstanceType<typeof NScrollbar> | null>(null);

function capturePage() {
    const content = pageContentRef.value;
    if (!content) return '';
    const offset = content.getBoundingClientRect().top - content.closest('.flipbook-page')!.getBoundingClientRect().top;
    const snapshot = content.cloneNode(true) as HTMLElement;
    snapshot.style.transform = `translateY(${Math.min(0, offset)}px)`;
    snapshot.querySelectorAll('button').forEach(button => button.setAttribute('tabindex', '-1'));
    return snapshot.outerHTML;
}

function finishFlip() {
    if (flipTimeout) clearTimeout(flipTimeout);
    flipTimeout = null;
    flipGeneration++;
    isFlipping.value = false;
    turnStarted.value = false;
    flipDirection.value = '';
    turningPageHtml.value = '';
    outgoingPageHtml.value = '';
}

function handleTurnEnd(event: AnimationEvent) {
    if (event.target === event.currentTarget) finishFlip();
}

// ── Self-contained TTS (reads from flipbook verses) ──
const ttsActiveVerse = ref<number | null>(null);
const ttsIsActive = ref(false);
let ttsCurrentIndex = -1;
let ttsStopped = false;
let ttsGeneration = 0;
let ttsPlayTimeout: ReturnType<typeof setTimeout> | null = null;
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;
let piperAudioContext: AudioContext | null = null;
let piperCurrentSource: AudioBufferSourceNode | null = null;

function startKeepAlive() {
    if (keepAliveInterval) return;
    keepAliveInterval = setInterval(() => {
        try {
            if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            }
        } catch { /* ignore */ }
    }, 10_000);
}

function stopKeepAlive() {
    if (keepAliveInterval) { clearInterval(keepAliveInterval); keepAliveInterval = null; }
}

function getPiperAudioContext(): AudioContext {
    if (!piperAudioContext || piperAudioContext.state === 'closed') {
        piperAudioContext = new AudioContext();
    }
    return piperAudioContext;
}

function stopPiperAudio() {
    try { piperCurrentSource?.stop(); } catch { /* ignore */ }
    piperCurrentSource = null;
}

// ── Browser TTS speak ──
function speakBrowserTTS(index: number, gen: number) {
    if (gen !== ttsGeneration) return;
    const verses = flipbookStore.verses;
    if (ttsStopped || index >= verses.length) { stopTTS(); return; }

    ttsCurrentIndex = index;
    const verse = verses[index];
    ttsActiveVerse.value = verse.verse;
    ttsIsActive.value = true;

    const text = stripHtml(verse.text);

    try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => { if (gen === ttsGeneration) ttsIsActive.value = true; };
        utterance.onend = () => { if (gen === ttsGeneration) speakBrowserTTS(index + 1, gen); };
        utterance.onerror = (e) => {
            if (e.error === 'interrupted' || e.error === 'canceled') return;
            if (gen === ttsGeneration) stopTTS();
        };
        window.speechSynthesis.speak(utterance);
    } catch {
        stopTTS();
    }
}

// ── Piper TTS speak ──
async function speakPiperTTS(index: number, gen: number) {
    if (gen !== ttsGeneration) return;
    const verses = flipbookStore.verses;
    if (ttsStopped || index >= verses.length) { stopTTS(); return; }

    ttsCurrentIndex = index;
    const verse = verses[index];
    ttsActiveVerse.value = verse.verse;
    ttsIsActive.value = true;

    const text = stripHtml(verse.text);

    try {
        const result = await (window as any).browserWindow.piperSpeak(text, settingStore.piperActiveModel);
        if (!result.success || !result.wav || gen !== ttsGeneration) return;

        const binary = atob(result.wav);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const ctx = getPiperAudioContext();
        const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
        if (gen !== ttsGeneration) return;

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        piperCurrentSource = source;

        source.onended = () => {
            if (gen === ttsGeneration) speakPiperTTS(index + 1, gen);
        };
        source.start();
    } catch {
        stopTTS();
    }
}

function playVerse(verseNumber: number) {
    const verseIndex = flipbookStore.verses.findIndex(v => v.verse === verseNumber);
    if (verseIndex < 0) return;

    const gen = ++ttsGeneration;
    ttsStopped = false;
    // Stop main reader TTS first
    mainTtsStore.stop();
    mainPiperStore.stop();
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    stopPiperAudio();
    stopKeepAlive();
    if (ttsPlayTimeout) { clearTimeout(ttsPlayTimeout); ttsPlayTimeout = null; }
    ttsIsActive.value = false;

    ttsPlayTimeout = setTimeout(() => {
        ttsPlayTimeout = null;
        if (gen !== ttsGeneration) return;
        if (settingStore.verseReaderMode === 'piper-tts') {
            speakPiperTTS(verseIndex, gen);
        } else {
            startKeepAlive();
            speakBrowserTTS(verseIndex, gen);
        }
    }, 50);
}

function stopTTS() {
    ++ttsGeneration;
    ttsStopped = true;
    if (ttsPlayTimeout) { clearTimeout(ttsPlayTimeout); ttsPlayTimeout = null; }
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    stopPiperAudio();
    stopKeepAlive();
    ttsActiveVerse.value = null;
    ttsIsActive.value = false;
    ttsCurrentIndex = -1;
}

async function turnPage(direction: 'next' | 'prev') {
    if (isFlipping.value || !flipbookStore.isOpen) return;
    if (direction === 'next' ? flipbookStore.currentPage >= flipbookStore.totalPages - 1 : flipbookStore.currentPage <= 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        direction === 'next' ? flipbookStore.nextPage() : flipbookStore.prevPage();
        return;
    }
    const generation = ++flipGeneration;
    outgoingPageHtml.value = capturePage();
    turningPageHtml.value = outgoingPageHtml.value;
    flipDirection.value = direction;
    isFlipping.value = true;
    direction === 'next' ? flipbookStore.nextPage() : flipbookStore.prevPage();
    await nextTick();
    if (generation !== flipGeneration) return;
    if (direction === 'prev') turningPageHtml.value = capturePage();
    turnStarted.value = true;
    // Animation end is authoritative; the timeout covers suspended renderers.
    flipTimeout = setTimeout(finishFlip, 900);
}

function handleNextPage() { void turnPage('next'); }
function handlePrevPage() { void turnPage('prev'); }

function handleGoToVerse() {
    if (goToVerseNumber.value) {
        finishFlip();
        flipbookStore.goToVerse(goToVerseNumber.value);
        showGoToInput.value = false;
        goToVerseNumber.value = null;
    }
}

function handleKeydown(e: KeyboardEvent) {
    if (!flipbookStore.isOpen) return;
    if (e.key === ' ') {
        e.preventDefault(); // prevent spacebar from re-triggering focused buttons
        return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') handleNextPage();
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') handlePrevPage();
    else if (e.key === 'Escape') flipbookStore.close();
}

const downloadOptions = [
    { label: 'Download as PDF', key: 'pdf' },
    { label: 'Download as Word (.docx)', key: 'word' },
];

function handleDownload(key: string) {
    switch (key) {
        case 'pdf': flipbookStore.downloadAsPdf(); break;
        case 'word': flipbookStore.downloadAsWord(); break;
    }
}

onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    finishFlip();
    document.removeEventListener('keydown', handleKeydown);
    stopTTS();
});

// Stop all TTS when flipbook closes
watch(() => flipbookStore.isOpen, (open) => {
    if (!open) {
        finishFlip();
        stopTTS();
        mainTtsStore.stop();
        mainPiperStore.stop();
    }
});

// Auto-navigate to the page containing the verse being read
watch(ttsActiveVerse, (verseNum) => {
    if (verseNum == null) return;
    const idx = flipbookStore.verses.findIndex(v => v.verse === verseNum);
    if (idx < 0) return;
    const targetPage = Math.floor(idx / flipbookStore.versesPerPage);
    if (targetPage !== flipbookStore.currentPage) {
        flipbookStore.currentPage = targetPage;
    }
});

// Auto-scroll to top of page when page changes
watch(() => [flipbookStore.activeBookNumber, flipbookStore.activeChapter, flipbookStore.selectedVersion], finishFlip);

watch(() => flipbookStore.currentPage, () => {
    scrollbarRef.value?.scrollTo({ top: 0, behavior: 'auto' });
}, { flush: 'post' });
</script>
<template>
    <Teleport to="body">
        <Transition name="flipbook-fade">
            <div v-if="flipbookStore.isOpen" class="flipbook-overlay">
                <!-- Toolbar -->
                <div class="flipbook-toolbar">
                    <div class="flipbook-toolbar-left">
                        <Icon icon="mdi:book-open-page-variant" style="font-size: 20px;" class="text-[var(--primary-color)]" />
                        <NButton size="tiny" quaternary title="Select Book & Chapter" @click="openBookPicker">
                            <span class="flipbook-title">{{ flipbookStore.bookTitle }} {{ flipbookStore.chapterNumber }}</span>
                            <Icon icon="mdi:chevron-down" style="font-size: 14px; margin-left: 2px;" class="opacity-60" />
                        </NButton>
                        <NButton size="tiny" quaternary title="Change Bible Version" @click="flipbookStore.changeVersion()">
                            <span class="text-xs opacity-60 whitespace-nowrap">({{ flipbookStore.versionDisplayName }})</span>
                            <Icon icon="mdi:chevron-down" style="font-size: 14px; margin-left: 2px;" class="opacity-60" />
                        </NButton>
                    </div>
                    <div class="flipbook-toolbar-right">
                        <div v-if="showGoToInput" class="flipbook-goto">
                            <NInputNumber
                                v-model:value="goToVerseNumber"
                                size="tiny"
                                placeholder="Verse"
                                :min="1"
                                :max="flipbookStore.verses.length"
                                style="width: 80px"
                                @keydown.enter="handleGoToVerse"
                            />
                            <NButton size="tiny" type="primary" @click="handleGoToVerse">Go</NButton>
                        </div>
                        <NButton size="small" quaternary circle title="Go to Verse" @click="showGoToInput = !showGoToInput">
                            <template #icon><Icon icon="mdi:target" style="font-size: 18px;" /></template>
                        </NButton>
                        <NDropdown trigger="click" :options="downloadOptions" @select="handleDownload">
                            <NButton size="small" quaternary circle title="Download Chapter">
                                <template #icon><Icon icon="mdi:download" style="font-size: 18px;" /></template>
                            </NButton>
                        </NDropdown>
                        <NButton v-if="ttsIsActive" size="small" quaternary circle title="Stop Reading" @click="stopTTS">
                            <template #icon><Icon icon="mdi:stop" style="font-size: 18px;" /></template>
                        </NButton>
                        <NButton size="small" quaternary circle title="Close (Esc)" @click="flipbookStore.close()">
                            <template #icon><Icon icon="mdi:close" style="font-size: 18px;" /></template>
                        </NButton>
                    </div>
                </div>

                <!-- Main area -->
                <div v-if="flipbookStore.isLoading" class="flipbook-loading">
                    <NSpin size="large" />
                </div>

                <div v-else class="flipbook-body">
                    <!-- Prev nav column -->
                    <div
                        class="flipbook-nav-col"
                        :class="{ disabled: flipbookStore.currentPage <= 0 }"
                        @click="handlePrevPage"
                        title="Previous page"
                    >
                        <Icon icon="mdi:chevron-left" style="font-size: 32px;" />
                    </div>

                    <!-- Page -->
                    <div class="flipbook-page-container">
                        <div class="flipbook-book" :class="{ 'is-turning': isFlipping }">
                            <div class="flipbook-page">
                                <NScrollbar ref="scrollbarRef">
                                    <div ref="pageContentRef" class="flipbook-page-inner">
                                        <div v-if="flipbookStore.currentPage === 0" class="flipbook-heading">
                                            <h1>{{ flipbookStore.bookTitle }} <span>{{ flipbookStore.chapterNumber }}</span></h1>
                                        </div>

                                        <!-- No verses loaded for this version/chapter -->
                                        <div v-if="flipbookStore.verses.length === 0" class="flipbook-empty">
                                            <Icon icon="mdi:book-alert-outline" class="flipbook-empty-icon" />
                                            <p class="flipbook-empty-title">
                                                {{ flipbookStore.loadError ? "Couldn't open this version" : 'No verses found here' }}
                                            </p>
                                            <p class="flipbook-empty-desc">
                                                This Bible version may not be fully downloaded, or doesn’t include
                                                {{ flipbookStore.bookTitle }} {{ flipbookStore.chapterNumber }}. Try a different version.
                                            </p>
                                            <NButton size="small" secondary @click="flipbookStore.changeVersion()">
                                                <template #icon><Icon icon="mdi:book-open-page-variant" /></template>
                                                Choose another version
                                            </NButton>
                                        </div>

                                        <div
                                            v-for="verse in flipbookStore.currentPageVerses"
                                            :key="verse.verse"
                                            class="flipbook-verse group"
                                        >
                                            <button
                                                class="flipbook-play-btn"
                                                :class="{ active: ttsActiveVerse === verse.verse }"
                                                :title="ttsActiveVerse === verse.verse ? 'Playing...' : 'Play from this verse'"
                                                @click="playVerse(verse.verse)"
                                            >
                                                <Icon
                                                    :icon="ttsActiveVerse === verse.verse ? 'mdi:account-voice' : 'mdi:play'"
                                                    style="font-size: 15px;"
                                                    :class="{ 'animate-pulse': ttsActiveVerse === verse.verse }"
                                                />
                                            </button>
                                            <div class="flipbook-verse-text" :style="{ fontSize: flipbookStore.fontSize + 'px' }">
                                                <span class="verse-num">{{ verse.verse }}.</span>
                                                <span>{{ stripHtml(verse.text) }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </NScrollbar>
                            </div>
                            <div
                                v-if="isFlipping && flipDirection === 'prev'"
                                class="flipbook-page-underlay"
                                aria-hidden="true"
                                inert
                                v-html="outgoingPageHtml"
                            ></div>
                            <div
                                v-if="turnStarted"
                                class="flipbook-turn-shadow"
                                :class="`turn-${flipDirection}`"
                                aria-hidden="true"
                            ></div>
                            <div
                                v-if="turnStarted"
                                class="flipbook-turn-sheet"
                                :class="`turn-${flipDirection}`"
                                aria-hidden="true"
                                inert
                                @animationend="handleTurnEnd"
                            >
                                <div class="flipbook-sheet-front" v-html="turningPageHtml"></div>
                                <div class="flipbook-sheet-back"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Next nav column -->
                    <div
                        class="flipbook-nav-col"
                        :class="{ disabled: flipbookStore.currentPage >= flipbookStore.totalPages - 1 }"
                        @click="handleNextPage"
                        title="Next page"
                    >
                        <Icon icon="mdi:chevron-right" style="font-size: 32px;" />
                    </div>
                </div>

                <!-- Bottom bar -->
                <div class="flipbook-footer">
                    <span class="flipbook-page-num">{{ flipbookStore.currentPage + 1 }} / {{ flipbookStore.totalPages }}</span>
                    <div class="flipbook-footer-controls">
                        <NButton size="tiny" quaternary @click="flipbookStore.fontSize = Math.max(12, flipbookStore.fontSize - 1)" title="Smaller text">
                            <Icon icon="mdi:minus" style="font-size: 14px;" />
                        </NButton>
                        <span class="text-xs" style="min-width: 20px; text-align: center;">{{ flipbookStore.fontSize }}</span>
                        <NButton size="tiny" quaternary @click="flipbookStore.fontSize = Math.min(32, flipbookStore.fontSize + 1)" title="Larger text">
                            <Icon icon="mdi:plus" style="font-size: 14px;" />
                        </NButton>
                        <NButton
                            size="tiny"
                            quaternary
                            :title="ttsIsActive ? 'Pause' : 'Play All'"
                            @click="ttsIsActive ? stopTTS() : playVerse(flipbookStore.currentPageVerses[0]?.verse ?? 1)"
                        >
                            <Icon :icon="ttsIsActive ? 'mdi:pause' : 'mdi:play'" style="font-size: 16px;" />
                        </NButton>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- Book picker modal -->
        <NModal v-model:show="showBookPicker">
            <NCard style="width: 600px; max-height: 80vh;" :title="$t('Select Book')" content-style="max-height: calc(80vh - 110px); overflow-y: auto; padding: 16px;">
                <template #header-extra>
                    <NInput v-model:value="bookSearchQuery" placeholder="Search books..." style="width: 180px" clearable size="small" />
                </template>
                <div class="mb-4">
                    <div class="text-sm font-600 opacity-50 mb-2 uppercase tracking-wide">Old Testament</div>
                    <div class="flex flex-wrap gap-2">
                        <NButton
                            v-for="book in filteredBooks.filter(b => !b.deuterocanonical && b.book_number < 470)"
                            :key="book.book_number"
                            secondary
                            round
                            size="small"
                            @click="pickBook(book)"
                        >
                            {{ book.title }}
                        </NButton>
                    </div>
                </div>
                <div>
                    <div class="text-sm font-600 opacity-50 mb-2 uppercase tracking-wide">New Testament</div>
                    <div class="flex flex-wrap gap-2">
                        <NButton
                            v-for="book in filteredBooks.filter(b => b.book_number >= 470)"
                            :key="book.book_number"
                            secondary
                            round
                            size="small"
                            @click="pickBook(book)"
                        >
                            {{ book.title }}
                        </NButton>
                    </div>
                </div>
            </NCard>
        </NModal>

        <!-- Chapter picker modal -->
        <NModal v-model:show="showChapterPicker">
            <NCard style="width: 500px;" :title="`${pickerSelectedBook?.title} — Select Chapter`">
                <div class="flex flex-wrap gap-2">
                    <NButton
                        v-for="ch in pickerSelectedBook?.chapter_count"
                        :key="ch"
                        secondary
                        size="small"
                        @click="pickChapter(ch)"
                    >
                        {{ ch }}
                    </NButton>
                </div>
            </NCard>
        </NModal>
    </Teleport>
</template>

<style lang="scss" scoped>
/* ── overlay ── */
.flipbook-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    background: #111318;
}

/* ── toolbar ── */
.flipbook-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 12px;
    background: #1c1e27;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
    color: #ccc;

    /* The toolbar is always dark, so force naive-ui's buttons/icons light
       regardless of the app's (light/dark) theme — otherwise they render
       dark-on-dark and are invisible. */
    :deep(.n-button) {
        --n-text-color: #cfd2da;
        --n-text-color-hover: #ffffff;
        --n-text-color-pressed: #ffffff;
        --n-text-color-focus: #ffffff;
        --n-text-color-disabled: rgba(255, 255, 255, 0.25);
        color: #cfd2da;
    }
    :deep(.n-button:hover) {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.08);
    }
}
.flipbook-toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}
.flipbook-title {
    font-weight: 600;
    font-size: 13px;
    white-space: nowrap;
}
.flipbook-toolbar-right {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
}
.flipbook-goto {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-right: 4px;
}

/* ── loading ── */
.flipbook-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* ── body: [nav] [page] [nav] ── */
.flipbook-body {
    flex: 1;
    display: flex;
    align-items: stretch;
    min-height: 0;
    overflow: hidden;
    gap: 0;
}

/* ── nav columns ── */
.flipbook-nav-col {
    width: 44px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.35);
    transition: color 0.15s, background 0.15s;
    user-select: none;

    &:hover:not(.disabled) {
        color: var(--primary-color, #e87a40);
        background: rgba(255, 255, 255, 0.03);
    }
    &.disabled {
        opacity: 0.15;
        cursor: default;
    }
}

/* ── page container ── */
.flipbook-page-container {
    flex: 1;
    min-width: 0;
    display: flex;
    justify-content: center;
    padding: 12px 0;
}

.flipbook-book {
    position: relative;
    width: 100%;
    max-width: 780px;
    min-width: 0;
    perspective: 2200px;
    perspective-origin: 35% 50%;
    isolation: isolate;

    &.is-turning { pointer-events: none; }
}

/* ── the page itself ── */
.flipbook-page {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #fefcf7;
    color: #2c2c2c;
    border-radius: 3px;
    box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.5),
        0 8px 30px rgba(0, 0, 0, 0.4);
}

.flipbook-page-underlay,
.flipbook-sheet-front,
.flipbook-sheet-back {
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: 3px;
    background: #fefcf7;
    color: #2c2c2c;
}

.flipbook-page-underlay { z-index: 1; }

.flipbook-turn-sheet {
    position: absolute;
    inset: 0;
    z-index: 3;
    transform-origin: left center;
    transform-style: preserve-3d;
    pointer-events: none;
    will-change: transform;
    animation-duration: 720ms;
    animation-timing-function: cubic-bezier(0.4, 0.08, 0.25, 1);
    animation-fill-mode: both;

    &.turn-next { animation-name: turnSheetForward; }
    &.turn-prev { animation-name: turnSheetBackward; }
}

.flipbook-sheet-front,
.flipbook-sheet-back {
    backface-visibility: hidden;
    box-shadow: 2px 0 4px rgba(0, 0, 0, 0.12), 12px 10px 28px rgba(0, 0, 0, 0.2);
}

.flipbook-sheet-front {
    transform: translateZ(0.5px);

    &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, rgba(90, 72, 45, 0.3), transparent 12%, rgba(255, 255, 255, 0.3) 65%, rgba(75, 58, 35, 0.12));
        animation: paperLight 720ms ease-in-out both;
    }
}

.flipbook-sheet-back {
    transform: rotateY(180deg) translateZ(0.5px);
    background: linear-gradient(90deg, #eee9dc, #fefcf7 18%, #faf6ec 80%, #d9d1c0);
}

.flipbook-turn-shadow {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background: linear-gradient(90deg, rgba(35, 25, 10, 0.32), rgba(35, 25, 10, 0.08) 45%, transparent);
    animation: pageShadow 720ms ease-in-out both;
}

.flipbook-page-inner {
    padding: 36px 52px;
}

@keyframes turnSheetForward {
    0% { transform: rotateY(0deg); }
    45% { transform: rotateY(-82deg); }
    100% { transform: rotateY(-180deg); }
}

@keyframes turnSheetBackward {
    0% { transform: rotateY(-180deg); }
    55% { transform: rotateY(-82deg); }
    100% { transform: rotateY(0deg); }
}

@keyframes paperLight {
    0%, 100% { opacity: 0.05; }
    45%, 65% { opacity: 0.8; }
}

@keyframes pageShadow {
    0%, 100% { opacity: 0; }
    45% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
    .flipbook-turn-sheet,
    .flipbook-turn-shadow,
    .flipbook-sheet-front::after { animation-duration: 1ms; }
}

/* ── chapter heading ── */
.flipbook-heading {
    text-align: center;
    margin-bottom: 24px;
    padding-bottom: 14px;
    border-bottom: 1px solid #ddd;

    h1 {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 26px;
        font-weight: 700;
        color: #1a1a1a;

        span {
            font-weight: 400;
            opacity: 0.65;
        }
    }
}

/* ── empty / error state ── */
.flipbook-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
    padding: 48px 16px;
    color: #6a6a6a;
}
.flipbook-empty-icon {
    font-size: 40px;
    opacity: 0.6;
}
.flipbook-empty-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 17px;
    font-weight: 700;
    color: #3a3a3a;
    margin: 4px 0 0;
}
.flipbook-empty-desc {
    font-size: 13px;
    line-height: 1.5;
    max-width: 340px;
    margin: 0 0 8px;
}

/* ── verse ── */
.flipbook-verse {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 5px 4px;
    border-radius: 4px;
    transition: background 0.15s;

    &:hover { background: rgba(0, 0, 0, 0.025); }
}

.flipbook-verse-text {
    flex: 1;
    font-family: Georgia, 'Times New Roman', serif;
    line-height: 1.75;
    color: #2c2c2c;
}

.verse-num {
    font-weight: 700;
    color: #666;
    margin-right: 3px;
    font-style: italic;
}

.flipbook-play-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    margin-top: 3px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: #999;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s, color 0.15s, background 0.15s;

    .group:hover & { opacity: 1; }
    &.active {
        opacity: 1;
        color: var(--primary-color, #e87a40);
    }
    &:hover {
        background: rgba(0, 0, 0, 0.06);
        color: var(--primary-color, #e87a40);
    }
}

/* ── footer ── */
.flipbook-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 16px;
    background: #1c1e27;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
    color: #999;

    /* Force naive-ui buttons light on the always-dark footer (see toolbar). */
    :deep(.n-button) {
        --n-text-color: #b8bcc6;
        --n-text-color-hover: #ffffff;
        --n-text-color-pressed: #ffffff;
        --n-text-color-focus: #ffffff;
        color: #b8bcc6;
    }
    :deep(.n-button:hover) {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.08);
    }
}
.flipbook-page-num {
    font-size: 12px;
}
.flipbook-footer-controls {
    display: flex;
    align-items: center;
    gap: 4px;
}

/* ── transition ── */
.flipbook-fade-enter-active,
.flipbook-fade-leave-active {
    transition: opacity 0.25s ease;
}
.flipbook-fade-enter-from,
.flipbook-fade-leave-to {
    opacity: 0;
}
</style>
