const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function fixture(paid = false) {
    const previous = global.window;
    let applied = 0;
    let responseHook = async () => {};
    let logouts = 0;
    let reloads = 0;
    const requests = [];
    const auth = { isAuthenticated: true, isSyncEntitled: paid, syncEnabled: paid,
        token: 'token', loadLastSyncAt() {}, logout() { logouts++; } };
    global.window = { browserWindow: { getLastSyncTimestamp: async () => '0' } };
    const store = new Proxy({}, { get: () => () => { reloads++; } });
    const dependencies = {
        axios: { get: async (url, options) => {
            requests.push({ url, options });
            await responseHook();
            assert.ok(url.endsWith('/sync/pull'), 'no ad status or credit spending is required');
            return { data: { status: 'success', has_more: false } };
        } },
        './applyPullPage': { applyPullPage: async () => { applied++; } },
        './cursorHeal': { healCursorOnce: async () => {} },
        '../../store/authStore': { useAuthStore: () => auth },
        '../../store/useNoteStore': { __esModule: true, default: () => store },
    };
    for (const [file, name] of Object.entries({ bookmark: 'useBookmarkStore',
        prayerListStore: 'usePrayerListStore', prayerStreakStore: 'usePrayerStreakStore',
        devotionStreakStore: 'useDevotionStreakStore', BibleStore: 'useBibleStore',
        ClipNotes: 'useClipNoteStore', useGamesStore: 'useGamesStore' })) {
        dependencies[`../../store/${file}`] = { [name]: () => store };
    }
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname, 'sync.ts'), 'utf8')
        .replace('import.meta.env.VITE_API_BASE_URL', '"https://example.test"');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)((name) => {
        if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
        return dependencies[name];
    }, module, module.exports);
    return { sync: module.exports, auth, requests, get applied() { return applied; },
        get reloads() { return reloads; }, get logouts() { return logouts; },
        setResponseHook(fn) { responseHook = fn; }, close() { global.window = previous; } };
}

for (const paid of [false, true]) {
    test(`${paid ? 'paid' : 'free'} authenticated account downloads without an ad window`, async () => {
        const f = fixture(paid);
        try {
            await f.sync.runPullSync();
            assert.equal(f.requests.length, 1);
            assert.equal(f.requests[0].options.params.since, '0');
            assert.equal(f.applied, 1);
            assert.equal(f.reloads, 8);
        } finally { f.close(); }
    });
}
test('free accounts still cannot enter automatic upload or full sync paths', async () => {
    const f = fixture();
    try {
        await f.sync.runPushSync();
        await f.sync.runSync();
        assert.equal(f.requests.length, 0);
    } finally { f.close(); }
});
test('signed-out accounts cannot download', async () => {
    const f = fixture();
    try {
        f.auth.isAuthenticated = false;
        await f.sync.runPullSync();
        assert.equal(f.requests.length, 0);
    } finally { f.close(); }
});

for (const staleError of [false, true]) {
    test(`a new login follows an in-flight old session ${staleError ? '401' : 'response'}`, async () => {
        const f = fixture();
        let release;
        let requested;
        const ready = new Promise((resolve) => { requested = resolve; });
        const gate = new Promise((resolve) => { release = resolve; });
        let calls = 0;
        f.setResponseHook(async () => {
            if (++calls !== 1) return;
            requested();
            await gate;
            if (staleError) throw { response: { status: 401 } };
        });
        try {
            const first = f.sync.runPullSync();
            await ready;
            f.auth.token = 'new-account';
            await f.sync.runPullSync(true);
            release();
            await first;
            await new Promise((resolve) => setImmediate(resolve));
            assert.equal(f.requests.length, 2);
            assert.equal(f.requests[1].options.headers.Authorization, 'Bearer new-account');
            assert.equal(f.applied, 1, 'only the new account response is applied');
            assert.equal(f.logouts, 0, 'an old 401 must not log out the new account');
        } finally { f.close(); }
    });
}

test('logout discards an in-flight response', async () => {
    const f = fixture();
    f.setResponseHook(async () => { f.auth.isAuthenticated = false; });
    try {
        await f.sync.runPullSync();
        assert.equal(f.applied, 0);
        assert.equal(f.reloads, 0);
    } finally { f.close(); }
});
