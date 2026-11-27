const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { ref, shallowRef, computed } = require('vue');

function fixture() {
    const watches = [], cleanup = [], scrolls = [], chapters = [], sizes = [];
    const listeners = new Map();
    const document = {
        activeElement: null,
        addEventListener(name, fn) { listeners.set(name, fn); },
        removeEventListener(name) { listeners.delete(name); },
        createRange() { return { selectNodeContents(node) { document.selectedNode = node; } }; },
    };
    const window = { addEventListener() {}, removeEventListener() {}, getSelection() {
        return { removeAllRanges() {}, addRange(range) { document.selectedRange = range; } };
    } };
    const reader = { isOpen: false, isLoading: false, close() { this.isOpen = false; },
        async navigateChapter(direction) { chapters.push(direction); }, adjustFontSize(delta) { sizes.push(delta); } };
    const vue = { ref, shallowRef, computed, nextTick: fn => fn(), watch: (_, fn) => watches.push(fn), onUnmounted: fn => cleanup.push(fn) };
    const source = fs.readFileSync(path.join(__dirname, 'ImmersiveReader.vue'), 'utf8').match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
    const compiled = ts.transpileModule(source + '\nexport { handleKeydown, handleCopy, readingSurface, closeButton, modifierHeld, handleWindowBlur };',
        { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} };
    const imports = {
        vue, 'vue-i18n': { useI18n: () => ({ t: key => key }) },
        '../../../store/immersiveReaderStore': { useImmersiveReaderStore: () => reader },
    };
    new Function('require', 'module', 'exports', 'document', 'window', 'navigator', 'HTMLElement', compiled)(
        name => imports[name], module, module.exports, document, window, { platform: 'Win32' }, class {},
    );
    const api = module.exports;
    api.readingSurface.value = { clientHeight: 500, scrollHeight: 2000,
        focus() {}, scrollBy(options) { scrolls.push(options.top); }, scrollTo(options) { scrolls.push(options.top); } };
    let focused = false;
    api.closeButton.value = { focus() { focused = true; } };
    reader.isOpen = true;
    watches[0](true);
    return { ...api, reader, document, scrolls, chapters, sizes, listeners,
        key(key, extra = {}) {
            const event = { key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false,
                target: {}, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra };
            api.handleKeydown(event);
            return event;
        },
        isFocused: () => focused,
        close() { reader.isOpen = false; watches[0](false); },
        unmount() { cleanup.forEach(fn => fn()); },
    };
}

test('Ctrl/Cmd+C keeps native copy and select-all selects only the reading surface', () => {
    const f = fixture();
    for (const modifier of ['ctrlKey', 'metaKey']) {
        const copy = f.key('c', { [modifier]: true });
        assert.equal(copy.prevented, undefined);
        assert.equal(copy.stopped, true);
        assert.equal(f.key('a', { [modifier]: true }).prevented, true);
        assert.equal(f.document.selectedNode, f.readingSurface.value);
    }
    let prevented = false, stopped = false;
    f.handleCopy({ preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
    assert.equal(stopped, true);
    assert.equal(prevented, false);
});

test('Space, Shift+Space, PageUp and PageDown scroll in the expected direction', () => {
    const f = fixture();
    f.key(' ');
    f.key(' ', { shiftKey: true });
    f.key('PageUp');
    f.key('PageDown');
    assert.deepEqual(f.scrolls, [450, -450, -450, 450]);
});

test('shortcut sheet modifiers still allow chapters, text size and Escape', async () => {
    const f = fixture();
    f.key('ArrowRight', { ctrlKey: true });
    await Promise.resolve();
    f.key('ArrowLeft', { metaKey: true });
    await Promise.resolve();
    f.key('+', { ctrlKey: true, shiftKey: true });
    f.key('-', { metaKey: true });
    assert.deepEqual(f.chapters, ['next', 'prev']);
    assert.deepEqual(f.sizes, [1, -1]);
    f.key('Escape', { ctrlKey: true });
    assert.equal(f.reader.isOpen, false);
    assert.equal(f.modifierHeld.value, false);
});

test('listeners exist only while open, and Tab and exit-button activation remain usable', () => {
    const f = fixture();
    assert.equal(f.listeners.has('keydown'), true);
    assert.equal(f.listeners.has('copy'), true);
    assert.equal(f.key('Tab').prevented, true);
    assert.equal(f.isFocused(), true);
    assert.equal(f.key(' ', { target: f.closeButton.value }).prevented, undefined);
    assert.equal(f.key('Enter', { target: f.closeButton.value }).prevented, undefined);
    f.close();
    assert.equal(f.listeners.size, 0);
    assert.equal(f.key('PageDown').prevented, undefined);
    f.unmount();
});

test('blur clears the shortcut sheet and OS shortcuts retain native defaults', () => {
    const f = fixture();
    f.key('Control', { ctrlKey: true });
    assert.equal(f.modifierHeld.value, true);
    f.handleWindowBlur();
    assert.equal(f.modifierHeld.value, false);
    assert.equal(f.key('F4', { altKey: true }).prevented, undefined);
    assert.equal(f.key('r', { ctrlKey: true }).prevented, undefined);
});
