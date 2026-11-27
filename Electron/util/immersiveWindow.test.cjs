const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, imports) {
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    new Function('require', 'module', 'exports', compiled)(name => imports[name], module, module.exports);
    return module.exports;
}

function fixture(mode) {
    const app = new EventEmitter();
    const win = new EventEmitter();
    win.webContents = new EventEmitter();
    win.minimum = [1226, 700];
    win.bounds = { x: 1500, y: 500, width: 360, height: 500 };
    win.mode = mode;
    win.isDestroyed = () => false;
    win.getMinimumSize = () => [...win.minimum];
    win.setMinimumSize = (width, height) => { win.minimum = [width, height]; };
    win.isMaximized = () => win.mode === 'maximized';
    win.isFullScreen = () => win.mode === 'fullscreen';
    win.isMinimized = () => win.mode === 'minimized';
    win.getBounds = win.getNormalBounds = () => ({ ...win.bounds });
    win.setBounds = bounds => { win.bounds = bounds; win.fitted = (win.fitted || 0) + 1; };
    const area = { x: 0, y: 0, width: 1920, height: 1080 };
    const windowBounds = load('windowBounds.ts', {});
    const { createImmersiveWindowController } = load('immersiveWindow.ts', {
        electron: { app, screen: { getDisplayMatching: () => ({ workArea: area }) } },
        './windowBounds': windowBounds,
    });
    const controller = createImmersiveWindowController(win);
    return { win, app, controller, area };
}

test('exit restores the captured minimum and keeps an enlarged window on screen', () => {
    const { win, controller } = fixture();
    win.minimum = [1100, 650];
    controller.setEnabled(true);
    controller.setEnabled(true);
    assert.deepEqual(win.minimum, [360, 500]);
    controller.setEnabled(false);
    assert.deepEqual(win.minimum, [1100, 650]);
    assert.deepEqual(win.bounds, { x: 694, y: 380, width: 1226, height: 700 });
    controller.setEnabled(false);
    assert.equal(win.fitted, 1);
});

for (const event of ['did-finish-load', 'render-process-gone', 'close', 'before-quit']) {
    test(`${event} resets immersive constraints before window state is saved`, () => {
        const { win, app, controller } = fixture();
        let saved;
        (event === 'before-quit' ? app : win).on(event, () => { saved = [...win.minimum]; });
        controller.setEnabled(true);
        const emitter = event === 'before-quit' ? app : event === 'close' ? win : win.webContents;
        emitter.emit(event);
        assert.deepEqual(win.minimum, [1226, 700]);
        if (event === 'close' || event === 'before-quit') assert.deepEqual(saved, [1226, 700]);
    });
}

for (const [mode, event] of [['maximized', 'unmaximize'], ['fullscreen', 'leave-full-screen'], ['minimized', 'restore']]) {
    test(`exit preserves ${mode} mode and fits normal bounds on ${event}`, () => {
        const { win, controller } = fixture(mode);
        controller.setEnabled(true);
        controller.setEnabled(false);
        assert.equal(win.mode, mode);
        assert.equal(win.fitted, undefined);
        assert.deepEqual(win.minimum, [1226, 700]);
        win.mode = undefined;
        win.emit(event);
        assert.deepEqual(win.bounds, { x: 694, y: 380, width: 1226, height: 700 });
    });
}

test('reopening before restore retains immersive size and closed windows remove app listeners', () => {
    const { win, app, controller } = fixture('maximized');
    controller.setEnabled(true);
    controller.setEnabled(false);
    controller.setEnabled(true);
    win.mode = undefined;
    win.emit('unmaximize');
    assert.equal(win.fitted, undefined);
    assert.deepEqual(win.minimum, [360, 500]);
    win.emit('closed');
    assert.equal(app.listenerCount('before-quit'), 0);
});
