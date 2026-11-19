import { test } from "node:test";
import assert from "node:assert/strict";
import { contentMaxWidth, innerWidth, toolGrid } from "./wide";

test("Inhaltsbreite: Telefon 760, iPad nur mit wide ab 900 pt", () => {
  assert.equal(contentMaxWidth(390, false), 760);
  assert.equal(contentMaxWidth(390, true), 760);
  assert.equal(contentMaxWidth(820, true), 760);
  assert.equal(contentMaxWidth(1024, false), 760);
  assert.equal(contentMaxWidth(900, true), 1120);
  assert.equal(contentMaxWidth(1366, true), 1120);
});

test("Nutzbare Breite berücksichtigt Ränder und Höchstbreite", () => {
  assert.equal(innerWidth(390, 0, 16, true), 358);
  assert.equal(innerWidth(1366, 0, 24, true), 1072);
  assert.equal(innerWidth(1366, 40, 24, false), 712);
  assert.equal(innerWidth(0, 0, 24, true), 0);
});

test("Kachel-Raster: 1, 2 oder 3 Spalten, große Schrift einspaltig", () => {
  assert.deepEqual(toolGrid(358, 1, 16), { columns: 1, gap: 16, tileWidth: undefined });
  assert.deepEqual(toolGrid(700, 1, 24), { columns: 2, gap: 24, tileWidth: 338 });
  assert.deepEqual(toolGrid(1072, 1, 24), { columns: 3, gap: 24, tileWidth: 341 });
  assert.equal(toolGrid(1072, 1.5, 24).columns, 1);
  assert.equal(toolGrid(1072, 1.25, 24).columns, 3);
});

test("Kacheln füllen die Zeile höchstens aus", () => {
  for (const inner of [640, 700, 772, 1000, 1072]) {
    const g = toolGrid(inner, 1, 24);
    if (g.tileWidth !== undefined) assert.ok(g.tileWidth * g.columns + g.gap * (g.columns - 1) <= inner);
  }
});
