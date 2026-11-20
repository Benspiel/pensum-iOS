import assert from 'node:assert/strict';
import test from 'node:test';

import { barHeights, dayAgo, pct, weekday } from '../format';

test('barHeights skaliert auf den höchsten Wert, kleinster sichtbarer Balken 4 %', () => {
  assert.deepEqual(barHeights([0, 1, 100, null]), [0, 4, 100, 0]);
  assert.deepEqual(barHeights([0, 0]), [0, 0]);
  assert.deepEqual(barHeights([50, 100]), [50, 100]);
});

test('pct rundet und fängt fehlende Basis ab', () => {
  assert.equal(pct(1, 3), 33);
  assert.equal(pct(5, 0), 0);
  assert.equal(pct(null, 10), 0);
  assert.equal(pct(20, 10), 100);
});

test('weekday und dayAgo', () => {
  assert.equal(weekday('2026-11-19'), 'Do');
  assert.equal(weekday('kaputt'), '');
  assert.equal(dayAgo('2026-11-20', '2026-11-20'), 'heute');
  assert.equal(dayAgo('2026-11-19', '2026-11-20'), 'gestern');
  assert.equal(dayAgo('2026-11-17', '2026-11-20'), 'vor 3 Tagen');
  assert.equal(dayAgo(null, '2026-11-20'), '');
});
