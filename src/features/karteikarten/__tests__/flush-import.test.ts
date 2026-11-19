/* Tests für flushOrThrow (store.ts) und den Gastimport ohne Duplikate (ops.ts: importGuestDecks, importIntoAccount). Kein Web-Gegenstück. */
import test from "node:test";
import assert from "node:assert/strict";
import { createCloudStore, createGuestStore } from "../store";
import type { KarteikartenData } from "../store";
import { importGuestDecks, importIntoAccount } from "../ops";
import { createLimiter } from "../../shared/limiter";
import { memoryKv, memoryRows, testTableIds } from "../../shared/testing";
import type { SaveStatus } from "../../shared/ports";

const opts = () => ({ limiter: createLimiter(3, 1), retryDelayMs: 60_000, syncDelayMs: 10_000 });
const rowsOf = (rows: ReturnType<typeof memoryRows>, table: string) => rows.tables.get(table) ?? new Map();
let n = 0;
const newId = () => "n" + ++n;

const sample = (): KarteikartenData => ({ decks: [{ id: "d1", name: "Englisch", mode: "level", cards: [{ id: "c1", front: "Hund", back: "dog", level: 1 }, { id: "c2", front: "Katze", back: "cat", level: 2 }] }] });
const localData = (): KarteikartenData => ({ decks: [
  { id: "l1", name: "Englisch", mode: "level", cards: [{ id: "x", front: "Hund", back: "dog", level: 1 }, { id: "y", front: "Katze", back: "cat", level: 2 }] },
  { id: "l2", name: "Latein", mode: "all", cards: [{ id: "q", front: "aqua", back: "Wasser", level: 1 }] },
] });

/* ---------- flushOrThrow ---------- */

test("flushOrThrow: löst bei Erfolg auf, auch mit gesammelten Änderungen; ohne Änderungen sofort", async () => {
  const rows = memoryRows();
  const store = createCloudStore({ $id: "u1" }, { kv: memoryKv(), rows, tableIds: testTableIds }, opts());
  await store.load();
  await store.flushOrThrow(); // nichts zu tun
  await store.save(sample()); // gesammelt, Timer läuft noch
  assert.equal(rows.log.length, 0);
  await store.flushOrThrow();
  assert.equal(rowsOf(rows, "cards").size, 2);
});

test("flushOrThrow: lehnt bei Schreibfehler ab, der nächste Versuch gelingt", async () => {
  const rows = memoryRows();
  const statuses: SaveStatus[] = [];
  const store = createCloudStore({ $id: "u1" }, { kv: memoryKv(), rows, tableIds: testTableIds, onStatus: (s) => statuses.push(s) }, opts());
  await store.load();
  await store.save(sample());
  rows.failNext("createRow", { code: 400 });
  await assert.rejects(() => store.flushOrThrow());
  assert.equal(statuses.at(-1), "error");
  assert.equal(rowsOf(rows, "decks").size, 0);
  await store.flushOrThrow();
  assert.equal(statuses.at(-1), "saved");
  assert.equal(rowsOf(rows, "cards").size, 2);
});

test("flush() verschluckt Fehler (löst auf), flushOrThrow meldet denselben anhaltenden Fehler", async () => {
  const rows = memoryRows();
  const store = createCloudStore({ $id: "u1" }, { kv: memoryKv(), rows, tableIds: testTableIds }, opts());
  await store.load();
  await store.save(sample());
  rows.failNext("createRow", { code: 400 }, 2); // auch der erneute Versuch scheitert
  await store.flush(); // AppState und Unmount: kein Fehler nach außen
  await assert.rejects(() => store.flushOrThrow());
  await store.flushOrThrow(); // und danach geht es wieder
  assert.equal(rowsOf(rows, "cards").size, 2);
});

test("flushOrThrow: Serverfehler 500 wird vom Limiter wiederholt und gilt dann als Erfolg", async () => {
  const rows = memoryRows();
  const store = createCloudStore({ $id: "u1" }, { kv: memoryKv(), rows, tableIds: testTableIds }, opts());
  await store.load();
  await store.save(sample());
  rows.failNext("createRow", { code: 500 });
  await store.flushOrThrow();
  assert.equal(rowsOf(rows, "decks").size, 1);
});

test("flushOrThrow: Gast-Store lehnt nie ab und wartet auf Schreibzugriffe", async () => {
  const kv = memoryKv();
  const guest = createGuestStore({ kv });
  void guest.save(sample());
  await guest.flushOrThrow();
  assert.equal(Object.keys(kv.dump()).length, 1);
});

/* ---------- Import ohne Duplikate ---------- */

test("importGuestDecks: gleicher Stapelname + gleiche Kartenpaare werden nicht doppelt angelegt", () => {
  const account: KarteikartenData = { decks: [{ id: "k1", name: "Englisch", mode: "all", cards: [{ id: "a", front: "Hund", back: "dog", level: 3 }] }] };
  const local: KarteikartenData = { decks: [
    { id: "l1", name: "Englisch", mode: "level", cards: [{ id: "x", front: "Hund", back: "dog", level: 1 }, { id: "y", front: "Katze", back: "cat", level: 2 }, { id: "z", front: "Katze", back: "cat", level: 1 }] },
    { id: "l2", name: "Latein", mode: "level", cards: [{ id: "q", front: "aqua", back: "Wasser", level: 1 }] },
  ] };
  const r = importGuestDecks(account, local, newId);
  assert.equal(r.complete, true);
  assert.equal(r.decks, 2);
  assert.equal(r.cards, 2);
  assert.equal(r.data.decks.length, 2);
  const en = r.data.decks[0]!;
  assert.equal(en.id, "k1");
  assert.equal(en.mode, "all", "Modus des vorhandenen Stapels bleibt");
  assert.deepEqual(en.cards.map((c) => c.front), ["Hund", "Katze"]);
  assert.equal(en.cards[0]!.level, 3, "vorhandene Karte unverändert");
  assert.equal(account.decks[0]!.cards.length, 1, "Eingabe unverändert");
  // zweiter Lauf auf dem Ergebnis: nichts Neues, dasselbe Objekt
  const again = importGuestDecks(r.data, local, newId);
  assert.equal(again.data, r.data);
  assert.deepEqual([again.decks, again.cards, again.complete, again.noRoom], [0, 0, true, false]);
  assert.equal(again.message, "Alle lokalen Karten sind schon in deinem Konto.");
});

test("importGuestDecks: Konto voll, aber alles schon vorhanden → vollständig, nichts zu tun", () => {
  const mk = (id: string) => ({ id, name: "S" + id, mode: "level" as const, cards: [{ id: id + "c", front: "f", back: "b", level: 1 as const }] });
  const full: KarteikartenData = { decks: ["a", "b", "c", "d", "e"].map(mk) };
  const r = importGuestDecks(full, { decks: [mk("a"), mk("b")] }, newId);
  assert.deepEqual([r.complete, r.noRoom, r.decks], [true, false, 0]);
});

/* ---------- importIntoAccount ---------- */

test("importIntoAccount: Erfolg – Konto hat die Daten, Gast-Speicher ist leer", async () => {
  const rows = memoryRows();
  const store = createCloudStore({ $id: "u1" }, { kv: memoryKv(), rows, tableIds: testTableIds }, opts());
  let current = await store.load();
  const kv = memoryKv();
  const guest = createGuestStore({ kv });
  await guest.save(localData());
  const out = await importIntoAccount({ local: await guest.peek(), getData: () => current, setData: (d) => { current = d; }, store, guest });
  assert.deepEqual([out.saved, out.cleared, out.result.complete], [true, true, true]);
  assert.equal(rowsOf(rows, "decks").size, 2);
  assert.equal(rowsOf(rows, "cards").size, 3);
  assert.deepEqual(kv.dump(), {});
  assert.equal(current.decks.length, 2);
});

test("importIntoAccount: Teilfehler lässt die Gastdaten stehen, Wiederholung erzeugt keine Duplikate", async () => {
  const rows = memoryRows();
  const store = createCloudStore({ $id: "u1" }, { kv: memoryKv(), rows, tableIds: testTableIds }, opts());
  let current = await store.load();
  const kv = memoryKv();
  const guest = createGuestStore({ kv });
  await guest.save(localData());
  const run = async () => importIntoAccount({ local: await guest.peek(), getData: () => current, setData: (d) => { current = d; }, store, guest });

  rows.failNext("createRow", { code: 400 }); // einer der beiden Stapel scheitert, der andere kommt an
  const failed = await run();
  assert.deepEqual([failed.saved, failed.cleared], [false, false]);
  assert.ok(failed.error);
  assert.equal(Object.keys(kv.dump()).length, 1, "Gastdaten bleiben");

  const retried = await run(); // Wiederholung: nichts mehr zu übernehmen, nur noch fertig speichern
  assert.deepEqual([retried.saved, retried.cleared, retried.result.decks], [true, true, 0]);
  assert.deepEqual(kv.dump(), {});
  assert.equal(rowsOf(rows, "decks").size, 2);
  assert.equal(rowsOf(rows, "cards").size, 3);
  assert.equal(rows.log.filter((l) => l.startsWith("create:")).length, 5, "jede Zeile genau einmal angelegt");
});

test("importIntoAccount: nach Neustart (Konto lädt neu, Gastdaten noch da) fehlt nur das Fehlende", async () => {
  const rows = memoryRows();
  const deps = { kv: memoryKv(), rows, tableIds: testTableIds };
  // Das Konto hat den Englisch-Stapel schon (z. B. aus einem früheren, nur teilweise geglückten Lauf)
  const seed = createCloudStore({ $id: "u1" }, deps, opts());
  await seed.load();
  await seed.save({ decks: [{ ...localData().decks[0]!, id: "e1", cards: localData().decks[0]!.cards.map((c) => ({ ...c, id: "e" + c.id })) }] });
  await seed.flushOrThrow();

  const store = createCloudStore({ $id: "u1" }, deps, opts());
  let current = await store.load();
  const kv = memoryKv();
  const guest = createGuestStore({ kv });
  await guest.save(localData());
  const out = await importIntoAccount({ local: await guest.peek(), getData: () => current, setData: (d) => { current = d; }, store, guest });
  assert.deepEqual([out.saved, out.cleared, out.result.decks, out.result.cards], [true, true, 1, 1]);
  assert.deepEqual(current.decks.map((d) => d.name), ["Englisch", "Latein"]);
  assert.equal(rowsOf(rows, "decks").size, 2);
  assert.equal(rowsOf(rows, "cards").size, 3);
  assert.deepEqual(kv.dump(), {});
});

test("importIntoAccount: Konto voll → nichts geschrieben, Gastdaten bleiben", async () => {
  const rows = memoryRows();
  const store = createCloudStore({ $id: "u1" }, { kv: memoryKv(), rows, tableIds: testTableIds }, opts());
  await store.load();
  let current: KarteikartenData = { decks: ["a", "b", "c", "d", "e"].map((i) => ({ id: i, name: "Voll " + i, mode: "all" as const, cards: [] })) };
  const kv = memoryKv();
  const guest = createGuestStore({ kv });
  await guest.save(localData());
  const out = await importIntoAccount({ local: await guest.peek(), getData: () => current, setData: (d) => { current = d; }, store, guest });
  assert.deepEqual([out.result.noRoom, out.saved, out.cleared], [true, false, false]);
  assert.equal(rows.log.length, 0);
  assert.equal(Object.keys(kv.dump()).length, 1);
});
