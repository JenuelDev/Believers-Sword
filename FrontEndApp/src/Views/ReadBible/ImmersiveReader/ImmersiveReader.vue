<script lang="ts" setup>
import { computed, nextTick, onUnmounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useImmersiveReaderStore } from '../../../store/immersiveReaderStore';

const readerStore = useImmersiveReaderStore();
const { t } = useI18n();

const readingSurface = shallowRef<HTMLElement | null>(null);
const closeButton = shallowRef<HTMLButtonElement | null>(null);
let previousFocus: HTMLElement | null = null;
const modifierHeld = ref(false);
const isMac = ref(false);
let navigationInFlight = false;
const captureListenerOptions: AddEventListenerOptions = { capture: true };

const modifierLabel = computed(() => (isMac.value ? '⌘' : 'Ctrl'));

function clearModifierState() {
    modifierHeld.value = false;
}

function updateModifierState(event: KeyboardEvent) {
    if (!readerStore.isOpen) {
        clearModifierState();
        return;
    }

    modifierHeld.value = isMac.value ? event.metaKey : event.ctrlKey;
}

function scrollReadingSurface(amount: number) {
    readingSurface.value?.scrollBy({ top: amount, behavior: 'smooth' });
}

async function changeChapter(direction: 'next' | 'prev') {
    if (!readerStore.isOpen || readerStore.isLoading || navigationInFlight) return;

    navigationInFlight = true;
    try {
        await readerStore.navigateChapter(direction);
    } catch {
        // The store owns the loading/error state. Keep the reading surface quiet.
    } finally {
        navigationInFlight = false;
    }
}

function handleKeydown(event: KeyboardEvent) {
    if (!readerStore.isOpen) return;

    updateModifierState(event);
    // Keep application shortcuts behind the overlay quiet, while retaining
    // native copy and operating-system shortcuts unless handled below.
    event.stopImmediatePropagation();
    if (event.altKey || event.isComposing) return;
    if (event.ctrlKey || event.metaKey) {
        if (event.key.toLowerCase() === 'c') return;
        if (event.key.toLowerCase() === 'a') {
            event.preventDefault();
            if (readingSurface.value) {
                const range = document.createRange();
                range.selectNodeContents(readingSurface.value);
                const selection = window.getSelection();
                selection?.removeAllRanges();
                selection?.addRange(range);
            }
            return;
        }
    }
    if (event.key === 'Tab') {
        event.preventDefault();
        closeButton.value?.focus();
        return;
    }
    // Preserve native keyboard activation of the visible exit button.
    if (event.target === closeButton.value && (event.key === ' ' || event.key === 'Enter')) return;

    const handledKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End', 'PageUp', 'PageDown', ' ', '+', '=', '-', 'Escape'];
    if (!handledKeys.includes(event.key)) return;
    event.preventDefault();

    switch (event.key) {
        case 'ArrowLeft':
            void changeChapter('prev');
            break;
        case 'ArrowRight':
            void changeChapter('next');
            break;
        case 'ArrowUp':
            scrollReadingSurface(-160);
            break;
        case 'ArrowDown':
            scrollReadingSurface(160);
            break;
        case 'PageUp':
        case 'PageDown':
        case ' ': {
            const page = (readingSurface.value?.clientHeight ?? 500) * 0.9;
            scrollReadingSurface(event.key === 'PageUp' || (event.key === ' ' && event.shiftKey) ? -page : page);
            break;
        }
        case 'Home':
            readingSurface.value?.scrollTo({ top: 0, behavior: 'smooth' });
            break;
        case 'End':
            if (readingSurface.value) {
                readingSurface.value.scrollTo({ top: readingSurface.value.scrollHeight, behavior: 'smooth' });
            }
            break;
        case '+':
        case '=':
            readerStore.adjustFontSize(1);
            break;
        case '-':
            readerStore.adjustFontSize(-1);
            break;
        case 'Escape':
            clearModifierState();
            readerStore.close();
            break;
    }
}

function handleKeyup(event: KeyboardEvent) {
    if (event.key === 'Control' || event.key === 'Meta') {
        clearModifierState();
        if (readerStore.isOpen) event.stopImmediatePropagation();
        return;
    }

    // A keyup for another key can still carry the modifier state. Reconcile it
    // so the sheet cannot remain visible after an unusual key sequence.
    updateModifierState(event);
    if (readerStore.isOpen) event.stopImmediatePropagation();
}

function handleWindowBlur() {
    clearModifierState();
}

function handleCopy(event: ClipboardEvent) {
    // Let the browser copy the native selection without the main reader's
    // passage-copy handler substituting its own selected verses.
    event.stopImmediatePropagation();
}

function removeListeners() {
    document.removeEventListener('keydown', handleKeydown, captureListenerOptions);
    document.removeEventListener('keyup', handleKeyup, captureListenerOptions);
    document.removeEventListener('copy', handleCopy, captureListenerOptions);
    window.removeEventListener('blur', handleWindowBlur);
    document.removeEventListener('visibilitychange', handleWindowBlur);
}

function focusReadingSurface() {
    nextTick(() => readingSurface.value?.focus({ preventScroll: true }));
}

watch(
    () => readerStore.isOpen,
    (isOpen) => {
        clearModifierState();
        removeListeners();
        if (isOpen) {
            previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            document.addEventListener('keydown', handleKeydown, captureListenerOptions);
            document.addEventListener('keyup', handleKeyup, captureListenerOptions);
            document.addEventListener('copy', handleCopy, captureListenerOptions);
            window.addEventListener('blur', handleWindowBlur);
            document.addEventListener('visibilitychange', handleWindowBlur);
            focusReadingSurface();
        } else {
            nextTick(() => previousFocus?.isConnected && previousFocus.focus({ preventScroll: true }));
        }
    },
    { immediate: true, flush: 'post' },
);

watch(
    () => [readerStore.bookTitle, readerStore.activeChapter] as const,
    () => {
        if (!readerStore.isOpen) return;
        nextTick(() => readingSurface.value?.scrollTo({ top: 0, behavior: 'auto' }));
    },
);

isMac.value = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

onUnmounted(() => {
    removeListeners();
    clearModifierState();
    if (readerStore.isOpen) readerStore.close();
});
</script>

<template>
    <Teleport to="body">
        <div
            v-if="readerStore.isOpen"
            class="immersive-reader"
            role="dialog"
            aria-modal="true"
            :aria-label="t('immersive.title')"
        >
            <button ref="closeButton" type="button" class="immersive-reader__close" @click="readerStore.close()">
                {{ t('immersive.leave') }} <span aria-hidden="true">(Esc)</span>
            </button>
            <main ref="readingSurface" class="immersive-reader__scroll" tabindex="-1">
                <article class="immersive-reader__page">
                    <header class="immersive-reader__heading">
                        <h1>
                            <span>{{ readerStore.bookTitle ? t(readerStore.bookTitle) : '' }}</span>
                            <span class="immersive-reader__chapter">{{ readerStore.activeChapter }}</span>
                        </h1>
                    </header>

                    <p v-if="readerStore.isLoading" class="immersive-reader__status" aria-live="polite">{{ t('immersive.loading') }}</p>
                    <p v-else-if="readerStore.loadError" class="immersive-reader__status" aria-live="polite">
                        {{ t('immersive.unavailable') }}
                    </p>
                    <p v-else-if="readerStore.verses.length === 0" class="immersive-reader__status" aria-live="polite">
                        {{ t('immersive.empty') }}
                    </p>
                    <div v-else class="immersive-reader__verses">
                        <p
                            v-for="(verse, index) in readerStore.verses"
                            :key="`${verse.verse}-${index}`"
                            class="immersive-reader__verse"
                            :style="{ '--reader-font-size': `${readerStore.fontSize}px` }"
                        >
                            <span class="immersive-reader__verse-number">{{ verse.verse }}</span>
                            <span class="immersive-reader__verse-text">{{ verse.text }}</span>
                        </p>
                    </div>
                </article>
            </main>

            <aside v-if="modifierHeld" class="immersive-reader__shortcuts" :aria-label="t('immersive.shortcuts')">
                <div class="immersive-reader__shortcut immersive-reader__shortcut--exit">
                    <kbd class="immersive-reader__key">Esc</kbd>
                    <span class="immersive-reader__shortcut-label">{{ t('immersive.leave') }}</span>
                </div>

                <div class="immersive-reader__shortcut immersive-reader__shortcut--font">
                    <span class="immersive-reader__keys">
                        <kbd class="immersive-reader__key">−</kbd>
                        <kbd class="immersive-reader__key">+</kbd>
                    </span>
                    <span class="immersive-reader__shortcut-label">{{ t('immersive.textSize') }}</span>
                </div>

                <div
                    class="immersive-reader__shortcut immersive-reader__shortcut--previous"
                >
                    <kbd class="immersive-reader__key">←</kbd>
                    <span class="immersive-reader__shortcut-label">{{ t('immersive.previous') }}</span>
                </div>

                <div class="immersive-reader__shortcut immersive-reader__shortcut--next">
                    <span class="immersive-reader__shortcut-label">{{ t('immersive.next') }}</span>
                    <kbd class="immersive-reader__key">→</kbd>
                </div>

                <div class="immersive-reader__shortcut immersive-reader__shortcut--scroll">
                    <span class="immersive-reader__keys">
                        <kbd class="immersive-reader__key">↑</kbd>
                        <kbd class="immersive-reader__key">↓</kbd>
                    </span>
                    <span class="immersive-reader__shortcut-label">{{ t('immersive.scroll') }}</span>
                </div>

                <div class="immersive-reader__shortcut immersive-reader__shortcut--range">
                    <span class="immersive-reader__keys">
                        <kbd class="immersive-reader__key immersive-reader__key--wide">Home</kbd>
                        <kbd class="immersive-reader__key immersive-reader__key--wide">End</kbd>
                    </span>
                    <span class="immersive-reader__shortcut-label">{{ t('immersive.range') }}</span>
                </div>

                <p class="immersive-reader__shortcuts-hint">{{ t('immersive.hint', { modifier: modifierLabel }) }}</p>
            </aside>
        </div>
    </Teleport>
</template>

<style scoped lang="scss">
.immersive-reader {
    -webkit-app-region: no-drag;
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    overflow: hidden;
    background: var(--theme-bg-main, #ffffff);
    color: var(--theme-text, #252525);
}

.immersive-reader__close {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 2;
    padding: 0.4rem 0.65rem;
    border: 1px solid var(--theme-border, #888);
    border-radius: 0.4rem;
    background: var(--theme-bg-main, #ffffff);
    color: inherit;
    cursor: pointer;
}

.immersive-reader__scroll {
    width: 100%;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    outline: none;
}

.immersive-reader__page {
    width: min(100%, 52rem);
    min-height: 100%;
    box-sizing: border-box;
    margin: 0 auto;
    padding: clamp(3rem, 10vh, 7rem) clamp(1.25rem, 5vw, 3.75rem) 7rem;
}

.immersive-reader__heading {
    margin: 0 0 clamp(2.25rem, 6vh, 4rem);
    text-align: center;

    h1 {
        margin: 0;
        color: var(--theme-text, #252525);
        font-family: Georgia, 'Times New Roman', serif;
        font-size: clamp(1.7rem, 3.5vw, 2.45rem);
        font-weight: 600;
        letter-spacing: -0.025em;
        line-height: 1.2;
    }
}

.immersive-reader__chapter {
    margin-left: 0.35em;
    color: var(--theme-text-soft, #747474);
    font-weight: 400;
}

.immersive-reader__verses {
    font-family: Georgia, 'Times New Roman', serif;
}

.immersive-reader__verse {
    margin: 0 0 1.25rem;
    color: var(--theme-text, #252525);
    font-size: var(--reader-font-size, 18px);
    line-height: 1.9;
}

.immersive-reader__verse-number {
    display: inline-block;
    min-width: 1.65em;
    margin-right: 0.25em;
    color: var(--theme-text-soft, #747474);
    font-size: 0.64em;
    font-style: normal;
    font-weight: 700;
    line-height: 1;
    text-align: right;
    vertical-align: 0.38em;
}

.immersive-reader__verse-text {
    white-space: pre-wrap;
}

.immersive-reader__status {
    margin: 4rem auto 0;
    color: var(--theme-text-soft, #747474);
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.1rem;
    text-align: center;
}

.immersive-reader__shortcuts {
    position: fixed;
    inset: 0;
    z-index: 1;
    pointer-events: none;
}

.immersive-reader__shortcut {
    position: absolute;
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    box-sizing: border-box;
    padding: 0.32rem 0.45rem;
    border: 1px solid var(--theme-border, rgba(90, 90, 90, 0.2));
    border-radius: 0.55rem;
    background: color-mix(in srgb, var(--theme-bg-elevated, #ffffff) 92%, transparent);
    box-shadow: 0 0.45rem 1.4rem rgba(0, 0, 0, 0.12);
    color: var(--theme-text, #252525);
    font-family: inherit;
    font-size: 0.72rem;
    line-height: 1.2;
    white-space: nowrap;
    backdrop-filter: blur(12px);
}

.immersive-reader__shortcut--exit {
    top: 3.5rem;
    left: 1.25rem;
}

.immersive-reader__shortcut--font {
    top: 1.25rem;
    right: 1.25rem;
}

.immersive-reader__shortcut--previous {
    top: 50%;
    left: 1.25rem;
    transform: translateY(-50%);
}

.immersive-reader__shortcut--next {
    top: 50%;
    right: 1.25rem;
    transform: translateY(-50%);
}

.immersive-reader__shortcut--scroll,
.immersive-reader__shortcut--range {
    bottom: 1.25rem;
}

.immersive-reader__shortcut--scroll {
    left: 50%;
    transform: translateX(calc(-100% - 0.35rem));
}

.immersive-reader__shortcut--range {
    left: 50%;
    transform: translateX(0.35rem);
}

.immersive-reader__keys {
    display: inline-flex;
    align-items: center;
    gap: 0.18rem;
}

.immersive-reader__key {
    display: inline-flex;
    min-width: 1.55rem;
    height: 1.45rem;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    padding: 0.1rem 0.28rem;
    border: 1px solid var(--theme-border, rgba(90, 90, 90, 0.28));
    border-bottom-width: 2px;
    border-radius: 0.35rem;
    background: color-mix(in srgb, var(--theme-bg-main, #ffffff) 82%, var(--theme-text, #252525));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
    color: var(--theme-text, #252525);
    font-family: inherit;
    font-size: 0.68rem;
    font-weight: 700;
    line-height: 1;
    text-align: center;
}

.immersive-reader__key--wide {
    min-width: 2.6rem;
    font-size: 0.61rem;
}

.immersive-reader__shortcut-label {
    color: var(--theme-text-soft, #747474);
    font-weight: 600;
}

.immersive-reader__shortcuts-hint {
    position: absolute;
    bottom: 0.35rem;
    left: 50%;
    margin: 0;
    transform: translateX(-50%);
    color: var(--theme-text-soft, #747474);
    font-size: 0.62rem;
    text-align: center;
    white-space: nowrap;
}

@media (max-width: 520px) {
    .immersive-reader__shortcut {
        gap: 0.3rem;
        padding: 0.27rem 0.35rem;
        font-size: 0.66rem;
    }

    .immersive-reader__shortcut--exit {
        top: 3.5rem;
        left: 0.75rem;
    }

    .immersive-reader__shortcut--font {
        top: 0.75rem;
        right: 0.75rem;
    }

    .immersive-reader__shortcut--previous {
        left: 0.55rem;
    }

    .immersive-reader__shortcut--next {
        right: 0.55rem;
    }

    .immersive-reader__shortcut--previous .immersive-reader__shortcut-label,
    .immersive-reader__shortcut--next .immersive-reader__shortcut-label {
        display: none;
    }

    .immersive-reader__shortcut--scroll {
        left: 0.75rem;
        transform: none;
    }

    .immersive-reader__shortcut--range {
        right: 0.75rem;
        left: auto;
        transform: none;
    }

    .immersive-reader__shortcuts-hint {
        bottom: 0.2rem;
        max-width: calc(100vw - 1.5rem);
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .immersive-reader__key {
        min-width: 1.4rem;
        height: 1.35rem;
        font-size: 0.64rem;
    }

    .immersive-reader__key--wide {
        min-width: 2.25rem;
        font-size: 0.56rem;
    }
}

@media (max-width: 380px) {
    .immersive-reader__shortcut--font {
        top: 0.5rem;
    }

    .immersive-reader__shortcut--exit {
        left: 0.45rem;
    }

    .immersive-reader__shortcut--font {
        right: 0.45rem;
    }

    .immersive-reader__shortcut--scroll {
        left: 0.45rem;
    }

    .immersive-reader__shortcut--range {
        right: 0.45rem;
    }

    .immersive-reader__shortcut-label {
        max-width: 3.3rem;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .immersive-reader__shortcuts-hint {
        display: none;
    }
}
</style>
