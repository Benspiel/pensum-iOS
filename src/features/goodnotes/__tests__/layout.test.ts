import { test } from "node:test";
import assert from "node:assert/strict";
import { handPadHeight, isTabletWindow, optionColumns, previewColumns } from "../layout";

test("Auch auf einem iPad im Hochformat bleiben dem Editor mindestens 440 Punkte", () => {
  for (const inner of [676, 696, 712, 852, 1072, 1120]) {
    const columns = previewColumns(inner, 820, 1);
    assert.ok(columns && columns.preview >= 220 && columns.editor >= 440);
    assert.equal(columns.preview + columns.editor + columns.gap, inner);
  }
  assert.deepEqual(previewColumns(696, 1133, 1), { preview: 240, editor: 440, gap: 16 });
  assert.deepEqual(previewColumns(1072, 820, 1), { preview: 529, editor: 503, gap: 40 });
});

test("Vorschau wird bei wenig Platz oder großer Schrift separat angezeigt", () => {
  assert.equal(previewColumns(343, 812, 1), undefined);
  assert.equal(previewColumns(675, 820, 1), undefined);
  assert.equal(previewColumns(852, 430, 1), undefined);
  assert.equal(previewColumns(1072, 820, 1.5), undefined);
});

test("Stilraster berücksichtigt verfügbare Breite und Schriftgröße", () => {
  assert.deepEqual(optionColumns(343, 1, 17), { fonts: 2, papers: 2 });
  assert.deepEqual(optionColumns(440, 1, 25), { fonts: 3, papers: 2 });
  assert.deepEqual(optionColumns(503, 1, 25), { fonts: 3, papers: 4 });
  assert.deepEqual(optionColumns(500, 1.5, 25), { fonts: 2, papers: 2 });
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
