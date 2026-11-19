/* Web-Quelle: tests/karteikarten.test.mjs (Pensum, Web-Commit 770dbe4). Die ersten fünf Tests sind 1:1 portiert, Erwartungswerte unverändert. */
import test from "node:test";
import assert from "node:assert/strict";
import { normalize, isCorrect, buildQueue, answerCard, levelCounts, dueCount, resetLevels, shuffle, MODES, MAX_DECKS, LEVELS } from "../core";
import type { DeckLike, DeckMode, Level } from "../core";

const mk = (mode: DeckMode, levels: number[]): DeckLike => ({ mode, cards: levels.map((l, i) => ({ id: "c" + i, front: "f" + i, back: "b" + i, level: l as Level })) });
const noShuffle = () => 0.999999; // Fisher-Yates mit festem Wert lässt die Reihenfolge unverändert

test("normalize und isCorrect", () => {
  assert.equal(normalize("  Hund. "), "hund");
  assert.ok(isCorrect("hund", "Hund"));
  assert.ok(isCorrect("cat", "Katze / cat"));
  assert.ok(!isCorrect("", "x"));
  assert.ok(!isCorrect("über", "uber"));
});

test("Level-Modus: Level 5 wird nicht abgefragt", () => {
  const d = mk("level", [1, 5, 3]);
  assert.equal(dueCount(d), 2);
  assert.deepEqual(buildQueue(d, noShuffle), ["c0", "c2"]);
  assert.deepEqual(levelCounts(d), [1, 0, 1, 0, 1]);
});

test("Level-Modus: richtig steigt, falsch fällt und kommt nochmal", () => {
  const d = mk("level", [2, 2]);
  let q = ["c0", "c1"];
  ({ queue: q } = answerCard(d, q, true));
  assert.equal(d.cards[0].level, 3);
  assert.deepEqual(q, ["c1"]);
  ({ queue: q } = answerCard(d, q, false));
  assert.equal(d.cards[1].level, 1);
  assert.deepEqual(q, ["c1"]);
  ({ queue: q } = answerCard(d, q, false));
  assert.equal(d.cards[1].level, 1, "Level 1 bleibt Level 1");
  ({ queue: q } = answerCard(d, q, true));
  assert.deepEqual(q, []);
  assert.equal(d.cards[1].level, 2);
});

test("Alle-Modus: jede Karte einmal, keine Level", () => {
  const d = mk("all", [1, 1]);
  assert.equal(buildQueue(d).length, 2);
  const { queue } = answerCard(d, ["c0", "c1"], false);
  assert.deepEqual(queue, ["c1"]);
  assert.equal(d.cards[0].level, 1);
});

test("resetLevels", () => {
  const d = mk("level", [4, 5]);
  resetLevels(d);
  assert.deepEqual(levelCounts(d), [2, 0, 0, 0, 0]);
});

/* ---------- Ergänzungen für die iOS-Portierung ---------- */

test("Konstanten wie im Web", () => {
  assert.equal(MAX_DECKS, 5);
  assert.equal(LEVELS, 5);
  assert.deepEqual(Object.keys(MODES), ["all", "level"]);
  assert.equal(MODES.level.label, "Level (5 Stufen)");
});

test("shuffle: Zufallsquelle injizierbar, Eingabe bleibt unverändert, nichts geht verloren", () => {
  const list = [1, 2, 3, 4, 5];
  assert.deepEqual(shuffle(list, () => 0.999999), [1, 2, 3, 4, 5]);
  assert.deepEqual(shuffle(list, () => 0), [2, 3, 4, 5, 1]); // j = 0 bei jedem Schritt
  assert.deepEqual(list, [1, 2, 3, 4, 5]);
  assert.deepEqual([...shuffle(list)].sort(), list);
  assert.deepEqual(shuffle([]), []);
});

test("buildQueue im Level-Modus: niedrige Level zuerst, bei gleichem Level bleibt die gemischte Reihenfolge", () => {
  const d = mk("level", [3, 1, 2, 1, 4]);
  assert.deepEqual(buildQueue(d, noShuffle), ["c1", "c3", "c2", "c0", "c4"]);
});

test("buildQueue im Alle-Modus nimmt auch Level 5 mit", () => {
  const d = mk("all", [5, 5, 1]);
  assert.equal(dueCount(d), 3);
  assert.deepEqual(buildQueue(d, noShuffle), ["c0", "c1", "c2"]);
});

test("answerCard: Level 5 bleibt bei richtig 5; leere oder unbekannte Karte", () => {
  const d = mk("level", [5]);
  answerCard(d, ["c0"], true);
  assert.equal(d.cards[0].level, 5);
  const r = answerCard(d, ["fremd", "c0"], true);
  assert.equal(r.card, null);
  assert.deepEqual(r.queue, ["c0"]);
  assert.deepEqual(answerCard(d, [], true), { queue: [], card: null });
});

test("answerCard: Ergebnis enthält die bewertete Karte; Eingabe-Warteschlange bleibt unverändert", () => {
  const d = mk("level", [2, 2]);
  const q = ["c0", "c1"];
  const r = answerCard(d, q, false);
  assert.equal(r.card?.id, "c0");
  assert.deepEqual(r.queue, ["c1", "c0"]);
  assert.deepEqual(q, ["c0", "c1"]);
});

test("levelCounts: fehlendes oder ungültiges Level zählt als Level 1, zu große Werte als Level 5", () => {
  const d = mk("level", [0, 7, 3]);
  assert.deepEqual(levelCounts(d), [1, 0, 1, 0, 1]);
});

test("isCorrect: Alternativen mit / und ;, Satzzeichen am Rand, Groß-/Kleinschreibung, Unicode-Normalisierung", () => {
  assert.ok(isCorrect("haus", "Haus / Gebäude"));
  assert.ok(isCorrect("gebäude", "Haus; Gebäude"));
  assert.ok(isCorrect("  „Hund“! ", "hund"));
  assert.ok(isCorrect("Haus / Gebäude", "Haus / Gebäude"), "ganze Rückseite zählt auch");
  assert.ok(isCorrect("über", "über"), "zerlegtes ü gleich ü");
  assert.ok(!isCorrect("   ", "x"));
  assert.ok(!isCorrect("katze", "Hund / Maus"));
  assert.ok(!isCorrect(null, "x"));
  assert.equal(normalize(null), "");
  assert.equal(normalize("A   B\n c"), "a b c");
});
