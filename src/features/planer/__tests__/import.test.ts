/* Tests für die Übernahme von Gast-Einträgen ins Konto (neu; Web-Quelle der Regel: tools/planer/planer.js offerImport, Web-Commit 770dbe4). */
import test from "node:test";
import assert from "node:assert/strict";
import { importGuestItems } from "../import";
import { createCloudStore, createGuestStore, GUEST_KEY } from "../store";
import { MAX_ITEMS, type PlanItem } from "../core";
import { freshGuestItems, importKey, planGuestImport } from "../model";
import { memoryKv, memoryRows, testTableIds } from "../../shared/testing";
import type { StoreDeps } from "../../shared/ports";

const item = (id: string, extra: Partial<PlanItem> = {}): PlanItem =>
  ({ id, kind: "task", title: "Aufgabe " + id, subject: "Mathe", date: "2026-11-20", note: "", done: false, deckId: "d-gast", ...extra });
const setup = () => {
  const kv = memoryKv(), rows = memoryRows();
  const d: StoreDeps = { kv, rows, tableIds: testTableIds };
  const cloud = createCloudStore(d, { $id: "u1" });
  const guest = createGuestStore({ kv });
  const table = () => [...(rows.tables.get("planner")?.values() ?? [])];
  return { kv, rows, cloud, guest, table };
};

/* ---------- reine Planung (model.ts) ---------- */

test("freshGuestItems/planGuestImport: gleich = Art + Titel + Datum + Fach (ohne Rand-Leerzeichen)", () => {
  const current = [item("c1", { title: "Lesen", subject: "Deutsch", date: "" })];
  const guest = [
    item("g1", { title: " Lesen ", subject: "Deutsch ", date: "" }), // gleich
    item("g2", { title: "Lesen", subject: "Deutsch", date: "", kind: "exam" }), // andere Art
    item("g3", { title: "Lesen", subject: "Englisch", date: "" }), // anderes Fach
    item("g4", { title: "Lesen", subject: "Deutsch", date: "2026-12-01" }), // anderes Datum
  ];
  assert.deepEqual(freshGuestItems(current, guest).map((i) => i.id), ["g2", "g3", "g4"]);
  let n = 0;
  const plan = planGuestImport(current, guest, () => "neu" + ++n);
  assert.equal(plan.taken, 3);
  assert.equal(plan.skipped, 1);
  assert.equal(plan.complete, true);
  assert.deepEqual(plan.items.map((i) => i.id), ["c1", "neu1", "neu2", "neu3"]);
  assert.ok(plan.items.slice(1).every((i) => i.deckId === ""), "Stapel-Verknüpfung entfällt");
  assert.notEqual(importKey(guest[0] as PlanItem), importKey(guest[1] as PlanItem));
});

test("planGuestImport: nicht alles passt → complete = false", () => {
  const current = Array.from({ length: MAX_ITEMS - 1 }, (_, i) => item("c" + i, { title: "T" + i }));
  const plan = planGuestImport(current, [item("g1", { title: "A" }), item("g2", { title: "B" })], () => "x");
  assert.equal(plan.taken, 1);
  assert.equal(plan.complete, false);
});

/* ---------- Ablauf (import.ts) ---------- */

test("Übernahme: Erfolg – Konto hat die Einträge, danach sind die Gast-Daten gelöscht", async () => {
  const { kv, cloud, guest, table } = setup();
  await guest.save({ items: [item("g1"), item("g2", { title: "Zweite" })] });
  const local = (await guest.load()).items;
  const r = await importGuestItems({ cloud, guest, current: [], local, commit: (items) => { void cloud.save({ items }); } });
  assert.deepEqual(r, { status: "done", taken: 2, skipped: 0 });
  assert.equal(table().length, 2);
  assert.ok(table().every((row) => row.userId === "u1" && row.deckId === null));
  assert.equal(kv.dump()[GUEST_KEY], undefined, "Gast-Daten gelöscht");
  cloud.dispose();
});

test("Übernahme: Teilfehler – Gast-Daten bleiben lokal", async () => {
  const { kv, rows, cloud, guest, table } = setup();
  await guest.save({ items: [item("g1"), item("g2", { title: "Zweite" }), item("g3", { title: "Dritte" })] });
  const local = (await guest.load()).items;
  rows.failNext("createRow", { code: 400 }); // eine von drei Zeilen scheitert
  const r = await importGuestItems({ cloud, guest, current: [], local, commit: (items) => { void cloud.save({ items }); } });
  assert.equal(r.status, "failed");
  assert.equal(table().length, 2);
  assert.ok(kv.dump()[GUEST_KEY], "Gast-Daten sind noch da");
  assert.equal((await guest.load()).items.length, 3);
  cloud.dispose();
});

test("Übernahme: Wiederholung nach Teilfehler erzeugt keine Duplikate", async () => {
  const { kv, rows, cloud, guest, table } = setup();
  await guest.save({ items: [item("g1"), item("g2", { title: "Zweite" }), item("g3", { title: "Dritte" })] });
  let local = (await guest.load()).items;
  rows.failNext("createRow", { code: 400 });
  let current: PlanItem[] = [];
  const commit = (items: PlanItem[]) => { current = items; void cloud.save({ items }); };
  assert.equal((await importGuestItems({ cloud, guest, current, local, commit })).status, "failed");
  cloud.dispose();

  // App neu gestartet: neuer Konto-Speicher lädt, was angekommen ist (2 von 3)
  const cloud2 = createCloudStore({ kv, rows, tableIds: testTableIds }, { $id: "u1" });
  current = (await cloud2.load()).items;
  assert.equal(current.length, 2);
  local = (await guest.load()).items;
  const commit2 = (items: PlanItem[]) => { current = items; void cloud2.save({ items }); };
  const r = await importGuestItems({ cloud: cloud2, guest, current, local, commit: commit2 });
  assert.deepEqual(r, { status: "done", taken: 1, skipped: 2 });
  assert.equal(table().length, 3, "genau drei, keine Duplikate");
  assert.equal(new Set(table().map((row) => row.title)).size, 3);
  assert.equal(kv.dump()[GUEST_KEY], undefined);
  cloud2.dispose();
});

test("Übernahme: war schon alles im Konto → Gast-Daten werden ohne neue Einträge gelöscht", async () => {
  const { kv, cloud, guest, table } = setup();
  await guest.save({ items: [item("g1")] });
  const local = (await guest.load()).items;
  const current = [item("c1", { title: "Aufgabe g1", deckId: "" })]; // gleiche Art, Titel, Datum, Fach
  const r = await importGuestItems({ cloud, guest, current, local, commit: () => assert.fail("nichts zu speichern") });
  assert.deepEqual(r, { status: "nothing" });
  assert.equal(table().length, 0);
  assert.equal(kv.dump()[GUEST_KEY], undefined);
  cloud.dispose();
});

test("Übernahme: Konto voll → Rest bleibt lokal", async () => {
  const { kv, cloud, guest } = setup();
  await guest.save({ items: [item("g1", { title: "A" }), item("g2", { title: "B" })] });
  const local = (await guest.load()).items;
  const current = Array.from({ length: MAX_ITEMS - 1 }, (_, i) => item("c" + i, { title: "T" + i, deckId: "" }));
  const r = await importGuestItems({ cloud, guest, current, local, commit: (items) => { void cloud.save({ items }); } });
  assert.deepEqual(r, { status: "no-room", taken: 1 });
  assert.ok(kv.dump()[GUEST_KEY], "Gast-Daten bleiben");
  cloud.dispose();
});
