import assert from 'node:assert/strict';
import test from 'node:test';
import { canvasViewport } from '../wide';

test('a fitted mindmap uses the viewport as its centering area on iPhone and iPad', () => {
  const scene = { width: 880, height: 460 };
  for (const viewport of [{ width: 340, height: 550 }, { width: 720, height: 760 }, { width: 1070, height: 630 }]) {
    const geometry = canvasViewport(scene, viewport);
    assert.ok(geometry.width < viewport.width);
    assert.ok(geometry.height < viewport.height);
    assert.equal(geometry.contentWidth, viewport.width);
    assert.equal(geometry.contentHeight, viewport.height);
    assert.deepEqual(geometry.offset, { x: 0, y: 0 });
  }
});

test('overflow is centered with equal scrollable distance to both edges', () => {
  const viewport = { width: 340, height: 550 };
  const geometry = canvasViewport({ width: 2000, height: 2400 }, viewport);
  assert.deepEqual(geometry.offset, { x: 80, y: 25 });
  assert.equal(geometry.contentWidth - geometry.offset.x - viewport.width, geometry.offset.x);
  assert.equal(geometry.contentHeight - geometry.offset.y - viewport.height, geometry.offset.y);
});
