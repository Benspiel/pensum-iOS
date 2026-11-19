/* Web-Quelle: tests/karteikarten-store.test.mjs (Pensum, Web-Commit 770dbe4).
 * Der erste Cloud-Test ist die Portierung; statt der Mock-Datei /js/db.js dient memoryRows aus ../shared/testing,
 * statt `__calls` das Protokoll rows.log ("update:cards:c1" statt "update cards"). Erwartungswerte unverändert.
 * Danach folgen Ergänzungen: Gast, getrennte Konten, Teilfehler, Wiederholungen bei Serverfehlern. */
import test from "node:test";
import assert from "node:assert/strict";
import { createCloudStore, createGuestStore, clean, GUEST_KEY } from "../store";
import type { KarteikartenData } from "../store";
import { createLimiter } from "../../shared/limiter";
import { memoryKv, memoryRows, testTableIds } from "../../shared/testing";
import type { KeyValueStore, SaveStatus } from "../../shared/ports";

const data = (): KarteikartenData => ({ decks: [{ id: "d1", name: "Englisch", mode: "level", cards: [{ id: "c1", front: "Hund", back: "dog", level: 1 }, { id: "c2", front: "Katze", back: "cat", level: 2 }] }] });
const fast = () => ({ limiter: createLimiter(3, 1), retryDelayMs: 60_000 });
const wait = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const rowsOf = (rows: ReturnType<typeof memoryRows>, table: string) => rows.tables.get(table) ?? new Map();

test("Konto-Speicher: anlegen, ändern, löschen, laden", async () => {
  const rows = memoryRows();
  const statuses: SaveStatus[] = [];
  const deps = { kv: memoryKv(), rows, tableIds: testTableIds, onStatus: (s: SaveStatus) => statuses.push(s) };
  const store = createCloudStore({ $id: "u1" }, deps, fast());
  assert.deepEqual(await store.load(), { decks: [] });

  const d = data();
  await store.save(d);
  await store.flush();
  assert.equal(rowsOf(rows, "decks").size, 1);
  assert.equal(rowsOf(rows, "cards").size, 2);
  assert.equal(rowsOf(rows, "cards").get("c1")?.userId, "u1");
  assert.equal(statuses.at(-1), "saved");

  // nur geänderte Karte wird geschrieben
  rows.log.length = 0;
  d.decks[0].cards[0].level = 2;
  await store.save(d);
  await store.flush();
  assert.deepEqual(rows.log, ["update:cards:c1"]);
  assert.equal(rowsOf(rows, "cards").get("c1")?.level, 2);

  // Karte löschen, Karte hinzufügen
  d.decks[0].cards = d.decks[0].cards.filter((c) => c.id !== "c2");
  d.decks[0].cards.push({ id: "c3", front: "Haus", back: "house", level: 1 });
  await store.save(d);
  await store.flush();
  assert.deepEqual([...rowsOf(rows, "cards").keys()].sort(), ["c1", "c3"]);

  // neu laden (anderes Gerät) liefert denselben Stand
  const other = createCloudStore({ $id: "u1" }, { ...deps, onStatus: undefined }, fast());
  const loaded = await other.load();
  assert.equal(loaded.decks[0].name, "Englisch");
  assert.deepEqual(loaded.decks[0].cards.map((c) => c.id).sort(), ["c1", "c3"]);

  // Stapel löschen entfernt auch seine Karten
  await store.save({ decks: [] });
  await store.flush();
  assert.equal(rowsOf(rows, "decks").size, 0);
  assert.equal(rowsOf(rows, "cards").size, 0);
});

/* ---------- Gast ---------- */

test("Gast: speichern und neu laden, Schlüssel wie im Web", async () => {
  const kv = memoryKv();
  const guest = createGuestStore({ kv });
  assert.equal(guest.kind, "guest");
  assert.deepEqual(await guest.load(), { decks: [] });
  assert.equal(await guest.save(data()), true);
  assert.deepEqual(Object.keys(kv.dump()), ["pensum.karteikarten.v1"]);
  assert.equal(GUEST_KEY, "pensum.karteikarten.v1");
  const again = createGuestStore({ kv }); // frischer Store = App-Neustart
  assert.deepEqual(await again.load(), data());
  assert.deepEqual(await again.peek(), data());
});

test("Gast: kaputte oder fehlende Daten ergeben leeren Stand; load bereinigt", async () => {
  assert.deepEqual(await createGuestStore({ kv: memoryKv({ [GUEST_KEY]: "{kaputt" }) }).load(), { decks: [] });
  assert.deepEqual(await createGuestStore({ kv: memoryKv({ [GUEST_KEY]: "null" }) }).load(), { decks: [] });
  const dirty = JSON.stringify({ decks: [{ name: "", mode: "x", cards: [{ front: "a", back: "b", level: 99 }, { front: "c", back: "d", level: "zwei" }] }] });
  let n = 0;
  const g = createGuestStore({ kv: memoryKv({ [GUEST_KEY]: dirty }), rows: { newId: () => "gen" + ++n } });
  const [deck] = (await g.load()).decks;
  assert.equal(deck.name, "Stapel");
  assert.equal(deck.mode, "all");
  assert.equal(deck.id, "gen1");
  assert.deepEqual(deck.cards.map((c) => [c.id, c.level]), [["gen2", 5], ["gen3", 1]]);
});

test("clean: höchstens 5 Stapel, 2000 Karten, Längen begrenzt, Level gerundet und begrenzt", () => {
  const six = { decks: Array.from({ length: 6 }, (_, i) => ({ id: "d" + i, name: "x".repeat(200), mode: "level", cards: [] })) };
  const c = clean(six);
  assert.equal(c.decks.length, 5);
  assert.equal(c.decks[0].name.length, 80);
  const many = clean({ decks: [{ id: "d", name: "n", cards: Array.from({ length: 2100 }, (_, i) => ({ id: "c" + i, front: "f".repeat(1500), back: "b", level: 2.6 })) }] });
  assert.equal(many.decks[0].cards.length, 2000);
  assert.equal(many.decks[0].cards[0].front.length, 1000);
  assert.equal(many.decks[0].cards[0].level, 3);
  assert.deepEqual(clean(undefined), { decks: [] });
  assert.deepEqual(clean({ decks: "nein" }), { decks: [] });
  assert.equal(clean({ decks: [{ id: "i".repeat(50), name: "n", cards: [] }] }).decks[0].id.length, 36);
});

test("Gast: Schreibzugriffe laufen nacheinander, der letzte gewinnt; Momentaufnahme beim Aufruf", async () => {
  const written: string[] = [];
  const inner = memoryKv();
  let slow = true;
  const kv: KeyValueStore = {
    getItem: (k) => inner.getItem(k),
    removeItem: (k) => inner.removeItem(k),
    async setItem(k, v) { if (slow) { slow = false; await wait(20); } written.push(v); await inner.setItem(k, v); },
  };
  const guest = createGuestStore({ kv });
  const d = data();
  const p1 = guest.save(d);
  d.decks[0].name = "Zweiter Stand";
  const p2 = guest.save(d);
  d.decks[0].name = "Nach dem Speichern geändert";
  assert.deepEqual(await Promise.all([p1, p2]), [true, true]);
  assert.equal(JSON.parse(written[0]).decks[0].name, "Englisch", "erster Aufruf hat seinen Stand mitgenommen");
  assert.equal(JSON.parse(written[1]).decks[0].name, "Zweiter Stand");
  assert.equal((await guest.load()).decks[0].name, "Zweiter Stand");
});

test("Gast: save liefert false bei verweigertem Schreiben, danach geht es weiter; flush wartet; clear löscht", async () => {
  const inner = memoryKv();
  let fail = true;
  const kv: KeyValueStore = {
    getItem: (k) => inner.getItem(k),
    removeItem: (k) => inner.removeItem(k),
    async setItem(k, v) { if (fail) throw new Error("voll"); await inner.setItem(k, v); },
  };
  const guest = createGuestStore({ kv });
  assert.equal(await guest.save(data()), false);
  fail = false;
  const p = guest.save(data());
  await guest.flush();
  assert.equal(await p, true);
  assert.equal((await guest.load()).decks.length, 1);
  await guest.clear();
  assert.deepEqual(inner.dump(), {});
  assert.deepEqual(await guest.load(), { decks: [] });
});

test("IDs: Gast mit rows.newId, ohne rows ein Notbehelf; Cloud-Store nutzt rows.newId", () => {
  const rows = memoryRows();
  assert.equal(createGuestStore({ kv: memoryKv(), rows }).newId(), "id000001");
  const id = createGuestStore({ kv: memoryKv() }).newId();
  assert.ok(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,35}$/.test(id));
  assert.equal(createCloudStore({ $id: "u" }, { kv: memoryKv(), rows, tableIds: testTableIds }, fast()).newId(), "id000002");
});

/* ---------- Konto: Reihenfolge, Rechte, getrennte Konten ---------- */

test("Konto: Stapel zuerst, dann Karten; Rechte nur für den Besitzer; Löschen: Karten vor Stapel", async () => {
  const rows = memoryRows();
  const store = createCloudStore({ $id: "u1" }, { kv: memoryKv(), rows, tableIds: testTableIds }, fast());
  await store.load();
  const d = data();
  await store.save(d);
  await store.flush();
  assert.deepEqual(rows.log, ["create:decks:d1", "create:cards:c1", "create:cards:c2"]);
  assert.deepEqual(rowsOf(rows, "cards").get("c1")?.$permissions, rows.ownerPermissions("u1"));
  assert.deepEqual(rowsOf(rows, "decks").get("d1")?.$permissions, rows.ownerPermissions("u1"));
  assert.equal(rowsOf(rows, "decks").get("d1")?.userId, "u1");
  assert.equal(rowsOf(rows, "cards").get("c2")?.deckId, "d1");

  rows.log.length = 0;
  d.decks[0].name = "Englisch 2";
  d.decks[0].mode = "all";
  await store.save(d);
  await store.flush();
  assert.deepEqual(rows.log, ["update:decks:d1"], "Stapel umbenennen ändert nur die Stapel-Zeile");

  rows.log.length = 0;
  await store.save({ decks: [] });
  await store.flush();
  assert.deepEqual(rows.log.slice(0, 2).sort(), ["delete:cards:c1", "delete:cards:c2"]);
  assert.equal(rows.log[2], "delete:decks:d1");
});

test("Konto: ungeänderter Stand schreibt nichts; Karte in anderen Stapel verschieben aktualisiert deckId", async () => {
  const rows = memoryRows();
  const store = createCloudStore({ $id: "u1" }, { kv: memoryKv(), rows, tableIds: testTableIds }, fast());
  await store.load();
  const d = data();
  d.decks.push({ id: "d2", name: "Zweiter", mode: "all", cards: [] });
  await store.save(d);
  await store.flush();
  rows.log.length = 0;
  await store.save(d);
  await store.flush();
  assert.deepEqual(rows.log, []);
  const [moved] = d.decks[0].cards.splice(1, 1);
  d.decks[1].cards.push(moved);
  await store.save(d);
  await store.flush();
  assert.deepEqual(rows.log, ["update:cards:c2"]);
  assert.equal(rowsOf(rows, "cards").get("c2")?.deckId, "d2");
});

test("Getrennte Konten sehen getrennte Daten; Gast bleibt getrennt von beiden", async () => {
  const rows = memoryRows();
  const kv = memoryKv();
  const deps = { kv, rows, tableIds: testTableIds };
  const a = createCloudStore({ $id: "userA" }, deps, fast());
  const b = createCloudStore({ $id: "userB" }, deps, fast());
  await a.load(); await b.load();
  await a.save(data());
  await a.flush();
  const dB: KarteikartenData = { decks: [{ id: "dB", name: "Nur B", mode: "all", cards: [{ id: "cB", front: "x", back: "y", level: 1 }] }] };
  await b.save(dB);
  await b.flush();
  assert.deepEqual((await createCloudStore({ $id: "userA" }, deps, fast()).load()).decks.map((d) => d.id), ["d1"]);
  assert.deepEqual((await createCloudStore({ $id: "userB" }, deps, fast()).load()).decks.map((d) => d.id), ["dB"]);
  assert.deepEqual(await createCloudStore({ $id: "userC" }, deps, fast()).load(), { decks: [] });
  assert.equal(rowsOf(rows, "cards").get("cB")?.userId, "userB");
  assert.deepEqual(kv.dump(), {}, "Konto-Speichern schreibt nichts in den Gast-Speicher");
  await createGuestStore({ kv }).save(data());
  assert.equal(rowsOf(rows, "decks").size, 2, "Gast-Speichern schreibt nichts ins Konto");
  assert.equal((await createCloudStore({ $id: "userA" }, deps, fast()).load()).decks.length, 1);
});

test("Konto: load wirft Fehler weiter; Karte ohne Stapel wird nicht angezeigt und beim Speichern entfernt", async () => {
  const rows = memoryRows();
  const deps = { kv: memoryKv(), rows, tableIds: testTableIds };
  rows.failNext("listAllRows", { code: 503 });
  await assert.rejects(() => createCloudStore({ $id: "u1" }, deps, fast()).load());

  await rows.createRow({ tableId: "cards", rowId: "waise", data: { userId: "u1", deckId: "weg", front: "a", back: "b", level: 1 }, permissions: [] });
  await rows.createRow({ tableId: "decks", rowId: "d9", data: { userId: "u1", name: "Neun", mode: "level" }, permissions: [] });
  const store = createCloudStore({ $id: "u1" }, deps, fast());
  const loaded = await store.load();
  assert.deepEqual(loaded, { decks: [{ id: "d9", name: "Neun", mode: "level", cards: [] }] });
  await store.save(loaded);
  await store.flush();
  assert.equal(rowsOf(rows, "cards").has("waise"), false);
});

/* ---------- Konto: Fehler ---------- */

test("Teilfehler: eine Karte scheitert, die andere ist gespeichert; erneutes Speichern ergänzt ohne Doppelte", async () => {
  const rows = memoryRows();
  const statuses: SaveStatus[] = [];
  const errors: unknown[] = [];
  const store = createCloudStore({ $id: "u1" }, { kv: memoryKv(), rows, tableIds: testTableIds, onStatus: (s, e) => { statuses.push(s); if (e) errors.push(e); } }, fast());
  await store.load();
  const d: KarteikartenData = { decks: [{ id: "d1", name: "Englisch", mode: "level", cards: [] }] };
  await store.save(d);
  await store.flush();
  d.decks[0].cards.push({ id: "c1", front: "Hund", back: "dog", level: 1 }, { id: "c2", front: "Katze", back: "cat", level: 1 });
  rows.failNext("createRow", { code: 400 }); // kein Serverfehler, wird nicht wiederholt
  await store.save(d);
  await store.flush();
  await wait();
  assert.equal(statuses.at(-1), "error");
  assert.equal(errors.length, 1);
  assert.equal(rowsOf(rows, "cards").size, 1, "genau eine der beiden Karten kam an");
  await store.flush(); // zweiter Versuch (im Betrieb: nach 8 s von selbst)
  assert.equal(statuses.at(-1), "saved");
  assert.deepEqual([...rowsOf(rows, "cards").keys()].sort(), ["c1", "c2"]);
  assert.equal(rows.log.filter((l) => l.startsWith("create:cards:")).length, 2, "keine Karte doppelt angelegt");
});

test("Serverfehler 500 wird wiederholt und gelingt; dauerhafter Fehler meldet error und der nächste Versuch klappt", async () => {
  const rows = memoryRows();
  const statuses: SaveStatus[] = [];
  const store = createCloudStore({ $id: "u1" }, { kv: memoryKv(), rows, tableIds: testTableIds, onStatus: (s) => statuses.push(s) }, fast());
  await store.load();
  const d = data();
  await store.save(d);
  await store.flush();

  d.decks[0].cards[0].level = 3;
  rows.failNext("updateRow", { code: 500 }); // einmal 500 → der Limiter wiederholt
  await store.save(d);
  await store.flush();
  assert.equal(statuses.at(-1), "saved");
  assert.equal(rowsOf(rows, "cards").get("c1")?.level, 3);
  assert.equal(rows.log.filter((l) => l === "update:cards:c1").length, 1);

  d.decks[0].cards[0].level = 4;
  rows.failNext("updateRow", { code: 500 }, 3); // alle drei Versuche scheitern
  await store.save(d);
  await store.flush();
  assert.equal(statuses.at(-1), "error");
  assert.equal(rowsOf(rows, "cards").get("c1")?.level, 3, "noch nicht im Konto");
  await store.flush();
  assert.equal(statuses.at(-1), "saved");
  assert.equal(rowsOf(rows, "cards").get("c1")?.level, 4);
});

test("Anlegen: 409 (Zeile gibt es schon) und Löschen: 404 (ist schon weg) gelten als Erfolg", async () => {
  const rows = memoryRows();
  const statuses: SaveStatus[] = [];
  const store = createCloudStore({ $id: "u1" }, { kv: memoryKv(), rows, tableIds: testTableIds, onStatus: (s) => statuses.push(s) }, fast());
  await store.load();
  await rows.createRow({ tableId: "decks", rowId: "d1", data: { userId: "u1", name: "Englisch", mode: "level" }, permissions: [] });
  const d = data();
  await store.save(d);
  await store.flush();
  assert.equal(statuses.at(-1), "saved");
  rowsOf(rows, "cards").delete("c2"); // anderswo gelöscht
  await store.save({ decks: [{ ...d.decks[0], cards: [d.decks[0].cards[0]] }] });
  await store.flush();
  assert.equal(statuses.at(-1), "saved");
});

test("Sammelpause: mehrere save-Aufrufe ergeben einen Schreibvorgang; Status saving → saved", async () => {
  const rows = memoryRows();
  const statuses: SaveStatus[] = [];
  const store = createCloudStore({ $id: "u1" }, { kv: memoryKv(), rows, tableIds: testTableIds, onStatus: (s) => statuses.push(s) }, { ...fast(), syncDelayMs: 20 });
  await store.load();
  const d = data();
  await store.save(d);
  d.decks[0].cards[0].front = "Hunde";
  await store.save(d);
  assert.equal(rows.log.length, 0, "noch nichts geschrieben");
  await wait(80);
  assert.equal(rowsOf(rows, "cards").get("c1")?.front, "Hunde");
  assert.deepEqual(statuses, ["saving", "saving", "saving", "saved"]);
});

test("load speichert Ausstehendes zuerst, statt es zu verwerfen", async () => {
  const rows = memoryRows();
  const store = createCloudStore({ $id: "u1" }, { kv: memoryKv(), rows, tableIds: testTableIds }, { ...fast(), syncDelayMs: 10_000 });
  await store.load();
  await store.save(data());
  const loaded = await store.load();
  assert.equal(loaded.decks[0].cards.length, 2);
});
