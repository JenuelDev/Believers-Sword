const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vue = require('vue');
const pinia = require('pinia');

function load(file, dependencies) {
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    new Function('require', 'module', 'exports', code)((name) => {
        if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
        return dependencies[name];
    }, module, module.exports);
    return module.exports;
}
const queueModule = load('noteSaveQueue.ts', {});
const tick = () => new Promise((resolve) => setImmediate(resolve));

function fixture() {
    const old = { window: global.window, storage: global.localStorage, timeout: global.setTimeout, clear: global.clearTimeout };
    const values = new Map();
    const timers = new Map();
    let timerId = 0;
    let failing = true;
    let read = async () => [];
    const writes = [];
    const auth = vue.reactive({ user: { id: 1 } });
    global.localStorage = { getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
    global.window = Object.assign(new EventTarget(), { isElectron: false, browserWindow: {
        getNotes: () => read(),
        upsertNote: async (note) => {
            writes.push({ account: auth.user.id, ...note });
            if (failing) throw new Error('Offline');
            return { success: true };
        },
        deleteNote: async () => ({ success: true }),
    } });
    global.setTimeout = (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; };
    global.clearTimeout = (id) => timers.delete(id);
    const useStore = load('useNoteStore.ts', {
        pinia, vue: { ...vue, onMounted() {} },
        '../util/Sync/sync': { debouncedRunSync() {}, runPushSync() {} },
        '../util/session': { get: () => null, set() {} },
        './authStore': { useAuthStore: () => auth }, './noteSaveQueue': queueModule,
    }).default;
    const stores = [];
    function createStore() {
        pinia.setActivePinia(pinia.createPinia());
        const store = useStore();
        stores.push(store);
        return store;
    }
    return { auth, values, writes, createStore,
        setFailing(value) { failing = value; }, setRead(value) { read = value; },
        async fireSaves() {
            for (const [id, timer] of [...timers]) {
                if (timer.ms === 700) { timers.delete(id); timer.fn(); }
            }
            await tick();
        },
        close() {
            stores.forEach((store) => store.$dispose());
            global.window = old.window; global.localStorage = old.storage;
            global.setTimeout = old.timeout; global.clearTimeout = old.clear;
        },
    };
}

test('the composed notes store retains failed drafts through a refresh and page reload', async () => {
    const f = fixture();
    try {
        const store = f.createStore();
        store.addNote('Offline note', 'Keep this text');
        assert.ok(f.values.get('note-drafts:v1:web-user-1'));
        await f.fireSaves();
        assert.ok(store.saveError);
        await store.loadNote();
        await tick();
        assert.equal(store.notes[0].content, 'Keep this text');
        store.$dispose();
        const reopened = f.createStore();
        await reopened.loadNote();
        await tick();
        assert.equal(reopened.notes[0].content, 'Keep this text');
        f.setFailing(false);
        window.dispatchEvent(new Event('online'));
        await tick();
        assert.equal(reopened.saveError, null);
        assert.equal(f.values.has('note-drafts:v1:web-user-1'), false);
    } finally { f.close(); }
});

test('switching accounts cancels old save timers and keeps drafts isolated', async () => {
    const f = fixture();
    try {
        const store = f.createStore();
        store.addNote('Private note', 'Account one');
        f.auth.user = { id: 2 };
        await f.fireSaves();
        assert.equal(f.writes.length, 0);
        await store.loadNote();
        assert.equal(store.notes.length, 0);
        f.auth.user = { id: 1 };
        await store.loadNote();
        await tick();
        assert.equal(store.notes[0].content, 'Account one');
        assert.ok(f.writes.every((write) => write.account === 1));
    } finally { f.close(); }
});

test('typing while a notes refresh is pending keeps the edit', async () => {
    const f = fixture();
    try {
        let release;
        f.setRead(() => new Promise((resolve) => { release = resolve; }));
        const store = f.createStore();
        const refresh = store.loadNote();
        store.addNote('New', 'Typed during the request');
        release([]);
        await refresh;
        await tick();
        assert.equal(store.notes[0].content, 'Typed during the request');
        assert.ok(f.values.has('note-drafts:v1:web-user-1'));
    } finally { f.close(); }
});
