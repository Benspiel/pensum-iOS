/* Tests für ki/cards.ts (KI-Karten): Anfrage, Antwort, Fehlercodes, Auswahl und Duplikate.
 * Web-Quellen: tools/karteikarten/ki.js, functions/ki-chat/lib.js (Web-Commit 770dbe4). Die Texte der Fehlercodes stehen wörtlich in der Function. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCardsRequest, clampCount, checkKiInput, cleanText, parseCardsResponse, generateCards, kiErrorText, messageForCode, KiError, KI_MESSAGES,
  kiBusy, kiFailed, kiLoaded, kiToggle, chosenCount, kiVisibleFor, addButtonLabel, addChosen, consentDescription,
  COUNTS, DEFAULT_COUNT, MISSING_INPUT, NOT_SET_UP, FALLBACK_ERROR, TEXT_MAX,
} from "../ki/cards";
import type { CardsRequest } from "../ki/cards";
import { PensumError } from "../../../contracts";
import type { Deck } from "../core";

let n = 0;
const newId = () => "k" + ++n;
const deck = (cards: Array<[string, string]> = []): Deck => ({ id: "d", name: "S", mode: "level", cards: cards.map(([front, back], i) => ({ id: "c" + i, front, back, level: 3 })) });

/* ---------- Anfrage ---------- */

test("Anfrage: Text auf 8000 Zeichen kürzen, Steuerzeichen raus, Anzahl begrenzen", () => {
  const r = buildCardsRequest({ text: "  Französische\r\nRevolution\u0000  ", count: 40 });
  assert.deepEqual(r, { action: "cards", text: "Französische\nRevolution", count: 40 });
  assert.equal(buildCardsRequest({ text: "x".repeat(9000) }).text.length, TEXT_MAX);
  assert.equal(buildCardsRequest({ text: "a" }).count, DEFAULT_COUNT);
  assert.equal(buildCardsRequest({ text: "a", count: 500 }).count, 60);
  assert.equal(buildCardsRequest({ text: "a", count: 0 }).count, 15, "0 und NaN → Standard der Function");
  assert.equal(buildCardsRequest({ text: "a", count: -4 }).count, 1);
  assert.equal(buildCardsRequest({ text: "a", count: 12.6 }).count, 13);
  assert.equal(clampCount("abc"), 15);
  assert.deepEqual([...COUNTS], [10, 15, 20, 30, 40, 60]);
});

test("Anfrage: Bild als Base64 ohne Präfix, nur Bild genügt, ohne beides Fehler", () => {
  assert.deepEqual(buildCardsRequest({ image: "AAAA", count: 10 }), { action: "cards", text: "", image: "AAAA", count: 10 });
  assert.deepEqual(buildCardsRequest({ text: "Thema", image: "BBBB" }).image, "BBBB");
  assert.equal("image" in buildCardsRequest({ text: "Thema" }), false);
  assert.throws(() => buildCardsRequest({ text: "   " }), (e: unknown) => e instanceof KiError && e.message === MISSING_INPUT);
  assert.equal(checkKiInput("  ", false), MISSING_INPUT);
  assert.equal(checkKiInput("", true), null);
  assert.equal(checkKiInput("Thema", false), null);
  assert.equal(cleanText(null, 5), "");
});

/* ---------- Antwort ---------- */

test("Antwort: gültige Karten, bereinigt, ohne Leere und Doppelte", () => {
  const cards = parseCardsResponse({ ok: true, cards: [
    { front: " Hund ", back: " dog " },
    { front: "hund", back: "doppelt" },
    { front: "Katze", back: "" },
    { front: 5, back: "x" },
    null,
    { front: "Haus", back: "house" },
  ] });
  assert.deepEqual(cards, [{ front: "Hund", back: "dog" }, { front: "Haus", back: "house" }]);
  const long = parseCardsResponse({ ok: true, cards: [{ front: "f".repeat(1500), back: "b" }] });
  assert.equal(long[0]?.front.length, 1000);
  const many = parseCardsResponse({ ok: true, cards: Array.from({ length: 100 }, (_, i) => ({ front: "f" + i, back: "b" })) });
  assert.equal(many.length, 60);
});

test("Antwort: ok:false, fehlende oder leere Karten, Unbrauchbares", () => {
  assert.throws(() => parseCardsResponse({ ok: false, error: "Für heute ist das Limit erreicht. Morgen geht es weiter.", code: "limit" }), (e: unknown) => e instanceof KiError && e.kiCode === "limit" && e.message.startsWith("Für heute"));
  assert.throws(() => parseCardsResponse({ ok: false, code: "busy" }), (e: unknown) => e instanceof KiError && e.message === KI_MESSAGES.busy);
  assert.throws(() => parseCardsResponse({ ok: false }), (e: unknown) => e instanceof KiError && e.message === FALLBACK_ERROR);
  assert.throws(() => parseCardsResponse({ ok: true, cards: [] }), (e: unknown) => e instanceof KiError && e.kiCode === "empty" && e.message === KI_MESSAGES.empty);
  assert.throws(() => parseCardsResponse({ ok: true }), (e: unknown) => e instanceof KiError && e.kiCode === "empty");
  for (const bad of [null, undefined, "text", 7, []]) assert.throws(() => parseCardsResponse(bad), (e: unknown) => e instanceof KiError && e.message === FALLBACK_ERROR);
});

/* ---------- Fehlercodes ---------- */

test("Fehlercodes → deutsche Meldungen (alle Codes der Function)", () => {
  const expected: Record<string, string> = {
    auth: "Nicht angemeldet.",
    unverified: "Bitte bestätige zuerst deine E-Mail-Adresse.",
    forbidden: "Der KI-Chat ist nur für das Team „Ki-Tester“ freigeschaltet.",
    limit: "Für heute ist das Limit erreicht. Morgen geht es weiter.",
    image: "Diese Datei kann die KI nicht lesen. Nimm ein JPEG, PNG, WebP oder ein PDF (bis ca. 2,5 MB).",
    empty: "Daraus konnte die KI keine Karten machen. Versuch ein anderes Thema oder ein deutlicheres Foto.",
    blocked: "Dazu kann die KI nichts sagen. Formuliere die Frage anders.",
    busy: "Die KI ist gerade überlastet. Probier es in ein paar Minuten noch einmal.",
    error: "Die KI antwortet gerade nicht. Versuch es später noch einmal.",
    setup: "Der KI-Dienst ist noch nicht eingerichtet.",
  };
  for (const [code, text] of Object.entries(expected)) {
    assert.equal(messageForCode(code), text, code);
    // ok:false ohne eigenen Text → Text zum Code
    assert.throws(() => parseCardsResponse({ ok: false, code }), (e: unknown) => e instanceof KiError && e.message === text, code);
  }
  assert.equal(messageForCode("gibtsnicht"), null);
  assert.equal(messageForCode(undefined), null);
});

test("kiErrorText: 404 = Dienst nicht eingerichtet, sonst der Text der Function, sonst Standardtext", () => {
  assert.equal(NOT_SET_UP, "Der KI-Dienst ist noch nicht eingerichtet.");
  assert.equal(kiErrorText(new PensumError("not-found", "Function not found", 404)), NOT_SET_UP);
  assert.equal(kiErrorText({ code: 404 }), NOT_SET_UP);
  assert.equal(kiErrorText(new PensumError("rate-limit", KI_MESSAGES.limit, 429)), KI_MESSAGES.limit);
  assert.equal(kiErrorText(new PensumError("forbidden", KI_MESSAGES.unverified, 403)), KI_MESSAGES.unverified, "403 gilt für unverified und forbidden: der Text entscheidet");
  assert.equal(kiErrorText(new PensumError("forbidden", KI_MESSAGES.forbidden, 403)), KI_MESSAGES.forbidden);
  assert.equal(kiErrorText(new PensumError("unauthenticated", KI_MESSAGES.auth, 401)), KI_MESSAGES.auth);
  assert.equal(kiErrorText(new PensumError("invalid", KI_MESSAGES.image, 422)), KI_MESSAGES.image);
  assert.equal(kiErrorText(new PensumError("server", KI_MESSAGES.busy, 503)), KI_MESSAGES.busy);
  assert.equal(kiErrorText(new PensumError("offline", "Keine Verbindung zu Pensum. Prüfe deine Internetverbindung.")), "Keine Verbindung zu Pensum. Prüfe deine Internetverbindung.");
  assert.equal(kiErrorText(new KiError("empty", "x")), "x");
  assert.equal(kiErrorText(new Error("Das PDF ist zu groß (höchstens ca. 2,5 MB).")), "Das PDF ist zu groß (höchstens ca. 2,5 MB).");
  assert.equal(kiErrorText(undefined), FALLBACK_ERROR);
  assert.equal(kiErrorText({ message: "  " }), FALLBACK_ERROR);
});

/* ---------- generateCards mit nachgebautem executeFunction ---------- */

/** Wie executeFunction aus src/backend: 2xx → Body, sonst PensumError mit body.error als Text. */
const fakeExecute = (status: number, body: unknown) => async (payload: CardsRequest): Promise<unknown> => {
  seen.push(payload);
  if (status >= 200 && status < 300) return body;
  const message = body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string" ? (body as { error: string }).error : undefined;
  throw new PensumError(status === 429 ? "rate-limit" : status === 403 ? "forbidden" : status === 404 ? "not-found" : "server", message ?? "Standardtext", status);
};
const seen: CardsRequest[] = [];

test("generateCards: Erfolg schickt action cards mit Text, Bild und Anzahl", async () => {
  seen.length = 0;
  const cards = await generateCards(fakeExecute(200, { ok: true, cards: [{ front: "a", back: "b" }] }), { text: " Thema ", image: "QUJD", count: 20 });
  assert.deepEqual(cards, [{ front: "a", back: "b" }]);
  assert.deepEqual(seen, [{ action: "cards", text: "Thema", image: "QUJD", count: 20 }]);
});

test("generateCards: Fehlerantworten der Function (Status + Text) werden zu KiError mit Anzeigetext", async () => {
  const cases: Array<[number, string, string]> = [
    [401, "auth", KI_MESSAGES.auth], [403, "unverified", KI_MESSAGES.unverified], [403, "forbidden", KI_MESSAGES.forbidden],
    [429, "limit", KI_MESSAGES.limit], [422, "image", KI_MESSAGES.image], [422, "empty", KI_MESSAGES.empty], [422, "blocked", KI_MESSAGES.blocked],
    [503, "busy", KI_MESSAGES.busy], [502, "error", KI_MESSAGES.error],
  ];
  for (const [status, code, text] of cases) {
    await assert.rejects(() => generateCards(fakeExecute(status, { ok: false, error: text, code }), { text: "x" }), (e: unknown) => e instanceof KiError && e.message === text, code);
  }
  await assert.rejects(() => generateCards(fakeExecute(404, undefined), { text: "x" }), (e: unknown) => e instanceof KiError && e.message === NOT_SET_UP);
  await assert.rejects(() => generateCards(async () => { throw {}; }, { text: "x" }), (e: unknown) => e instanceof KiError && e.message === FALLBACK_ERROR);
});

test("generateCards: 200 mit ok:false und leere Karten → KiError; ohne Eingabe wird nichts gesendet", async () => {
  seen.length = 0;
  await assert.rejects(() => generateCards(fakeExecute(200, { ok: false, error: "Zu viel los.", code: "busy" }), { text: "x" }), (e: unknown) => e instanceof KiError && e.message === "Zu viel los.");
  await assert.rejects(() => generateCards(fakeExecute(200, { ok: true, cards: [] }), { text: "x" }), (e: unknown) => e instanceof KiError && e.kiCode === "empty");
  seen.length = 0;
  await assert.rejects(() => generateCards(fakeExecute(200, { ok: true, cards: [] }), { text: "" }), (e: unknown) => e instanceof KiError && e.message === MISSING_INPUT);
  assert.equal(seen.length, 0);
});

/* ---------- Auswahl und Duplikate ---------- */

test("Vorschläge: alle vorgewählt, Häkchen setzen, Knopfbeschriftung, Sichtbarkeit pro Stapel", () => {
  assert.equal(kiVisibleFor(null, "d"), false);
  let s = kiLoaded("d", [{ front: "a", back: "1" }, { front: "b", back: "2" }, { front: "c", back: "3" }]);
  assert.equal(chosenCount(s), 3);
  assert.equal(addButtonLabel(3), "3 Karten hinzufügen");
  assert.equal(addButtonLabel(1), "1 Karte hinzufügen");
  assert.equal(addButtonLabel(0), "Nichts ausgewählt");
  s = kiToggle(s, 1);
  assert.equal(chosenCount(s), 2);
  s = kiToggle(s, 1, true);
  assert.equal(chosenCount(s), 3);
  assert.equal(kiToggle(s, 9), s);
  assert.equal(kiVisibleFor(s, "d"), true);
  assert.equal(kiVisibleFor(s, "anderer"), false);
  assert.equal(chosenCount(kiBusy("d")), 0);
  assert.deepEqual(kiFailed("d", "x"), { deckId: "d", phase: "error", error: "x" });
  assert.equal(kiToggle(kiBusy("d"), 0)?.phase, "busy");
  assert.equal(consentDescription(true), "Dein Thema oder Text und die ausgewählte Datei");
  assert.equal(consentDescription(false), "Dein Thema oder Text");
});

test("addChosen: nur gewählte Karten, Doppelte (Vorderseite ohne Groß-/Kleinschreibung) übersprungen, Meldungen wie im Web", () => {
  const d = deck([["Hund", "dog"]]);
  let s = kiLoaded("d", [{ front: " hund ", back: "dog" }, { front: "Katze", back: "cat" }, { front: "Haus", back: "house" }]);
  s = kiToggle(s, 2); // Haus abgewählt
  const r = addChosen(d, s, newId);
  assert.ok(r);
  assert.deepEqual([r.added, r.picked], [1, 2]);
  assert.equal(r.message, "1 Karte hinzugefügt, Doppelte übersprungen.");
  assert.deepEqual(d.cards.map((c) => [c.front, c.level]), [["Hund", 3], ["Katze", 1]]);
  const all = addChosen(deck(), kiLoaded("d", [{ front: "a", back: "1" }, { front: "b", back: "2" }]), newId);
  assert.equal(all?.message, "2 Karten hinzugefügt.");
  assert.equal(addChosen(deck(), kiToggle(kiToggle(kiLoaded("d", [{ front: "a", back: "1" }]), 0), 0, false), newId), null, "nichts gewählt");
  assert.equal(addChosen(deck(), null, newId), null);
  assert.equal(addChosen(deck(), kiBusy("d"), newId), null);
});
