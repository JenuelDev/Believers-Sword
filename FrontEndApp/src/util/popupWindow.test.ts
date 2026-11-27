import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPopupHash } from './popupWindow.ts';

test('popup windows are recognized from their start URL hash, with or without a query', () => {
    for (const hash of ['#/bible-question?id=4&question=Why%3F', '#/bible-question', '#/compare-verse?book=10&chapter=1']) {
        assert.equal(isPopupHash(hash), true, hash);
    }
});

test('main-window routes and look-alike paths are not popups', () => {
    for (const hash of ['', '#/', '#/prayer-list', '#/bible-questions', '#/compare-verse-old', '#/profile/profile']) {
        assert.equal(isPopupHash(hash), false, hash);
    }
});
