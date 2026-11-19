import { test } from "node:test";
import assert from "node:assert/strict";
import { COLUMN_GAP, handPadHeight, isTabletWindow, optionColumns, splitColumnWidths } from "../layout";

test("Spaltenbreiten 6:4 ohne Rundungsverlust", () => {
  for (const inner of [804, 852, 1072, 1120]) {
    const { preview, settings } = splitColumnWidths(inner);
    assert.equal(preview + settings + COLUMN_GAP, inner);
    assert.ok(preview > settings);
  }
  assert.deepEqual(splitColumnWidths(1072), { preview: 624, settings: 416 });
  assert.deepEqual(splitColumnWidths(10), { preview: 0, settings: 0 });
});

test("Raster: einspaltig wie bisher nach Fensterbreite", () => {
  assert.deepEqual(optionColumns(375, false, 0), { fonts: 2, papers: 2 });
  assert.deepEqual(optionColumns(430, false, 0), { fonts: 2, papers: 2 });
  assert.deepEqual(optionColumns(820, false, 0), { fonts: 3, papers: 4 });
});

test("Raster: in der Einstellungsspalte nach deren Breite", () => {
  assert.deepEqual(optionColumns(900, true, 320), { fonts: 2, papers: 2 });
  assert.deepEqual(optionColumns(1366, true, 416), { fonts: 3, papers: 2 });
  assert.deepEqual(optionColumns(1366, true, 500), { fonts: 3, papers: 4 });
});

test("Tablet-Fenster: kurze Seite ≥ 600 und Schrift ≤ 1,25", () => {
  assert.equal(isTabletWindow(1180, 820, 1), true);
  assert.equal(isTabletWindow(820, 1180, 1.25), true);
  assert.equal(isTabletWindow(390, 844, 1), false);
  assert.equal(isTabletWindow(932, 430, 1), false);
  assert.equal(isTabletWindow(1366, 1024, 1.5), false);
});

test("Zeichenfeld: Telefon 220, Tablet wächst mit der Höhe bis 420", () => {
  assert.equal(handPadHeight(844, false), 220);
  assert.equal(handPadHeight(1366, false), 220);
  assert.equal(handPadHeight(820, true), 247);
  assert.equal(handPadHeight(1024, true), 420);
  assert.equal(handPadHeight(1180, true), 420);
  assert.equal(handPadHeight(600, true), 220);
});
