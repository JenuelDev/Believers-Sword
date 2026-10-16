import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    migrateReplacedVersions,
    resolveAvailableVersions,
} from './bibleVersions.ts';

const BS_KJV = 'bs_KJV - 1769.SQLite3';
const KJV_1769 = 'King James Version - 1769.SQLite3';
const ASV = 'ASV+.SQLite3';
const KJV_1611 = 'King James Bible 1611 Pure Cambridge Edition 1900.SQLite3';

// What /api/bible/version-details serves — note the absence of the bs_* modules,
// which only ever exist inside a desktop install.
const WEB_MODULES = [ASV, KJV_1611, KJV_1769, 'King James Version of 1611 or 1769.SQLite3'];
const DESKTOP_MODULES = [ASV, KJV_1611, BS_KJV, 'bs_NASB - 1971.SQLite3'];

test('migrateReplacedVersions rewrites replaced modules only', () => {
    assert.deepEqual(migrateReplacedVersions([KJV_1769, ASV]), [BS_KJV, ASV]);
    assert.deepEqual(migrateReplacedVersions([BS_KJV]), [BS_KJV]);
});

test('a module the web API does not serve falls back to the one it replaced', () => {
    assert.deepEqual(
        resolveAvailableVersions([ASV, KJV_1611, BS_KJV], WEB_MODULES),
        [ASV, KJV_1611, KJV_1769],
    );
});

test('the web default alone still resolves to a readable module', () => {
    assert.deepEqual(resolveAvailableVersions([BS_KJV], WEB_MODULES), [KJV_1769]);
});

test('installed modules are left exactly as they are', () => {
    assert.deepEqual(
        resolveAvailableVersions([ASV, BS_KJV], DESKTOP_MODULES),
        [ASV, BS_KJV],
    );
});

test('an unknown module list means "not loaded yet", not "nothing installed"', () => {
    assert.deepEqual(resolveAvailableVersions([BS_KJV], []), [BS_KJV]);
});

test('the substitute is never a module another pane already shows', () => {
    assert.deepEqual(
        resolveAvailableVersions([KJV_1769, BS_KJV], WEB_MODULES),
        [KJV_1769, ASV],
    );
});

test('with every available module already open, a duplicate beats a dead pane', () => {
    assert.deepEqual(
        resolveAvailableVersions([...WEB_MODULES, BS_KJV], WEB_MODULES),
        [...WEB_MODULES, KJV_1769],
    );
});
