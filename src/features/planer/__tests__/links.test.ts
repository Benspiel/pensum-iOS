/* Tests für die Verknüpfung Klausur ↔ Karteikarten-Stapel (neu; Web-Quelle der Regeln: tools/planer/planer.js examCard, Web-Commit 770dbe4). */
import test from "node:test";
import assert from "node:assert/strict";
import { resolveDeck, deckLinkHref, type DeckSummary } from "../links";

const decks: DeckSummary[] = [
  { id: "d1", name: "Vokabeln", cardCount: 40 },
  { id: "d2", name: "Bruchrechnen", cardCount: 0 },
];

test("resolveDeck: findet den verknüpften Stapel", () => {
  assert.deepEqual(resolveDeck({ deckId: "d1" }, decks), decks[0]);
  assert.deepEqual(resolveDeck({ deckId: "d2" }, decks), decks[1]); // auch ein leerer Stapel bleibt verknüpft
});

test("resolveDeck: ohne deckId oder mit verwaister deckId → null (kein Link)", () => {
  assert.equal(resolveDeck({ deckId: "" }, decks), null);
  assert.equal(resolveDeck({ deckId: null }, decks), null);
  assert.equal(resolveDeck({}, decks), null);
  assert.equal(resolveDeck({ deckId: "geloescht" }, decks), null);
  assert.equal(resolveDeck({ deckId: "D1" }, decks), null, "IDs sind groß-/kleinschreibungsempfindlich");
  assert.equal(resolveDeck({ deckId: "d1" }, []), null, "Stapelliste noch nicht geladen");
});

test("resolveDeck ändert den Eintrag nicht", () => {
  const item = { deckId: "geloescht" };
  resolveDeck(item, decks);
  assert.deepEqual(item, { deckId: "geloescht" });
});

test("deckLinkHref: Route der App mit Query-Parameter deck, sicher kodiert", () => {
  assert.equal(deckLinkHref("d1"), "/tools/karteikarten?deck=d1");
  assert.equal(deckLinkHref("a b&c=d#e"), "/tools/karteikarten?deck=a%20b%26c%3Dd%23e");
  assert.equal(deckLinkHref("äö"), "/tools/karteikarten?deck=%C3%A4%C3%B6");
  assert.ok(!deckLinkHref("x").includes("#"), "kein Fragment wie im Web");
});
