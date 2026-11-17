const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vue = require('vue');
const pinia = require('pinia');

function load(file, dependencies = {}) {
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8')
        .replaceAll('import.meta.env.VITE_SUPABASE_URL', '"https://catalog.example"')
        .replaceAll('import.meta.env.VITE_SUPABASE_ANON_KEY', '"public-test-key"');
    const code = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    new Function('require', 'module', 'exports', code)((name) => {
        if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
        return dependencies[name];
    }, module, module.exports);
    return module.exports;
}
const filters = load('sermonTopics.ts');
const models = load('sermonModels.ts', { '../../util/bookNameLookup': { bookNumberFromName: () => null } });

test('All clears specific topics, a new topic replaces All, and clear removes filtering', () => {
    const normalize = filters.normalizeTopicSelection;
    assert.deepEqual(normalize(['faith', 'prayer'], ['faith']), ['faith', 'prayer']);
    assert.deepEqual(normalize(['faith', 'prayer', ''], ['faith', 'prayer']), ['']);
    assert.deepEqual(normalize(['', 'hope'], ['']), ['hope']);
    assert.deepEqual(normalize(null, ['hope']), []);
    assert.deepEqual(normalize([], ['']), []);
    assert.equal(filters.sermonTopicQuery(['']), null);
    assert.equal(filters.sermonTopicQuery([]), null);
});

test('multiple topics use overlap and preserve punctuation inside each topic', () => {
    const value = filters.sermonTopicQuery(['fear of the lord', 'grace, mercy', 'say "yes"', 'a\\b']);
    assert.equal(value, 'ov.{"fear of the lord","grace, mercy","say \\"yes\\"","a\\\\b"}');
    assert.equal(new URLSearchParams({ topics: value }).get('topics'), value);
});

for (const isElectron of [false, true]) {
    test(`rapid topic changes discard stale results and query the latest filter (${isElectron ? 'desktop' : 'web'})`, async () => {
        const oldWindow = global.window;
        global.window = { isElectron };
        const requests = [];
        const axios = { get: (url) => new Promise((resolve) => requests.push({ url, resolve })) };
        const useStore = load('../Sermons.ts', {
            pinia, vue: { ...vue, onBeforeMount() {} }, axios,
            '../util/Sync/sync': { debouncedRunSync() {} },
            './sermons/sermonModels': models, './sermons/sermonTopics': filters,
        }).useSermonStore;
        pinia.setActivePinia(pinia.createPinia());
        const store = useStore();
        try {
            store.sort = 'popular';
            store.search = 'hope';
            store.topicFilter = ['faith'];
            const first = store.getSermons(true);
            store.topicFilter = ['faith', 'prayer'];
            await store.getSermons(true);
            store.topicFilter = ['rest'];
            await store.getSermons(true);
            assert.equal(requests.length, 1);
            requests[0].resolve({ data: [{ id: 'stale', title: 'Stale' }] });
            await new Promise((resolve) => setImmediate(resolve));
            assert.equal(requests.length, 2);
            assert.deepEqual(store.sermons, []);
            const params = new URL(requests[1].url).searchParams;
            assert.equal(params.get('topics'), 'ov.{"rest"}');
            assert.equal(params.get('search_vector'), 'plfts(english).hope');
            assert.equal(params.get('order'), 'view_count.desc');
            assert.equal(params.get('offset'), '0');
            requests[1].resolve({ data: [{ id: 'latest', title: 'Latest' }] });
            await first;
            assert.equal(store.sermons[0].id, 'latest');
            store.topicFilter = [];
            const clear = store.getSermons(true);
            assert.equal(new URL(requests[2].url).searchParams.has('topics'), false);
            requests[2].resolve({ data: [] });
            await clear;
        } finally {
            store.$dispose();
            global.window = oldWindow;
        }
    });
}
