import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer, ref, shallowRef } from 'vue';
import { usePanZoom, wheelZoom } from './usePanZoom.ts';

const limits = { min: 0.25, max: 4 };

test('wheel up zooms in, wheel down zooms out by the same factor', () => {
    const zoomIn = wheelZoom(1, -100, limits);
    const zoomOut = wheelZoom(1, 100, limits);
    assert.ok(zoomIn > 1.2 && zoomIn < 1.25);
    assert.ok(Math.abs(zoomIn * zoomOut - 1) < 1e-9);
});

test('wheel zoom stays within the viewer limits', () => {
    assert.equal(wheelZoom(3.9, -1000, limits), 4);
    assert.equal(wheelZoom(0.3, 1000, limits), 0.25);
    assert.equal(wheelZoom(4, -100, limits), 4);
});

test('Space dragging updates both axes immediately despite smooth scrolling and stops on release', () => {
    const keys = ['window', 'HTMLElement', 'ResizeObserver'];
    const originals = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
    const events = new EventTarget();
    class ElementStub {}
    class ResizeObserverStub {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
    Object.assign(globalThis, { window: events, HTMLElement: ElementStub, ResizeObserver: ResizeObserverStub });
    let left = 100;
    let top = 200;
    let animatedAssignments = 0;
    const scrolls: ScrollToOptions[] = [];
    const box = {
        get scrollLeft() { return left; },
        set scrollLeft(_value: number) { animatedAssignments++; },
        get scrollTop() { return top; },
        set scrollTop(_value: number) { animatedAssignments++; },
        scrollTo(options: ScrollToOptions) {
            scrolls.push(options);
            assert.equal(options.behavior, 'instant');
            left = options.left ?? left;
            top = options.top ?? top;
        },
    };
    const renderer = createRenderer({
        patchProp() {}, insert() {}, remove() {},
        createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
        setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null,
    });
    let pan!: ReturnType<typeof usePanZoom>;
    const app = renderer.createApp({
        setup() {
            pan = usePanZoom(shallowRef(box as unknown as HTMLElement), shallowRef<HTMLElement>(), ref(2), limits);
            return () => null;
        },
    });
    const event = (type: string, data: Record<string, unknown> = {}) =>
        Object.assign(new Event(type, { cancelable: true }), data);
    try {
        app.mount({});
        const space = event('keydown', { code: 'Space' });
        events.dispatchEvent(space);
        assert.equal(space.defaultPrevented, true);
        pan.onMouseDown(event('mousedown', { button: 0, clientX: 200, clientY: 200 }) as MouseEvent);
        events.dispatchEvent(event('mousemove', { clientX: 140, clientY: 120 }));
        assert.deepEqual([left, top], [160, 280]);
        events.dispatchEvent(event('mousemove', { clientX: 75, clientY: 140 }));
        assert.deepEqual([left, top], [225, 260]);
        assert.equal(animatedAssignments, 0);
        assert.equal(scrolls.length, 2);
        events.dispatchEvent(event('mouseup'));
        events.dispatchEvent(event('mousemove', { clientX: 0, clientY: 0 }));
        assert.deepEqual([left, top], [225, 260]);
        events.dispatchEvent(event('keyup', { code: 'Space' }));
        assert.equal(pan.cursor.value, undefined);
    } finally {
        app.unmount();
        keys.forEach((key, index) => {
            const descriptor = originals[index];
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        });
    }
});
