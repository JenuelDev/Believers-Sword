import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotatedImageLayout, rotateView } from './viewRotation.ts';

test('quarter turns wrap in both directions and four rotations restore the view', () => {
    assert.equal(rotateView(0, -90), 270);
    assert.equal(rotateView(270, 90), 0);
    let angle = 0;
    for (let turn = 0; turn < 4; turn++) angle = rotateView(angle, 90);
    assert.equal(angle, 0);
});

test('PDF view rotation adds to the document orientation', () => {
    assert.equal(rotateView(90, 0), 90);
    assert.equal(rotateView(90, 270), 0);
    assert.equal(rotateView(270, 180), 90);
});

test('all image corners stay inside reachable layout bounds at every orientation', () => {
    for (const angle of [0, 90, 180, 270]) {
        const layout = rotatedImageLayout(1600, 900, 800, 1.5, angle);
        assert.equal(layout.stageWidth, 1200);
        assert.ok(Math.abs(layout.stageHeight - (angle % 180 ? 1200 * 1600 / 900 : 675)) < 1e-8);
        const radians = angle * Math.PI / 180;
        const cosine = Math.round(Math.cos(radians));
        const sine = Math.round(Math.sin(radians));
        const corners = [[0, 0], [layout.width, 0], [0, layout.height], [layout.width, layout.height]];
        const positions = corners.map(([x, y]) => [
            layout.offsetX + cosine * x - sine * y,
            layout.offsetY + sine * x + cosine * y,
        ]);
        assert.equal(Math.min(...positions.map(([x]) => x)), 0);
        assert.equal(Math.min(...positions.map(([, y]) => y)), 0);
        assert.equal(Math.max(...positions.map(([x]) => x)), layout.stageWidth);
        assert.equal(Math.max(...positions.map(([, y]) => y)), layout.stageHeight);
    }
});
