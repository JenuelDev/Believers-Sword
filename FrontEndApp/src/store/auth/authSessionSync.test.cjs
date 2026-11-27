const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vue = require('vue');
const pinia = require('pinia');
const tick = () => new Promise((resolve) => setImmediate(resolve));

function load(file, dependencies) {
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8')
        .replace('import.meta.env.VITE_API_BASE_URL', '"https://example.test"');
    const code = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    new Function('require', 'module', 'exports', code)((name) => {
        if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
        return dependencies[name];
    }, module, module.exports);
    return module.exports;
}

function fixture({ services = [], restored = false } = {}) {
    const previous = { window: global.window, storage: global.localStorage,
        interval: global.setInterval, clear: global.clearInterval };
    const timers = new Map();
    let id = 0;
    let pulls = 0;
    let fullSyncs = 0;
    const storage = new Map(restored ? [['auth_token', 'token'],
        ['cached_user', JSON.stringify({ id: 1, services })]] : []);
    global.localStorage = { getItem: (k) => storage.get(k) ?? null,
        setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };
    global.window = Object.assign(new EventTarget(), { isElectron: true, browserWindow: {
        onSyncBeforeQuit() {}, getLastSyncTimestamp: async () => '0',
    } });
    global.setInterval = (fn, ms) => { timers.set(++id, { fn, ms }); return id; };
    global.clearInterval = (key) => timers.delete(key);
    const sync = { runPullSync: async () => { pulls++; }, runSync: async () => { fullSyncs++; }, resetSyncBackoff() {} };
    const lifecycle = load('authSessionSync.ts', { vue, '../../util/Sync/sync': sync });
    const { useAuthStore } = load('../authStore.ts', {
        pinia, vue, axios: { post: async () => ({ data: { status: 'success', token: 'token', user: { id: 1, services } } }),
            get: async (url) => ({ data: { status: 'success', user: { id: 1, services }, settings: {} } }) },
        '../util/Sync/sync': sync, './auth/authSessionSync': lifecycle,
        './auth/authProfile': { createAuthProfile: () => ({}) },
    });
    pinia.setActivePinia(pinia.createPinia());
    const auth = useAuthStore();
    return { auth, timers, get pulls() { return pulls; }, get fullSyncs() { return fullSyncs; },
        close() { auth.$dispose(); global.window = previous.window; global.localStorage = previous.storage;
            global.setInterval = previous.interval; global.clearInterval = previous.clear; } };
}

for (const services of [[], ['sync']]) {
    test(`login downloads only for ${services.length ? 'paid' : 'free'} accounts`, async () => {
        const f = fixture({ services });
        try {
            assert.equal((await f.auth.login('user@example.test', 'secret')).success, true);
            await tick();
            assert.equal(f.pulls, 1);
            assert.equal(f.fullSyncs, 0);
            assert.equal(f.timers.size, 1);
            assert.equal([...f.timers.values()][0].ms, 300_000);
        } finally { f.close(); }
    });
    test(`session restore downloads only for ${services.length ? 'paid' : 'free'} accounts`, async () => {
        const f = fixture({ services, restored: true });
        try {
            f.auth.initAuth();
            await tick();
            assert.equal(f.pulls, 1);
            assert.equal(f.fullSyncs, 0);
            await f.auth.logout();
            await tick();
            assert.equal(f.timers.size, 0);
            window.dispatchEvent(new Event('focus'));
            await tick();
            assert.equal(f.pulls, 1);
        } finally { f.close(); }
    });
}

test('reconnect, focus and periodic checks remain pull-only after subscription lapses', async () => {
    const f = fixture({ services: ['sync'], restored: true });
    try {
        f.auth.initAuth();
        await tick();
        f.auth.user.services = [];
        await tick();
        [...f.timers.values()][0].fn();
        window.dispatchEvent(new Event('focus'));
        window.dispatchEvent(new Event('online'));
        await tick();
        assert.equal(f.pulls, 4);
        assert.equal(f.fullSyncs, 0);
    } finally { f.close(); }
});
