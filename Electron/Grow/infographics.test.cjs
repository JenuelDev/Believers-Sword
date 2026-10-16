const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { validateResourcePath, resourceMetadata } = require('../../dist/Grow/infographicPaths.js');
const { extractInfographics } = require('../../dist/Grow/infographicArchive.js');

test('unsafe archive paths are rejected and viewer paths preserve special characters', () => {
    for (const name of ['../outside.png', '/outside.pdf', 'C:/outside.png', 'folder\\outside.png', 'folder/../outside.png']) {
        assert.throws(() => validateResourcePath(name), /unsafe path/);
    }
    const item = resourceMetadata("World Religions/Islam/Jesus+&+God's+Word.png", 42);
    assert.equal(item.category, 'World Religions');
    assert.equal(item.title, "Jesus & God's Word");
    assert.equal(decodeURIComponent(new URL(item.url).pathname.slice(1)), item.fileName);
});

test('invalid ZIP does not publish an installed collection or remove a saved one', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'infographics-test-'));
    try {
        const destination = path.join(root, 'collection');
        await fs.mkdir(destination);
        await fs.writeFile(path.join(destination, 'existing.png'), 'saved');
        const zip = path.join(root, 'invalid.zip');
        await fs.writeFile(zip, 'not a ZIP');
        await assert.rejects(extractInfographics(zip, destination));
        assert.equal(await fs.readFile(path.join(destination, 'existing.png'), 'utf8'), 'saved');
        await assert.rejects(fs.access(`${destination}.extracting`));
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test('actual collection installs 46 images and 5 PDFs across 10 categories', {
    skip: !process.env.INFOGRAPHICS_TEST_ZIP,
}, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'infographics-real-'));
    try {
        const destination = path.join(root, 'collection');
        const resources = await extractInfographics(process.env.INFOGRAPHICS_TEST_ZIP, destination);
        assert.equal(resources.length, 51);
        assert.equal(resources.filter(item => item.isPdf).length, 5);
        assert.equal(new Set(resources.map(item => item.category)).size, 10);
        for (const item of resources) {
            const bytes = await fs.readFile(path.join(destination, item.fileName));
            assert.equal(bytes.length, item.size);
            if (item.isPdf) assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
            else assert.deepEqual([...bytes.subarray(0, 4)], [137, 80, 78, 71]);
        }
        assert.equal(JSON.parse(await fs.readFile(path.join(destination, 'catalog.json'), 'utf8')).length, 51);
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});
