const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vue = require('vue');
const pinia = require('pinia');

function load(relative, dependencies) {
    const source = fs.readFileSync(path.join(__dirname, relative), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', code)((name) => {
        if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
        return dependencies[name];
    }, module, module.exports);
    return module.exports;
}
const { createGameBridge } = load('games.ts', { './http': {} });

test('round saves retain their revision and idempotency key across a lost acknowledgement', async () => {
    let token = 'account-a';
    global.localStorage = { getItem: () => token };
    const submissions = [];
    const bridge = createGameBridge(async (url, options) => {
        if (url.endsWith('/questions')) return { revision: 'original', items: [{ id: 1 }, { id: 2 }] };
        submissions.push(JSON.parse(options.body));
        if (submissions.length === 1) throw new Error('Lost acknowledgement');
        return { newlyPassed: true };
    });
    assert.equal((await bridge.qaGetQuestionsForGroup(7)).length, 2);
    const args = { groupId: 7, correctCount: 2, totalCount: 2, passingScore: 0 };
    await assert.rejects(bridge.qaSaveGroupProgress(args));
    assert.equal((await bridge.qaSaveGroupProgress(args)).newlyPassed, true);
    assert.deepEqual(submissions[0], submissions[1]);
    assert.equal(submissions[0].revision, 'original');
    assert.equal('passing_score' in submissions[0], false);
    token = 'account-b';
    await assert.rejects(bridge.qaSaveGroupProgress(args), /account changed/);
    assert.equal(submissions.length, 2);
});

test('life loss retries once and returns recovery from the acknowledged write', async () => {
    global.localStorage = { getItem: () => 'account-a' };
    const losses = [];
    let reads = 0;
    const bridge = createGameBridge(async (url, options) => {
        if (url.endsWith('/lose')) {
            losses.push(JSON.parse(options.body).request_id);
            if (losses.length === 1) throw new Error('Lost acknowledgement');
            return { lives: 6, next_recovery_at: '2030-01-01T02:00:00Z' };
        }
        reads++;
        throw new Error('A second request must not be needed after a loss');
    });
    await assert.rejects(bridge.gameLoseLife());
    assert.equal(await bridge.gameLoseLife(), 6);
    assert.equal(await bridge.gameNextRecoveryAt(), '2030-01-01T02:00:00Z');
    assert.equal(losses[0], losses[1]);
    assert.equal(reads, 0);
    await bridge.gameLoseLife();
    assert.notEqual(losses[1], losses[2]);
});

test('content arriving after an account switch is rejected', async () => {
    let token = 'account-a';
    global.localStorage = { getItem: () => token };
    let resolve;
    const bridge = createGameBridge(() => new Promise((done) => { resolve = done; }));
    const pending = bridge.tfGetGroups();
    token = 'account-b';
    resolve({ groups: [{ id: 7 }] });
    await assert.rejects(pending, /account changed/);
});

function storeFixture() {
    const sounds = { playSound() {} };
    const fp = load('../../store/games/fourPictures.ts', {
        vue, './sound': sounds, '../../assets/sounds/correct.mp3': '', '../../assets/sounds/wrong.mp3': '',
    });
    const { useGamesStore } = load('../../store/useGamesStore.ts', {
        vue, pinia, './games/sound': sounds, './games/fourPictures': fp,
        '../assets/sounds/correct.mp3': '', '../assets/sounds/wrong.mp3': '',
    });
    const groups = [{ id: 7, name: 'Creation', display_order: 1, required_completed: 0, passing_score: 70 }];
    const questions = [1, 2].map((id) => ({ id, group_id: 7, question: 'Question', options: ['God', 'Moses'], answer: 0 }));
    const bridge = {
        gameGetLives: async () => 7, gameNextRecoveryAt: async () => null,
        qaGetGroups: async () => groups, qaGetAllGroupProgress: async () => [],
        tfGetGroups: async () => groups, tfGetAllGroupProgress: async () => [],
        qaGetQuestionsForGroup: async () => questions,
        qaSaveGroupProgress: async () => ({ newlyPassed: true }),
        gameLoseLife: async () => 6,
        fpGetLevels: async () => [{ id: 17, level_order: 1, word: 'EDEN', image1: 'a.jpg', image2: 'b.jpg', image3: 'c.jpg', image4: 'd.jpg' }],
        fpGetSolvedLevelIds: async () => [], fpGetImagesBasePath: async () => 'https://example.test/images/',
        fpMarkLevelSolved: async () => {},
    };
    global.window = { isElectron: false, browserWindow: bridge };
    pinia.setActivePinia(pinia.createPinia());
    const store = useGamesStore();
    return { store, bridge, close() { store.dispose(); store.$dispose(); } };
}

test('browser initialization loads real quiz content and serializes answer writes', async () => {
    const f = storeFixture();
    try {
        assert.equal(await f.store.init(), true);
        assert.equal(f.store.qaGroups.length, 1);
        assert.equal(await f.store.startQAGame(7), true);
        let resolve;
        let losses = 0;
        f.bridge.gameLoseLife = () => { losses++; return new Promise((done) => { resolve = done; }); };
        const answer = (f.store.shuffledCorrectIndex + 1) % 2;
        const pending = f.store.submitQAAnswer(answer);
        assert.equal(f.store.isBusy, true);
        assert.equal(await f.store.submitQAAnswer(answer), false);
        resolve(6);
        await pending;
        assert.equal(losses, 1);
        assert.equal(f.store.gameState, 'answered');
        assert.equal(f.store.lives, 6);
    } finally { f.close(); }
});

test('failed answer and completion requests leave a retryable round', async () => {
    const f = storeFixture();
    try {
        await f.store.init();
        await f.store.startQAGame(7);
        let losses = 0;
        f.bridge.gameLoseLife = async () => { if (++losses === 1) throw new Error('Offline'); return 6; };
        await f.store.submitQAAnswer((f.store.shuffledCorrectIndex + 1) % 2);
        assert.equal(f.store.gameState, 'playing');
        assert.equal(f.store.error, 'Offline');
        await f.store.retryAction();
        assert.equal(f.store.gameState, 'answered');
        await f.store.nextQAQuestion();
        assert.equal(f.store.currentIndex, 1);
        await f.store.submitQAAnswer(f.store.shuffledCorrectIndex);
        let saves = 0;
        f.bridge.qaSaveGroupProgress = async () => {
            if (++saves === 1) throw new Error('Save failed');
            return { newlyPassed: false };
        };
        await f.store.nextQAQuestion();
        assert.equal(f.store.currentIndex, 1);
        assert.equal(f.store.gameState, 'answered');
        assert.equal(f.store.error, 'Save failed');
        await f.store.retryAction();
        assert.equal(f.store.gameState, 'completed');
        assert.equal(f.store.currentIndex, 1);
        assert.equal(f.store.error, '');
    } finally { f.close(); }
});


test('Four Pictures shares its content request and retries a solve with its original revision', async () => {
    let token = 'account-a';
    global.localStorage = { getItem: () => token };
    let loads = 0;
    const writes = [];
    const bridge = createGameBridge(async (url, options) => {
        if (url.endsWith('/levels')) { loads++; return { levels: [{ id: 17, word: 'EDEN' }], revision: 'fp-original', image_base_url: 'https://example.test/original/' }; }
        writes.push(JSON.parse(options.body));
        if (writes.length === 1) throw new Error('Lost acknowledgement');
        return { success: true };
    });
    const [levels, base] = await Promise.all([bridge.fpGetLevels(), bridge.fpGetImagesBasePath()]);
    assert.equal(loads, 1);
    assert.equal(levels[0].id, 17);
    assert.equal(base, 'https://example.test/original/');
    await assert.rejects(bridge.fpMarkLevelSolved(17));
    await bridge.fpMarkLevelSolved(17);
    assert.deepEqual(writes[0], writes[1]);
    token = 'account-b';
    await assert.rejects(bridge.fpMarkLevelSolved(17), /account changed/);
});

test('Four Pictures keeps the completed guess until its save succeeds', async () => {
    const f = storeFixture();
    const tick = () => new Promise((resolve) => setImmediate(resolve));
    try {
        await f.store.init();
        assert.equal(f.store.fpLevels.length, 1);
        await f.store.startFPGame();
        let saves = 0;
        f.bridge.fpMarkLevelSolved = async () => { if (++saves === 1) throw new Error('Offline solve'); };
        for (const letter of 'EDEN') { f.store.fpTapLetter(letter); await tick(); }
        assert.equal(f.store.error, 'Offline solve');
        assert.equal(f.store.fpGuessedLetters.join(''), 'EDEN');
        assert.equal(f.store.fpSolvedIds.has(17), false);
        await f.store.retryAction();
        assert.equal(f.store.gameState, 'completed');
        assert.equal(f.store.fpSolvedIds.has(17), true);
        assert.equal(saves, 2);
    } finally { f.close(); }
});
