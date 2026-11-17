import { ref, onUnmounted } from 'vue';

export function useStrongsPopover(isEnabled: () => boolean) {
    // --- Strong's numbers -------------------------------------------------------
    // The verse markup embeds bare Strong's numbers in <s> tags (e.g.
    // "God<s>430</s>"). Old Testament books (book_number < 470) are Hebrew (H),
    // the New Testament (>= 470) is Greek (G).
    const strongsPopover = ref<{
        show: boolean;
        x: number;
        y: number;
        below: boolean;
        loading: boolean;
        entry: any | null;
        maxHeight: number;
    }>({ show: false, x: 0, y: 0, below: false, loading: false, entry: null, maxHeight: 320 });

    let strongsRequestId = 0;
    // The Strong's word the popover is currently anchored to, so clicking the same
    // word again toggles it closed (clicking a different word moves it instead).
    let activeStrongsEl: HTMLElement | null = null;

    // Reading-first lexicon affordance: replace each "word<s>NNN</s>" with the bare
    // word wrapped in a clickable, dotted-underlined span (the number is dropped
    // from view , it still appears in the popover header). The optional middle group
    // handles red-letter words where a closing tag (e.g. </j>) sits between the word
    // and its <s> tag, and search-highlight wrappers (</span>) , the tag is consumed
    // and re-emitted so nesting stays valid.
    function wrapStrongsWords(html: string): string {
        if (!html) return html;
        return html.replace(
            /([^\s<>]+)((?:<\/[a-zA-Z]+>)?)<[sS]>\s*(\d+)\s*<\/[sS]>/g,
            (_m, word, closeTag, num) =>
                `<span class="strongs-word" data-strong="${num}">${word}</span>${closeTag}`,
        );
    }

    function closeStrongsPopover() {
        strongsRequestId++;
        strongsPopover.value.show = false;
        strongsPopover.value.entry = null;
        activeStrongsEl = null;
        window.removeEventListener('mousedown', onStrongsOutsideClick, true);
        window.removeEventListener('scroll', onStrongsScroll, true);
    }

    function onStrongsOutsideClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        // Keep open when interacting inside the popover (scroll, select text).
        if (target?.closest?.('.strongs-tooltip')) return;
        // A LEFT-click on another Strong's word is re-handled by
        // handleStrongsClick (toggle/move), so don't close here. Any other button
        // (e.g. right-click for the context menu) dismisses the popover.
        if (event.button === 0 && target?.closest?.('.strongs-word')) return;
        closeStrongsPopover();
    }

    // Close when the verse list scrolls (the popover is pinned to the badge), but
    // not when scrolling inside the popover's own body.
    function onStrongsScroll(event: Event) {
        const target = event.target;
        if (target instanceof Element && target.closest('.strongs-tooltip')) return;
        closeStrongsPopover();
    }

    async function openStrongsPopover(strongsEl: HTMLElement, verse: any) {
        // Toggle: clicking the same word again closes the open popover.
        if (strongsPopover.value.show && activeStrongsEl === strongsEl) {
            closeStrongsPopover();
            return;
        }

        const raw = (strongsEl.dataset.strong ?? '').replace(/\D/g, '');
        if (!raw) return;

        const prefix = Number(verse.book_number) >= 470 ? 'G' : 'H';
        const key = `${prefix}${raw}`;

        const rect = strongsEl.getBoundingClientRect();
        // Place the popover on whichever side of the badge has more room, and cap
        // its height to that space so a long definition scrolls internally instead
        // of overflowing past the viewport edge.
        const margin = 12; // keep this far from the viewport's top/bottom
        const gap = 8; // distance between the badge and the popover
        const chrome = 24; // popover padding + arrow allowance
        const spaceAbove = rect.top - margin - gap;
        const spaceBelow = window.innerHeight - rect.bottom - margin - gap;
        const below = spaceBelow > spaceAbove;
        const maxHeight = Math.max(120, Math.min(320, (below ? spaceBelow : spaceAbove) - chrome));
        const requestId = ++strongsRequestId;
        activeStrongsEl = strongsEl;
        strongsPopover.value = {
            show: true,
            x: rect.left + rect.width / 2,
            y: below ? rect.bottom + gap : rect.top - gap,
            below,
            loading: true,
            entry: null,
            maxHeight,
        };

        window.addEventListener('mousedown', onStrongsOutsideClick, true);
        window.addEventListener('scroll', onStrongsScroll, true);

        try {
            const entry = await (window as any).browserWindow.getStrongsDefinition(key);
            if (requestId !== strongsRequestId) return; // superseded by a newer tap
            strongsPopover.value.loading = false;
            strongsPopover.value.entry = entry;
        } catch (e) {
            if (requestId !== strongsRequestId) return;
            strongsPopover.value.loading = false;
            strongsPopover.value.entry = null;
        }
    }

    let press: {
        word: HTMLElement;
        verse: { book_number: number };
        x: number;
        y: number;
        dragged: boolean;
        released: boolean;
    } | null = null;

    function cancelStrongsPress() {
        press = null;
        window.removeEventListener('mousemove', trackStrongsPress, true);
        window.removeEventListener('mouseup', releaseStrongsPress, true);
        window.removeEventListener('blur', cancelStrongsPress);
        window.removeEventListener('pointercancel', cancelStrongsPress, true);
    }

    function trackStrongsPress(event: MouseEvent) {
        if (!press || press.dragged) return;
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5) {
            press.dragged = true;
            closeStrongsPopover();
        }
    }

    function releaseStrongsPress(event: MouseEvent) {
        trackStrongsPress(event);
        const word = (event.target as Element | null)?.closest?.('.strongs-word');
        if (!press || press.dragged || event.button !== 0 || word !== press.word) {
            cancelStrongsPress();
            return;
        }
        press.released = true;
        window.removeEventListener('mousemove', trackStrongsPress, true);
        window.removeEventListener('mouseup', releaseStrongsPress, true);
    }

    function handleStrongsMouseDown(event: MouseEvent, verse: { book_number: number }) {
        cancelStrongsPress();
        if (!isEnabled() || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
        const word = (event.target as Element | null)?.closest?.('.strongs-word') as HTMLElement | null;
        if (!word) return;

        // Preserve native caret/selection behavior, but avoid changing the verse mid-gesture.
        event.stopPropagation();
        if (event.detail > 1) {
            closeStrongsPopover();
            return;
        }
        press = { word, verse, x: event.clientX, y: event.clientY, dragged: false, released: false };
        window.addEventListener('mousemove', trackStrongsPress, true);
        window.addEventListener('mouseup', releaseStrongsPress, true);
        window.addEventListener('blur', cancelStrongsPress);
        window.addEventListener('pointercancel', cancelStrongsPress, true);
    }

    function handleStrongsClick(event: MouseEvent) {
        const finishedPress = press;
        cancelStrongsPress();
        if (!finishedPress?.released || finishedPress.dragged || !isEnabled()) return;
        if (event.button !== 0 || event.detail > 1 || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (window.getSelection()?.isCollapsed === false) {
            closeStrongsPopover();
            return;
        }
        const word = (event.target as Element | null)?.closest?.('.strongs-word');
        if (word !== finishedPress.word || !finishedPress.word.isConnected) return;
        event.stopPropagation();
        void openStrongsPopover(finishedPress.word, finishedPress.verse);
    }

    onUnmounted(() => {
        cancelStrongsPress();
        closeStrongsPopover();
    });
    return { strongsPopover, wrapStrongsWords, closeStrongsPopover, handleStrongsMouseDown, handleStrongsClick };
}
