/* Tests für session-model.ts (Zustandsautomat und Lernrunde). Web-Gegenstück: Verhalten in karteikarten.js (startStudy, grade, renderResult), dort ohne Tests. */
import test from "node:test";
import assert from "node:assert/strict";
import type { Deck, DeckMode, Level } from "../core";
import {
  checkRound, currentCard, deckMeta, flipRound, goLabel, gradeRound, initialView, listStats, loadingDelay, loadingSubtitle, loadingTitle,
  newRound, nextRound, overrideRound, progressPercent, restartDeck, resultTexts, roundBadge, saveNote, startRound, viewReducer,
} from "../session-model";
import type { View } from "../session-model";

const noShuffle = () => 0.999999;
const mk = (mode: DeckMode, levels: number[]): Deck => ({ id: "d", name: "Englisch", mode, cards: levels.map((l, i) => ({ id: "c" + i, front: "f" + i, back: "b" + i, level: l as Level })) });

test("startRound: leer, braucht Neustart, bereit", () => {
  assert.deepEqual(startRound(mk("all", []), "practice"), { kind: "empty", message: "Füge dem Stapel zuerst Karten hinzu." });
  assert.deepEqual(startRound(mk("level", [5, 5]), "test"), { kind: "needsReset" });
  const all5 = startRound(mk("all", [5, 5]), "test", { rng: noShuffle });
  assert.equal(all5.kind, "ready");
  const r = startRound(mk("level", [3, 1, 5]), "practice", { rng: noShuffle });
  assert.ok(r.kind === "ready");
  if (r.kind === "ready") {
    assert.deepEqual(r.round.queue, ["c1", "c0"]);
    assert.equal(r.round.total, 2);
    assert.equal(r.round.deckId, "d");
    assert.equal(r.round.feedback, null);
  }
  const retry = startRound(mk("all", [1, 1, 1]), "practice", { queueOverride: ["c2"] });
  assert.ok(retry.kind === "ready" && retry.round.total === 1);
});

test("restartDeck setzt alle Karten auf Level 1; danach startet die Runde", () => {
  const d = mk("level", [5, 5]);
  restartDeck(d);
  const r = startRound(d, "practice", { rng: noShuffle });
  assert.ok(r.kind === "ready" && r.round.queue.length === 2);
});

test("Üben im Level-Modus: umdrehen, bewerten, falsche Karte kommt wieder", () => {
  const d = mk("level", [2, 2]);
  let round = newRound("d", "practice", ["c0", "c1"]);
  round = flipRound(round);
  assert.equal(round.flipped, true);
  assert.equal(flipRound(round), round);
  round = gradeRound(d, round, true);
  assert.equal(d.cards[0]?.level, 3);
  assert.deepEqual(round.queue, ["c1"]);
  assert.equal(round.flipped, false);
  assert.equal(round.right, 1);
  round = gradeRound(d, round, false);
  assert.equal(d.cards[1]?.level, 1);
  assert.deepEqual(round.queue, ["c1"]);
  assert.deepEqual(round.wrongIds, ["c1"]);
  round = gradeRound(d, round, false);
  assert.deepEqual(round.wrongIds, ["c1"], "keine Doppelten");
  assert.equal(round.wrong, 2);
  round = gradeRound(d, round, true);
  assert.deepEqual(round.queue, []);
  assert.equal(gradeRound(d, round, true), round, "leere Runde bleibt gleich");
});

test("Test: prüfen, Feedback, Trotzdem richtig, Weiter", () => {
  const d = mk("all", [1, 1]);
  d.cards[0]!.back = "Katze / cat";
  let round = newRound("d", "test", ["c0", "c1"]);
  const card = currentCard(d, round);
  assert.equal(card?.id, "c0");
  const wrong = checkRound(round, card, "hund");
  assert.deepEqual(wrong.feedback, { ok: false, given: "hund" });
  assert.equal(checkRound(wrong, card, "cat"), wrong, "Feedback wird nicht überschrieben");
  const fixed = overrideRound(wrong);
  assert.equal(fixed.feedback?.ok, true);
  assert.equal(overrideRound(round), round);
  assert.equal(checkRound(round, undefined, "x"), round);
  assert.deepEqual(checkRound(round, card, "CAT").feedback, { ok: true, given: "CAT" });
  round = nextRound(d, fixed);
  assert.equal(round.right, 1);
  assert.deepEqual(round.queue, ["c1"]);
  assert.equal(round.feedback, null);
  assert.equal(nextRound(d, round), round, "ohne Feedback kein Weiter");
});

test("Alle-Modus: falsche Karten werden gemerkt, nicht wiederholt", () => {
  const d = mk("all", [1, 1]);
  let round = newRound("d", "practice", ["c0", "c1"]);
  round = gradeRound(d, round, false);
  assert.deepEqual(round.queue, ["c1"]);
  round = gradeRound(d, round, true);
  assert.deepEqual(round.queue, []);
  assert.deepEqual(round.wrongIds, ["c0"]);
  assert.deepEqual(resultTexts(d, round), { big: "1/2", title: "Fast geschafft.", text: "1 von 2 Karten gewusst.", retry: true, boxes: false });
});

test("Ergebnistexte: Level-Modus und Alles richtig", () => {
  const level = mk("level", [1]);
  const lr = { ...newRound("d", "practice", []), right: 3, wrong: 1 };
  assert.deepEqual(resultTexts(level, lr), { big: "✓", title: "Runde geschafft.", text: "4 Antworten, davon 3 richtig.", retry: false, boxes: true });
  const all = mk("all", [1, 1]);
  const ar = { ...newRound("d", "test", []), total: 2, right: 2 };
  const t = resultTexts(all, ar);
  assert.equal(t.title, "Alles richtig!");
  assert.equal(t.retry, false);
  assert.equal(resultTexts(level, { ...lr, right: 1, wrong: 0 }).text, "1 Antwort, davon 1 richtig.");
});

test("Fortschritt, Badge, Ladetexte", () => {
  const d = mk("level", [2, 3]);
  const r = newRound("d", "practice", ["c0", "c1"]);
  assert.equal(progressPercent(r), 0);
  assert.equal(progressPercent({ ...r, queue: ["c1"] }), 50);
  assert.equal(progressPercent(newRound("d", "practice", [])), 0);
  assert.equal(roundBadge(d, r, currentCard(d, r)), "2 übrig · Level 2");
  assert.equal(roundBadge(mk("all", [1]), r, undefined), "2 übrig");
  assert.equal(loadingTitle("test"), "Dein Test wird vorbereitet …");
  assert.equal(loadingTitle("practice"), "Deine Runde wird vorbereitet …");
  assert.equal(loadingSubtitle("Englisch", 1), "Englisch · 1 Karte wird gemischt");
  assert.equal(loadingSubtitle("Englisch", 3), "Englisch · 3 Karten werden gemischt");
  assert.equal(loadingDelay(false), 900);
  assert.equal(loadingDelay(true), 200);
});

test("Listentexte: Banner, Kennzahlen, Start-Knopf, Meta", () => {
  assert.deepEqual(listStats({ decks: [] }), { decks: "0/5", cards: 0, due: 0, full: false, banner: "Leg deinen ersten Stapel an." });
  assert.equal(listStats({ decks: [mk("level", [1, 1])] }).banner, "Lerne heute: 2 Karten warten auf dich.");
  assert.equal(listStats({ decks: [mk("level", [1])] }).banner, "Lerne heute: 1 Karte wartet auf dich.");
  assert.equal(listStats({ decks: [mk("level", [5])] }).banner, "Alles gelernt. Stark!");
  assert.equal(listStats({ decks: [mk("all", [])] }).banner, "Füge deinen Stapeln Karten hinzu.");
  const five = { decks: [1, 2, 3, 4, 5].map(() => mk("all", [])) };
  assert.equal(listStats(five).full, true);
  assert.equal(goLabel(mk("level", [5])), "✓");
  assert.equal(goLabel(mk("level", [1, 5])), "1");
  assert.equal(goLabel(mk("all", [])), null);
  assert.equal(deckMeta(mk("level", [1])), "1 Karte · Level");
  assert.equal(deckMeta(mk("all", [1, 1])), "2 Karten · Alle hintereinander");
});

test("Speicherhinweis", () => {
  assert.equal(saveNote(false, "saved").loginHint, true);
  assert.equal(saveNote(true, "saving").text, "Speichert …");
  assert.equal(saveNote(true, "error").text, "Speichern fehlgeschlagen. Es wird erneut versucht, sobald du wieder online bist.");
  assert.deepEqual(saveNote(true, "saved"), { text: "In deinem Konto gespeichert, auf allen deinen Geräten.", hollow: false, loginHint: false });
});

test("viewReducer: Ablauf Liste → Stapel → Runde → Ergebnis → Stapel", () => {
  let v: View = initialView;
  assert.deepEqual(v, { name: "boot" });
  v = viewReducer(v, { type: "loaded", deckId: null });
  assert.deepEqual(v, { name: "list" });
  assert.deepEqual(viewReducer(initialView, { type: "loaded", deckId: "d" }), { name: "deck", id: "d", tab: "learn" });
  v = viewReducer(v, { type: "openDeck", id: "d" });
  assert.deepEqual(v, { name: "deck", id: "d", tab: "learn" });
  v = viewReducer(v, { type: "setTab", tab: "add" });
  assert.deepEqual(v, { name: "deck", id: "d", tab: "add" });
  assert.deepEqual(viewReducer({ name: "list" }, { type: "setTab", tab: "add" }), { name: "list" });
  const round = newRound("d", "practice", ["c0", "c1"]);
  v = viewReducer(v, { type: "beginRound", round });
  assert.deepEqual(v, { name: "loading", round, count: 2 });
  assert.deepEqual(viewReducer({ name: "list" }, { type: "roundReady" }), { name: "list" }, "roundReady nur aus dem Ladeschritt");
  v = viewReducer(v, { type: "roundReady" });
  assert.equal(v.name, "study");
  const mid = { ...round, queue: ["c1"] };
  assert.deepEqual(viewReducer(v, { type: "updateRound", round: mid }), { name: "study", round: mid });
  const done = { ...round, queue: [] };
  v = viewReducer(v, { type: "updateRound", round: done });
  assert.deepEqual(v, { name: "result", round: done });
  assert.deepEqual(viewReducer(v, { type: "toDeck" }), { name: "deck", id: "d", tab: "learn" });
  assert.deepEqual(viewReducer({ name: "list" }, { type: "updateRound", round }), { name: "list" });
  assert.deepEqual(viewReducer({ name: "study", round }, { type: "toDeck" }), { name: "deck", id: "d", tab: "learn" });
  assert.deepEqual(viewReducer({ name: "list" }, { type: "toDeck" }), { name: "list" });
  assert.deepEqual(viewReducer(v, { type: "boot" }), { name: "boot" });
  assert.deepEqual(viewReducer(v, { type: "list" }), { name: "list" });
});
