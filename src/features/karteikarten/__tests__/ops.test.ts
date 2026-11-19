/* Ergänzende Tests für ops.ts (Logik, die im Web in karteikarten.js direkt an der Oberfläche steht). */
import test from "node:test";
import assert from "node:assert/strict";
import { checkNewDeck, checkDeckEdit, checkCardText, addCard, mergeKiCards, kiAddedMessage, importGuestDecks, importPrompt, shouldOfferImport, readDeclined, markDeclined, DECLINED_KEY } from "../ops";
import type { KarteikartenData } from "../store";
import { memoryKv } from "../../shared/testing";

let n = 0;
const newId = () => "n" + ++n;
const deck = (id: string, cards = 1): KarteikartenData["decks"][number] => ({ id, name: "S" + id, mode: "level", cards: Array.from({ length: cards }, (_, i) => ({ id: id + "c" + i, front: "f" + i, back: "b" + i, level: (i % 5 + 1) as 1 })) });

test("checkNewDeck: Name Pflicht, Limit 5, Modus", () => {
  const empty: KarteikartenData = { decks: [] };
  assert.deepEqual(checkNewDeck(empty, { name: "   ", mode: "level" }, newId), { ok: false, error: "Gib dem Stapel einen Namen." });
  const ok = checkNewDeck(empty, { name: "  Englisch ", mode: "level" }, newId);
  assert.ok(ok.ok);
  if (ok.ok) { assert.equal(ok.value.name, "Englisch"); assert.equal(ok.value.mode, "level"); assert.deepEqual(ok.value.cards, []); }
  const unknownMode = checkNewDeck(empty, { name: "x", mode: "quatsch" }, newId);
  assert.ok(unknownMode.ok && unknownMode.value.mode === "all");
  const full: KarteikartenData = { decks: [deck("a"), deck("b"), deck("c"), deck("d"), deck("e")] };
  assert.deepEqual(checkNewDeck(full, { name: "x", mode: "all" }, newId), { ok: false, error: "Du kannst höchstens 5 Stapel haben." });
});

test("checkDeckEdit und checkCardText: Meldungen wie im Web", () => {
  assert.deepEqual(checkDeckEdit({ name: "", mode: "all" }), { ok: false, error: "Gib dem Stapel einen Namen." });
  assert.deepEqual(checkDeckEdit({ name: " A ", mode: "level" }), { ok: true, value: { name: "A", mode: "level" } });
  assert.deepEqual(checkCardText({ front: "a", back: " " }), { ok: false, error: "Fülle Vorder- und Rückseite aus." });
  assert.deepEqual(checkCardText({ front: "", back: "b" }, "edit"), { ok: false, error: "Vorder- und Rückseite dürfen nicht leer sein." });
  assert.deepEqual(checkCardText({ front: " a ", back: " b " }), { ok: true, value: { front: "a", back: "b" } });
});

test("addCard: neue Karte auf Level 1 am Ende", () => {
  const d = deck("d", 1);
  const c = addCard(d, "Haus", "house", newId);
  assert.equal(c.level, 1);
  assert.equal(d.cards.at(-1), c);
});

test("mergeKiCards: Doppelte (Vorderseite, ohne Groß-/Kleinschreibung und Leerraum) werden übersprungen", () => {
  const d = deck("d", 0);
  d.cards.push({ id: "x", front: "Hund", back: "dog", level: 3 });
  const added = mergeKiCards(d, [{ front: " hund ", back: "dog" }, { front: "Katze", back: "cat" }], newId);
  assert.equal(added, 1);
  assert.deepEqual(d.cards.map((c) => c.front), ["Hund", "Katze"]);
  assert.equal(d.cards[1]!.level, 1);
  assert.equal(kiAddedMessage(1, 1), "1 Karte hinzugefügt.");
  assert.equal(kiAddedMessage(2, 3), "2 Karten hinzugefügt, Doppelte übersprungen.");
});

test("importGuestDecks: neue IDs, Konto bleibt unverändert, Limit 5", () => {
  const current: KarteikartenData = { decks: [deck("k1"), deck("k2")] };
  const local: KarteikartenData = { decks: [deck("l1", 2), deck("l2", 3)] };
  const r = importGuestDecks(current, local, newId);
  assert.equal(current.decks.length, 2);
  assert.equal(r.data.decks.length, 4);
  assert.equal(r.decks, 2);
  assert.equal(r.cards, 5);
  assert.equal(r.complete, true);
  assert.equal(r.noRoom, false);
  assert.equal(r.message, "2 Stapel mit 5 Karten in dein Konto übernommen.");
  const ids = r.data.decks.flatMap((d) => [d.id, ...d.cards.map((c) => c.id)]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(!ids.includes("l1") && !ids.includes("l1c0"));
  assert.deepEqual(r.data.decks[2]!.cards.map((c) => c.front), ["f0", "f1"]);

  const four: KarteikartenData = { decks: [deck("a"), deck("b"), deck("c"), deck("d")] };
  const part = importGuestDecks(four, local, newId);
  assert.equal(part.decks, 1);
  assert.equal(part.complete, false);
  assert.equal(part.message, "1 Stapel mit 2 Karten in dein Konto übernommen. Mehr als 5 Stapel passen nicht.");

  const five: KarteikartenData = { decks: [deck("a"), deck("b"), deck("c"), deck("d"), deck("e")] };
  const none = importGuestDecks(five, local, newId);
  assert.equal(none.noRoom, true);
  assert.equal(none.data, five);
  assert.equal(none.message, "Dein Konto hat schon 5 Stapel. Lösche einen, um lokale Stapel zu übernehmen.");
});

test("Übernahme-Angebot: Text, Ablehnen merken (pro Konto), kaputte Merkliste", async () => {
  const local: KarteikartenData = { decks: [deck("l1", 2)] };
  assert.equal(importPrompt(local).text, "Auf diesem Gerät liegt 1 Stapel mit 2 Karten aus dem Gast-Modus. Sollen sie in dein Konto übernommen werden? Sonst bleiben sie getrennt auf diesem Gerät.");
  assert.ok(importPrompt({ decks: [deck("a", 1), deck("b", 1)] }).text.startsWith("Auf diesem Gerät liegen 2 Stapel mit 2 Karten"));
  const kv = memoryKv();
  assert.deepEqual(await readDeclined(kv), []);
  assert.equal(shouldOfferImport(local, await readDeclined(kv), "u1"), true);
  await markDeclined(kv, "u1");
  await markDeclined(kv, "u1");
  await markDeclined(kv, "u2");
  assert.deepEqual(await readDeclined(kv), ["u1", "u2"]);
  assert.equal(DECLINED_KEY, "pensum.karteikarten.declined.v1");
  assert.equal(shouldOfferImport(local, await readDeclined(kv), "u1"), false);
  assert.equal(shouldOfferImport(local, await readDeclined(kv), "u3"), true);
  assert.equal(shouldOfferImport({ decks: [] }, [], "u3"), false);
  assert.deepEqual(await readDeclined(memoryKv({ [DECLINED_KEY]: "{kaputt" })), []);
  assert.deepEqual(await readDeclined(memoryKv({ [DECLINED_KEY]: '{"a":1}' })), []);
});
