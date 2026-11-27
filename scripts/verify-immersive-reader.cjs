const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const os = require('node:os');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const compiler = require(path.join(root, 'FrontEndApp/node_modules/@vue/compiler-sfc'));
const sass = require('sass');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'believers-sword-reader-'));
app.setPath('userData', path.join(output, 'user-data'));

function commonjs(source) {
    return ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
}

app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, width: 1226, height: 800, webPreferences: { contextIsolation: true } });
    try {
        const source = fs.readFileSync(path.join(root, 'FrontEndApp/src/Views/ReadBible/ImmersiveReader/ImmersiveReader.vue'), 'utf8');
        const { descriptor } = compiler.parse(source);
        const script = compiler.compileScript(descriptor, { id: 'reader-smoke', inlineTemplate: true });
        const style = sass.compileString(descriptor.styles[0].content).css;
        const vueSource = fs.readFileSync(path.join(root, 'FrontEndApp/node_modules/vue/dist/vue.global.js'), 'utf8');
        const helper = commonjs(fs.readFileSync(path.join(root, 'FrontEndApp/src/util/helper.ts'), 'utf8'));
        await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<html><head><style>body{margin:0}' + style + '</style></head><body><div id="outside">Outside reader</div><div id="app"></div></body></html>'));
        const result = await win.webContents.executeJavaScript(`(() => {
            ${vueSource}
            const helperModule = { exports: {} };
            new Function('require', 'module', 'exports', ${JSON.stringify(helper)})(() => ({}), helperModule, helperModule.exports);
            const plain = helperModule.exports.stripVerseHtml('man<br/>that<pb/>walketh<s>123</s><f>footnote</f>', true);
            const flat = helperModule.exports.stripVerseHtml('man<br/>that<pb/>walketh');
            const reader = Vue.reactive({ isOpen: false, isLoading: false, loadError: false,
                bookTitle: 'Genesis', activeChapter: 1, fontSize: 18,
                verses: Array.from({length: 31}, (_, index) => ({verse: index + 1, text: 'In the beginning God created the heaven and the earth.'})),
                close() { this.isOpen = false; }, adjustFontSize(delta) { this.fontSize += delta; },
                async navigateChapter(direction) { this.activeChapter += direction === 'next' ? 1 : -1; },
            });
            const module = {exports:{}};
            const require = id => id === 'vue' ? Vue : id === 'vue-i18n' ? {useI18n: () => ({t: key => ({
                'immersive.leave': 'Leave reader', 'immersive.title': 'Immersive Scripture reader',
                'immersive.textSize': 'Text size', 'immersive.previous': 'Previous chapter',
                'immersive.next': 'Next chapter', 'immersive.scroll': 'Scroll',
                'immersive.range': 'Start / end', 'immersive.hint': 'Release Ctrl to hide',
            }[key] || key)})} : {useImmersiveReaderStore: () => reader};
            new Function('require','module','exports', ${JSON.stringify(commonjs(script.content))})(require, module, module.exports);
            Vue.createApp(module.exports.default).mount('#app');
            window.testReader = reader;
            reader.isOpen = true;
            return {plain, flat};
        })()`);
        assert.equal(result.plain, 'man\nthat\nwalketh');
        assert.equal(result.flat, 'man that walketh');
        const check = await win.webContents.executeJavaScript(`(async () => {
            await new Promise(requestAnimationFrame);
            const surface = document.querySelector('main');
            const fire = (key, extra = {}) => {
                const event = new KeyboardEvent('keydown', {key, bubbles:true, cancelable:true, ...extra});
                surface.dispatchEvent(event);
                return event.defaultPrevented;
            };
            const copyPrevented = fire('c', {ctrlKey:true});
            fire('a', {ctrlKey:true});
            const selectedText = window.getSelection().toString();
            const dragRegion = getComputedStyle(document.querySelector('.immersive-reader')).webkitAppRegion;
            const font = getComputedStyle(document.querySelector('.immersive-reader__verse')).fontSize;
            const hadFocus = document.activeElement === surface;
            return {copyPrevented, selectedText, dragRegion, font, hadFocus, exitVisible: !!document.querySelector('button')};
        })()`);
        assert.equal(check.copyPrevented, false);
        assert.ok(check.selectedText.includes('Genesis'));
        assert.ok(!check.selectedText.includes('Outside reader'));
        assert.equal(check.dragRegion, 'no-drag');
        assert.equal(check.font, '18px');
        assert.equal(check.hadFocus, true);
        assert.equal(check.exitVisible, true);
        await win.webContents.executeJavaScript(`window.getSelection().removeAllRanges();
            document.dispatchEvent(new KeyboardEvent('keyup', {key:'Control', bubbles:true}));`);
        for (const [width, height] of [[1226, 800], [360, 500]]) {
            win.setSize(width, height);
            await win.webContents.executeJavaScript('new Promise(requestAnimationFrame)');
            const image = await win.webContents.capturePage();
            fs.writeFileSync(path.join(output, `reader-${width}.png`), image.toPNG());
        }
        await win.webContents.executeJavaScript('document.querySelector("button").click()');
        assert.equal(await win.webContents.executeJavaScript('!!document.querySelector(".immersive-reader")'), false);
        const boundsModule = { exports: {} };
        new Function('require', 'module', 'exports', commonjs(fs.readFileSync(path.join(root, 'Electron/util/windowBounds.ts'), 'utf8')))(
            require, boundsModule, boundsModule.exports);
        const controllerModule = { exports: {} };
        new Function('require', 'module', 'exports', commonjs(fs.readFileSync(path.join(root, 'Electron/util/immersiveWindow.ts'), 'utf8')))(
            id => id === './windowBounds' ? boundsModule.exports : require(id), controllerModule, controllerModule.exports);
        win.setMinimumSize(1226, 700);
        const controller = controllerModule.exports.createImmersiveWindowController(win);
        controller.setEnabled(true);
        assert.deepEqual(win.getMinimumSize(), [360, 500]);
        win.setSize(360, 500);
        controller.setEnabled(false);
        assert.deepEqual(win.getMinimumSize(), [1226, 700]);
        assert.ok(win.getBounds().width >= 1226);
        assert.ok(win.getBounds().height >= 700);
        console.log('PASS: real Chromium DOM line breaks, selection scope, native copy defaults, focus, no-drag, exit button, and desktop/narrow rendering');
        console.log('PASS: native Electron minimum-size restoration');
        console.log('Screenshots:', output);
    } finally { win.destroy(); app.quit(); }
}).catch(error => { console.error(error); app.exit(1); });
