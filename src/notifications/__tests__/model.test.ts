import assert from 'node:assert/strict';
import test from 'node:test';

import { clampHour, deviceRowId, hourLabel, prefsFromRow, stepHour, summary } from '../model';

test('Stunden bleiben im Bereich und laufen über Mitternacht', () => {
  assert.equal(clampHour(25), 23);
  assert.equal(clampHour(-3), 0);
  assert.equal(stepHour(23, 1), 0);
  assert.equal(stepHour(0, -1), 23);
  assert.equal(hourLabel(7), '07:00 Uhr');
});

test('deviceRowId ist gültig für Appwrite (höchstens 36 Zeichen, erlaubte Zeichen)', () => {
  const id = deviceRowId('A'.repeat(64));
  assert.ok(id.length <= 36);
  assert.match(id, /^[a-z0-9]+$/);
});

test('prefsFromRow füllt fehlende Werte mit Standardwerten', () => {
  assert.deepEqual(prefsFromRow({ cards: true, cardsHour: 9, mindmap: false }), { cards: true, cardsHour: 9, mindmap: false, mindmapHour: 8 });
  assert.equal(prefsFromRow({}).cards, false);
});

test('summary nennt aktive Erinnerungen', () => {
  assert.equal(summary(null), 'Aus');
  assert.equal(summary({ cards: false, cardsHour: 17, mindmap: false, mindmapHour: 8 }), 'Aus');
  assert.equal(summary({ cards: true, cardsHour: 17, mindmap: true, mindmapHour: 8 }), 'Karteikarten · Mindmap');
});
