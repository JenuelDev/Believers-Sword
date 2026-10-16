import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';

type Limits = { min: number; max: number };

/** One mouse-wheel notch (~100px) zooms ~20%; small trackpad-pinch deltas stay smooth. */
export function wheelZoom(zoom: number, deltaY: number, { min, max }: Limits) {
    return Math.min(max, Math.max(min, zoom * Math.exp(-deltaY * 0.002)));
}

function isTyping(target: EventTarget | null) {
    return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/**
 * Ctrl+wheel zooms around the cursor and Space+drag pans a scrollable `viewport`.
 * The cursor anchor is restored once `content` actually resizes, so it also works for
 * PDF canvases that only resize after an async render.
 */
export function usePanZoom(viewport: Ref<HTMLElement | undefined>, content: Ref<HTMLElement | undefined>, zoom: Ref<number>, limits: Limits) {
    const spaceHeld = ref(false);
    const dragging = ref(false);
    const cursor = computed(() => dragging.value ? 'grabbing' : spaceHeld.value ? 'grab' : undefined);
    let anchor: { x: number; y: number; fx: number; fy: number } | undefined;
    let drag: { x: number; y: number; left: number; top: number } | undefined;

    const observer = new ResizeObserver(() => {
        const box = viewport.value;
        if (!anchor || !box || !content.value) return;
        const rect = content.value.getBoundingClientRect();
        box.scrollTo({
            left: box.scrollLeft + rect.left + anchor.fx * rect.width - anchor.x,
            top: box.scrollTop + rect.top + anchor.fy * rect.height - anchor.y,
            behavior: 'instant',
        });
        anchor = undefined;
    });
    watch(content, (element, previous) => {
        if (previous) observer.unobserve(previous);
        if (element) observer.observe(element);
    }, { immediate: true });
    watch(viewport, element => {
        if (element) return;
        spaceHeld.value = false;
        stopDrag();
    });

    function onWheel(event: WheelEvent) {
        if (!event.ctrlKey || !content.value) return;
        event.preventDefault();
        const next = wheelZoom(zoom.value, event.deltaY, limits);
        if (next === zoom.value) return;
        const rect = content.value.getBoundingClientRect();
        const fraction = (offset: number, size: number) => Math.min(1, Math.max(0, offset / size));
        anchor = rect.width && rect.height ? { x: event.clientX, y: event.clientY,
            fx: fraction(event.clientX - rect.left, rect.width), fy: fraction(event.clientY - rect.top, rect.height) } : undefined;
        zoom.value = next;
    }

    function onMouseDown(event: MouseEvent) {
        if (!spaceHeld.value || event.button !== 0 || !viewport.value) return;
        event.preventDefault();
        drag = { x: event.clientX, y: event.clientY, left: viewport.value.scrollLeft, top: viewport.value.scrollTop };
        dragging.value = true;
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', stopDrag);
    }
    function onMouseMove(event: MouseEvent) {
        if (!drag || !viewport.value) return;
        // Set both axes together and bypass the app-wide smooth scroll rule.
        // Separate smooth assignments can cancel the other axis's animation.
        viewport.value.scrollTo({
            left: drag.left - (event.clientX - drag.x),
            top: drag.top - (event.clientY - drag.y),
            behavior: 'instant',
        });
    }
    function stopDrag() {
        drag = undefined;
        dragging.value = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', stopDrag);
    }

    // Space would otherwise scroll the viewport or press the focused toolbar button.
    function onKeyDown(event: KeyboardEvent) {
        if (event.code !== 'Space' || !viewport.value || isTyping(event.target)) return;
        event.preventDefault();
        spaceHeld.value = true;
    }
    function onKeyUp(event: KeyboardEvent) {
        if (event.code === 'Space') spaceHeld.value = false;
    }
    function onBlur() {
        spaceHeld.value = false;
        stopDrag();
    }

    onMounted(() => {
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);
    });
    onBeforeUnmount(() => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
        stopDrag();
        observer.disconnect();
    });

    return { cursor, onWheel, onMouseDown };
}
