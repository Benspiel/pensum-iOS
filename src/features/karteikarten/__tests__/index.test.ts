/* Ergänzende Tests für den Planer-Vertrag (kein Web-Gegenstück: dort verlinkt der Planer per #deck=<id>, karteikarten.js ~769). */
import test from "node:test";
import assert from "node:assert/strict";
import { listDeckSummaries, parseDeckParam, resolveDeckParam, createGuestStore, createCloudStore } from "../index";
import { createLimiter } from "../../shared/limiter";
import { memoryKv, memoryRows, testTableIds } from "../../shared/testing";

const sample = { decks: [
  { id: "d1", name: "Englisch", mode: "level" as const, cards: [{ id: "c1", front: "a", back: "b", level: 1 as const }, { id: "c2", front: "c", back: "d", level: 2 as const }] },
  { id: "d2", name: "Latein", mode: "all" as const, cards: [] },
] };

test("listDeckSummaries: Gast (Reihenfolge, Kartenzahl, leerer Stapel)", async () => {
  const guest = createGuestStore({ kv: memoryKv() });
  assert.deepEqual(await listDeckSummaries(guest), []);
  await guest.save(sample);
  assert.deepEqual(await listDeckSummaries(guest), [
    { id: "d1", name: "Englisch", cardCount: 2 },
    { id: "d2", name: "Latein", cardCount: 0 },
  ]);
});

test("listDeckSummaries: Konto, nur eigene Stapel", async () => {
  const rows = memoryRows();
  const deps = { kv: memoryKv(), rows, tableIds: testTableIds };
  const opts = { limiter: createLimiter(3, 1) };
  const mine = createCloudStore({ $id: "u1" }, deps, opts);
  await mine.load();
  await mine.save(sample);
  await mine.flush();
  const other = createCloudStore({ $id: "u2" }, deps, opts);
  assert.deepEqual(await listDeckSummaries(other), []);
  assert.deepEqual(await listDeckSummaries(createCloudStore({ $id: "u1" }, deps, opts)), [
    { id: "d1", name: "Englisch", cardCount: 2 },
    { id: "d2", name: "Latein", cardCount: 0 },
  ]);
});

test("parseDeckParam: gültige IDs", () => {
  assert.equal(parseDeckParam({ deck: "abc123" }), "abc123");
  assert.equal(parseDeckParam({ deck: ["erste", "zweite"] }), "erste");
  assert.equal(parseDeckParam({ deck: "a_b-c.d", andere: "x" }), "a_b-c.d");
  assert.equal(parseDeckParam({ deck: "x".repeat(36) }), "x".repeat(36));
});

test("parseDeckParam: noch codierte Werte werden einmal decodiert", () => {
  assert.equal(parseDeckParam({ deck: "ab%2Dcd" }), "ab-cd");
  assert.equal(parseDeckParam({ deck: "%E0%A4%A" }), null, "kaputte Sequenz");
});

test("parseDeckParam: fehlend, leer, zu lang, Leerzeichen, Steuerzeichen → null", () => {
  assert.equal(parseDeckParam({}), null);
  assert.equal(parseDeckParam(undefined), null);
  assert.equal(parseDeckParam(null), null);
  assert.equal(parseDeckParam({ deck: undefined }), null);
  assert.equal(parseDeckParam({ deck: "" }), null);
  assert.equal(parseDeckParam({ deck: [] }), null);
  assert.equal(parseDeckParam({ deck: "x".repeat(37) }), null);
  assert.equal(parseDeckParam({ deck: "a b" }), null);
  assert.equal(parseDeckParam({ deck: "   " }), null);
  assert.equal(parseDeckParam({ deck: "a%0Ab" }), null);
});

test("resolveDeckParam: verwaiste ID → null, vorhandene → ID", () => {
  assert.equal(resolveDeckParam(sample, { deck: "d2" }), "d2");
  assert.equal(resolveDeckParam(sample, { deck: "gibtsnicht" }), null);
  assert.equal(resolveDeckParam(sample, {}), null);
  assert.equal(resolveDeckParam({ decks: [] }, { deck: "d1" }), null);
});
