/* Tests für den Planer-Speicher (neu, kein Web-Pendant; Web-Quelle der Logik: tools/planer/store.js, Web-Commit 770dbe4). */
import test from "node:test";
import assert from "node:assert/strict";
import { createGuestStore, createCloudStore, clean, cleanItem, GUEST_KEY } from "../store";
import { MAX_ITEMS, type PlanData, type PlanItem } from "../core";
import { memoryKv, memoryRows, testTableIds } from "../../shared/testing";
import type { SaveStatus, StoreDeps } from "../../shared/ports";

const item = (id: string, extra: Partial<PlanItem> = {}): PlanItem =>
  ({ id, kind: "task", title: "Aufgabe " + id, subject: "Mathe", date: "2026-11-20", note: "", done: false, deckId: "", ...extra });

function deps(kv = memoryKv(), rows = memoryRows()) {
  const statuses: SaveStatus[] = [];
  const errors: unknown[] = [];
  const d: StoreDeps = { kv, rows, tableIds: testTableIds, onStatus: (s, e) => { statuses.push(s); if (s === "error") errors.push(e); } };
  return { d, kv, rows, statuses, errors };
}
const user = (id: string) => ({ $id: id });
const tbl = (rows: ReturnType<typeof memoryRows>) => rows.tables.get("planner") ?? new Map();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------- clean ---------- */

test("clean: normalisiert Einträge wie im Web", () => {
  const c = cleanItem({ id: "x".repeat(50), kind: "was", title: "  ", subject: "  Mathe  ", date: "2026-02-31", note: "n".repeat(600), done: 1, deckId: "d".repeat(50) });
  assert.equal(c.id.length, 36);
  assert.equal(c.kind, "task");
  assert.equal(c.title, "Ohne Titel");
  assert.equal(c.subject, "Mathe");
  assert.equal(c.date, "");
  assert.equal(c.note.length, 500);
  assert.equal(c.done, true);
  assert.equal(c.deckId.length, 36);
  // Klausuren sind nie „erledigt“, Datum bleibt, wenn gültig
  assert.deepEqual(cleanItem({ id: "e", kind: "exam", title: "Test", date: "2026-11-25", done: true }), { id: "e", kind: "exam", title: "Test", subject: "", date: "2026-11-25", note: "", done: false, deckId: "" });
  // fehlende ID wird ergänzt
  assert.ok(cleanItem({ title: "x" }).id.length > 0);
  assert.equal(cleanItem({ title: "x" }, () => "fest").id, "fest");
});

test("clean: kaputte Daten und Obergrenze", () => {
  assert.deepEqual(clean(null), { items: [] });
  assert.deepEqual(clean("text"), { items: [] });
  assert.deepEqual(clean({ items: "nein" }), { items: [] });
  assert.equal(clean({ items: [null, 5, "x", {}] }).items.length, 4);
  assert.equal(clean({ items: Array.from({ length: MAX_ITEMS + 50 }, (_, i) => item("i" + i)) }).items.length, MAX_ITEMS);
});

/* ---------- Gast ---------- */

test("Gast: speichern, neu laden, leeren", async () => {
  const { d, kv } = deps();
  const a = createGuestStore(d);
  assert.equal(a.kind, "guest");
  assert.deepEqual(await a.load(), { items: [] });
  const data: PlanData = { items: [item("a"), item("b", { kind: "exam", date: "2026-12-01", deckId: "d1" })] };
  assert.equal(await a.save(data), true);
  const b = createGuestStore(d); // „App neu gestartet“
  assert.deepEqual(await b.load(), data);
  await b.clear();
  assert.equal(await kv.getItem(GUEST_KEY), null);
  assert.deepEqual(await b.load(), { items: [] });
});

test("Gast: Schlüssel bleibt wie im Web", () => {
  assert.equal(GUEST_KEY, "pensum.planer.v1");
});

test("Gast: die zuletzt gespeicherte Liste gewinnt, auch ohne await und bei langsamem Speicher", async () => {
  const inner = memoryKv();
  const slow = {
    getItem: (k: string) => inner.getItem(k),
    setItem: async (k: string, v: string) => { await sleep(Math.random() * 8); return inner.setItem(k, v); },
    removeItem: (k: string) => inner.removeItem(k),
  };
  const s = createGuestStore({ kv: slow });
  const data: PlanData = { items: [] };
  const saves: Promise<boolean>[] = [];
  for (let i = 0; i < 20; i++) {
    data.items.push(item("i" + i));   // die Oberfläche verändert dieselbe Liste weiter …
    saves.push(s.save(data));         // … und speichert nach jeder Änderung, ohne zu warten
  }
  assert.deepEqual(await Promise.all(saves), Array(20).fill(true));
  const loaded = await createGuestStore({ kv: slow }).load();
  assert.equal(loaded.items.length, 20, "letzter Stand, nichts überholt");
});

test("Gast: save hält den Stand zum Aufrufzeitpunkt fest", async () => {
  const { d } = deps();
  const s = createGuestStore(d);
  const data: PlanData = { items: [item("a")] };
  const p = s.save(data);
  data.items[0]!.title = "danach geändert";
  data.items.push(item("b"));
  await p;
  const loaded = await s.load();
  assert.equal(loaded.items.length, 1);
  assert.equal(loaded.items[0]?.title, "Aufgabe a");
});

test("Gast: kaputte gespeicherte Daten starten leer", async () => {
  for (const raw of ["{kaputt", "null", "[]", '{"items":5}']) {
    const s = createGuestStore({ kv: memoryKv({ [GUEST_KEY]: raw }) });
    assert.deepEqual(await s.load(), { items: [] }, raw);
  }
});

test("Gast: verweigert der Speicher das Schreiben, liefert save false und meldet den Fehler", async () => {
  const kv = { getItem: async () => null, setItem: async () => { throw new Error("voll"); }, removeItem: async () => {} };
  const errors: unknown[] = [];
  const s = createGuestStore({ kv, onStatus: (st, e) => { if (st === "error") errors.push(e); } });
  assert.equal(await s.save({ items: [item("a")] }), false);
  assert.equal(errors.length, 1);
  assert.equal(await s.save({ items: [] }), false); // Warteschlange läuft weiter
});

test("Gast: newId liefert eindeutige IDs bis 36 Zeichen", () => {
  const s = createGuestStore(deps().d);
  const ids = new Set(Array.from({ length: 100 }, () => s.newId()));
  assert.equal(ids.size, 100);
  for (const id of ids) assert.ok(id.length <= 36);
});

/* ---------- Konto ---------- */

test("Konto: nur Unterschiede werden geschrieben (anlegen, ändern, löschen)", async () => {
  const { d, rows, statuses } = deps();
  const s = createCloudStore(d, user("u1"));
  assert.equal(s.kind, "cloud");
  assert.equal(s.userId, "u1");
  const a = s.newId(), b = s.newId();
  const data: PlanData = { items: [item(a), item(b, { kind: "exam", subject: "", date: "", deckId: "d1" })] };
  assert.equal(await s.save(data), true);
  assert.equal(rows.log.length, 0, "erst nach 600 ms bzw. flush");
  await s.flush();
  assert.deepEqual(rows.log.sort(), [`create:planner:${a}`, `create:planner:${b}`].sort());
  const row = tbl(rows).get(a)!;
  assert.equal(row.userId, "u1");
  assert.deepEqual(row.$permissions, rows.ownerPermissions("u1"));
  assert.equal(row.title, "Aufgabe " + a);
  assert.equal(tbl(rows).get(b)!.subject, null, "leere Texte als null");
  assert.equal(tbl(rows).get(b)!.date, null);
  assert.equal(tbl(rows).get(b)!.deckId, "d1");
  assert.ok(!("id" in row));
  assert.equal(statuses[statuses.length - 1], "saved");

  // nichts geändert → nichts geschrieben
  rows.log.length = 0;
  await s.save(data);
  await s.flush();
  assert.deepEqual(rows.log, []);

  // nur a geändert → ein Update; b gelöscht → ein Delete
  data.items[0]!.done = true;
  data.items.splice(1, 1);
  await s.save(data);
  await s.flush();
  assert.deepEqual(rows.log.sort(), [`delete:planner:${b}`, `update:planner:${a}`].sort());
  assert.equal(tbl(rows).get(a)!.done, true);
  assert.equal(tbl(rows).has(b), false);
});

test("Konto: Änderungen werden gesammelt – ein save pro Tipp, ein Schreibvorgang", async () => {
  const { d, rows } = deps();
  const s = createCloudStore(d, user("u1"));
  const a = s.newId();
  const data: PlanData = { items: [item(a, { title: "A" })] };
  for (const t of ["A", "A1", "A12", "A123"]) { data.items[0]!.title = t; await s.save(data); }
  await sleep(900); // 600 ms Sammeln laufen von selbst ab
  assert.deepEqual(rows.log, [`create:planner:${a}`]);
  assert.equal(tbl(rows).get(a)!.title, "A123");
  s.dispose();
});

test("Konto: save kopiert – spätere Änderungen an der Liste ändern den vorgemerkten Stand nicht", async () => {
  const { d, rows } = deps();
  const s = createCloudStore(d, user("u1"));
  const a = s.newId();
  const data: PlanData = { items: [item(a, { title: "vorher" })] };
  await s.save(data);
  data.items[0]!.title = "nachher (nicht gespeichert)";
  await s.flush();
  assert.equal(tbl(rows).get(a)!.title, "vorher");
});

test("Konto: load liefert die eigenen Einträge, getrennte Konten sehen getrennte Daten", async () => {
  const { d, rows, kv } = deps();
  const s1 = createCloudStore(d, user("u1"));
  const s2 = createCloudStore(d, user("u2"));
  const a = s1.newId(), b = s2.newId();
  await s1.save({ items: [item(a, { title: "Eins" })] }); await s1.flush();
  await s2.save({ items: [item(b, { title: "Zwei" })] }); await s2.flush();
  assert.deepEqual((await s1.load()).items.map((i) => i.title), ["Eins"]);
  assert.deepEqual((await s2.load()).items.map((i) => i.title), ["Zwei"]);
  assert.deepEqual(kv.dump(), {}, "nichts im Gastspeicher");
  assert.equal(tbl(rows).size, 2);
});

test("Konto: nach load vergleicht save mit dem geladenen Stand (kein erneutes Anlegen)", async () => {
  const { d, rows } = deps();
  const first = createCloudStore(d, user("u1"));
  const a = first.newId();
  await first.save({ items: [item(a, { subject: "" })] }); await first.flush();
  rows.log.length = 0;

  const second = createCloudStore(d, user("u1")); // App neu gestartet
  const loaded = await second.load();
  assert.equal(loaded.items.length, 1);
  assert.deepEqual(loaded.items[0], item(a, { subject: "" }));
  await second.save(loaded); await second.flush();
  assert.deepEqual(rows.log, [], "unverändert → keine Schreibzugriffe");
  loaded.items[0].note = "neu";
  await second.save(loaded); await second.flush();
  assert.deepEqual(rows.log, [`update:planner:${a}`]);
});

test("Konto: Serverfehler 500 wird wiederholt, 409 beim Anlegen gilt als Erfolg, 404 beim Löschen auch", async () => {
  const { d, rows, errors } = deps();
  const s = createCloudStore(d, user("u1"));
  const a = s.newId();
  rows.failNext("createRow", { code: 500 });
  await s.save({ items: [item(a)] });
  await s.flush(); // 1. Versuch scheitert, nach 1,5 s klappt der 2.
  assert.equal(tbl(rows).has(a), true);
  assert.equal(errors.length, 0);

  // Zeile gibt es serverseitig schon (409) bzw. nicht mehr (404)
  const s2 = createCloudStore(d, user("u1"));
  await s2.save({ items: [item(a)] }); // s2 kennt die Zeile nicht → create → 409 → ok
  await s2.flush();
  assert.equal(errors.length, 0);
  tbl(rows).delete(a);
  await s2.save({ items: [] }); // delete einer schon fehlenden Zeile
  await s2.flush();
  assert.equal(errors.length, 0);
});

test("Konto: Client-Fehler (400) wird gemeldet; erneuter Versuch beim nächsten flush holt es nach", async () => {
  const { d, rows, errors } = deps();
  const s = createCloudStore(d, user("u1"));
  const a = s.newId();
  rows.failNext("createRow", { code: 400 });
  await s.save({ items: [item(a)] });
  await s.flush();
  assert.equal(errors.length, 1);
  assert.equal(tbl(rows).has(a), false);
  await s.flush(); // zweiter Versuch (im Betrieb: automatisch nach 8 s)
  assert.equal(tbl(rows).has(a), true);
  s.dispose();
});

test("Konto: Teilfehler – erfolgreiche Zeilen bleiben vermerkt, nur der Rest wird wiederholt", async () => {
  const { d, rows } = deps();
  const s = createCloudStore(d, user("u1"));
  const [a, b, c] = [s.newId(), s.newId(), s.newId()];
  rows.failNext("createRow", { code: 400 }); // trifft genau einen der drei Anlege-Aufrufe
  await s.save({ items: [item(a), item(b), item(c)] });
  await s.flush();
  await sleep(20); // die beiden anderen Aufrufe laufen nach dem Fehler noch zu Ende
  assert.equal(tbl(rows).size, 2);
  rows.log.length = 0;
  await s.flush();
  assert.equal(tbl(rows).size, 3);
  assert.equal(rows.log.length, 1, "nur die fehlende Zeile wurde nachgeholt");
  s.dispose();
});

test("Konto: Statusfolge saving → saved", async () => {
  const { d, statuses } = deps();
  const s = createCloudStore(d, user("u1"));
  await s.save({ items: [item(s.newId())] });
  assert.deepEqual(statuses, ["saving"]);
  await s.flush();
  assert.equal(statuses[statuses.length - 1], "saved");
});

test("Konto: flush ohne ausstehende Änderungen tut nichts", async () => {
  const { d, rows } = deps();
  const s = createCloudStore(d, user("u1"));
  await s.flush();
  assert.deepEqual(rows.log, []);
});
