const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vue = require('vue');

function load(file, imports, window) {
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    new Function('require', 'module', 'exports', 'window', compiled)(name => imports[name], module, module.exports, window);
    return module.exports;
}

function fixture({ version = 'KJV.SQLite3', book = 10, chapter = 1, electron = true, savedSize } = {}) {
    const calls = [], windowModes = [], saved = {};
    const bible = { selectedBibleVersions: version ? [version] : [], selectedBookNumber: book, selectedChapter: chapter };
    const settings = { showDeuterocanonical: false };
    let getVerses = async () => [{ verse: 1, version: [{ text: 'Verse text' }] }];
    const books = load('../util/books.ts', {});
    const scope = vue.effectScope();
    const store = scope.run(() => load('immersiveReaderStore.ts', {
        vue,
        pinia: { defineStore: (_, setup) => setup },
        '../services/BibleService': { getBibleService: () => ({ getVerses(args) { calls.push(args); return getVerses(args); } }) },
        './BibleStore': { useBibleStore: () => bible },
        './settingStore': { useSettingStore: () => settings },
        '../util/books': books,
        '../util/helper': { stripVerseHtml(text, preserve) { assert.equal(preserve, true); return text; } },
        '../util/session': { default: { get: () => savedSize, set: (key, value) => { saved[key] = value; } } },
    }, { isElectron: electron, browserWindow: { async setImmersiveWindowMode(value) { windowModes.push(value); } } }).useImmersiveReaderStore());
    return { store, bible, settings, calls, saved, windowModes, setLoader(fn) { getVerses = fn; }, dispose() { scope.stop(); } };
}

test('missing translation remains unavailable without service calls even after navigation', async () => {
    const f = fixture({ version: '' });
    try {
        await f.store.open();
        await f.store.navigateChapter('next');
        await f.store.navigateChapter('prev');
        assert.equal(f.calls.length, 0);
        assert.equal(f.store.loadError.value, true);
        assert.equal(f.store.activeChapter.value, 1);
    } finally { f.dispose(); }
});

test('a hidden starting book can navigate chapters and leave across both book boundaries', async () => {
    const f = fixture({ book: 170 });
    try {
        await f.store.open();
        await f.store.navigateChapter('next');
        assert.equal(f.store.activeChapter.value, 2);
        await f.store.navigateChapter('prev');
        await f.store.navigateChapter('prev');
        assert.equal(f.store.activeBookNumber.value, 160);
        assert.equal(f.store.activeChapter.value, 13);
        f.bible.selectedChapter = 17;
        await f.store.open();
        await f.store.navigateChapter('next');
        assert.equal(f.store.activeBookNumber.value, 190);
        assert.equal(f.store.activeChapter.value, 1);
    } finally { f.dispose(); }
});

test('canon boundaries stop navigation and expanded Daniel uses its extra chapters', async () => {
    const f = fixture();
    try {
        await f.store.open();
        await f.store.navigateChapter('prev');
        assert.equal(f.calls.length, 1);
        f.bible.selectedBookNumber = 340;
        f.bible.selectedChapter = 12;
        f.settings.showDeuterocanonical = true;
        await f.store.open();
        await f.store.navigateChapter('next');
        assert.equal(f.store.activeBookNumber.value, 340);
        assert.equal(f.store.activeChapter.value, 13);
        f.bible.selectedBookNumber = 730;
        f.bible.selectedChapter = 22;
        await f.store.open();
        const count = f.calls.length;
        await f.store.navigateChapter('next');
        assert.equal(f.calls.length, count);
    } finally { f.dispose(); }
});

test('closing discards an in-flight response and closed navigation does not load', async () => {
    const f = fixture();
    try {
        let resolve;
        f.setLoader(() => new Promise(done => { resolve = done; }));
        const loading = f.store.open();
        f.store.close();
        resolve([{ verse: 1, version: [{ text: 'Stale' }] }]);
        await loading;
        await f.store.navigateChapter('next');
        assert.deepEqual(f.store.verses.value, []);
        assert.equal(f.store.isLoading.value, false);
        assert.equal(f.calls.length, 1);
        await new Promise(setImmediate);
        assert.deepEqual(f.windowModes, [true, false]);
    } finally { f.dispose(); }
});

test('text size restores and persists within supported bounds', async () => {
    const f = fixture({ savedSize: 24 });
    try {
        assert.equal(f.store.fontSize.value, 24);
        f.store.adjustFontSize(100);
        await vue.nextTick();
        assert.equal(f.saved['immersive-reader-font-size'], 36);
        f.store.adjustFontSize(-100);
        f.store.adjustFontSize(NaN);
        await vue.nextTick();
        assert.equal(f.saved['immersive-reader-font-size'], 12);
    } finally { f.dispose(); }
});

test('the web cannot open immersive mode', async () => {
    const f = fixture({ electron: false });
    try {
        await f.store.open();
        assert.equal(f.store.isOpen.value, false);
        assert.equal(f.calls.length, 0);
        assert.deepEqual(f.windowModes, []);
    } finally { f.dispose(); }
});
