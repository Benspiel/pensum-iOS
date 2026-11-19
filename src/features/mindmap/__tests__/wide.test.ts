import assert from 'node:assert/strict';
import test from 'node:test';
import { MAP_COLUMN_WEIGHTS, SOLO_PANEL_MAX, canvasHeightFor, mapColumnWidth, soloPanelMaxWidth } from '../wide';

test('canvasHeightFor: Telefon bleibt bei 55 % zwischen 340 und 560 (Karte egal)', () => {
  assert.equal(canvasHeightFor(812, false), 447);
  assert.equal(canvasHeightFor(500, false), 340);
  assert.equal(canvasHeightFor(1366, false), 560);
  assert.equal(canvasHeightFor(812, false, { sceneWidth: 400, sceneHeight: 300, canvasWidth: 340 }), 447);
});

test('canvasHeightFor: iPad quer bekommt bis 80 % der Fensterhöhe', () => {
  assert.equal(canvasHeightFor(1024, true), 819);
  assert.equal(canvasHeightFor(820, true), 656);
  assert.equal(canvasHeightFor(1180, true), 900);
  assert.equal(canvasHeightFor(400, true), 440);
});

test('canvasHeightFor: breit und Karte bekannt: nicht höher als die eingepasste Karte braucht', () => {
  // Karte 1300 x 700 in 650 pt Breite: Zoom 0,45 (auf 0,05 abgerundet), Höhe 315 + 24 -> Untergrenze 440
  assert.equal(canvasHeightFor(1024, true, { sceneWidth: 1300, sceneHeight: 700, canvasWidth: 650 }), 440);
  // Karte 800 x 1200 in 650 pt Breite: Zoom 0,8, 960 + 24 -> Kappe 819
  assert.equal(canvasHeightFor(1024, true, { sceneWidth: 800, sceneHeight: 1200, canvasWidth: 650 }), 819);
  // Karte 900 x 800 in 650 pt Breite: Zoom 0,7, 560 + 24 = 584
  assert.equal(canvasHeightFor(1024, true, { sceneWidth: 900, sceneHeight: 800, canvasWidth: 650 }), 584);
});

test('canvasHeightFor: ungültige Werte fallen auf Untergrenze oder Kappe', () => {
  assert.equal(canvasHeightFor(0, true), 440);
  assert.equal(canvasHeightFor(Number.NaN, false), 340);
  assert.equal(canvasHeightFor(-5, true), 440);
  assert.equal(canvasHeightFor(1024, true, { sceneWidth: 0, sceneHeight: 700, canvasWidth: 650 }), 819);
  assert.equal(canvasHeightFor(1024, true, { sceneWidth: 900, sceneHeight: 800, canvasWidth: 0 }), 819);
});

test('Spaltengewichte und Kartenbreite: Karte 6 von 10 nach Abzug des Abstands', () => {
  assert.ok(MAP_COLUMN_WEIGHTS.primary > MAP_COLUMN_WEIGHTS.secondary);
  assert.equal(mapColumnWidth(1072, 24), 628);
  assert.equal(mapColumnWidth(0, 24), 0);
});

test('soloPanelMaxWidth: nur allein stehende Panels in der breiten Ansicht', () => {
  assert.equal(soloPanelMaxWidth(true, false), SOLO_PANEL_MAX);
  assert.equal(soloPanelMaxWidth(true, true), undefined);
  assert.equal(soloPanelMaxWidth(false, false), undefined);
});
