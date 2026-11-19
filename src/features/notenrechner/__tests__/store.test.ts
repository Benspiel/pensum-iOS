/* Tests für den Notenrechner-Speicher (neu, kein Web-Pendant; Web-Quelle der Logik: tools/notenrechner/store.js, Web-Commit 770dbe4). */
import test from "node:test";
import assert from "node:assert/strict";
import { createGuestStore, createCloudStore, importGuestData, newGuestId, GUEST_KEY, type NotenData } from "../store";
import { memoryKv, memoryRows, testTableIds } from "../../shared/testing";
import type { SaveStatus, StoreDeps } from "../../shared/ports";

const subject = (id: string, name = "Mathe") => ({ id, name, schoolYear: "2026/27" });
const grade = (id: string, subjectId: string, value = 2, extra: Record<string, unknown> = {}) =>
  ({ id, subjectId, label: "Klausur", value, system: "note" as const, weight: 2, half: 1 as const, ...extra });

function deps(kv = memoryKv(), rows = memoryRows()) {
  const statuses: SaveStatus[] = [];
  const d: StoreDeps = { kv, rows, tableIds: testTableIds, onStatus: (s) => { statuses.push(s); } };
  return { d, kv, rows, statuses };
}

/* ---------- Gast ---------- */

test("Gast: speichern, neu laden, entfernen", async () => {
  const { d, kv } = deps();
  const a = createGuestStore(d);
  assert.equal(a.kind, "guest");
  assert.deepEqual(await a.load(), { subjects: [], grades: [] });
  await a.addSubject(subject("s1"));
  await a.addGrade(grade("g1", "s1", 2));
  await a.updateGrade("g1", { value: 3, label: "Test" });
  await a.updateSubject("s1", { name: "Mathematik" });
  // zweite Instanz über denselben Speicher = „App neu gestartet“
  const b = createGuestStore(d);
  const data = await b.load();
  assert.deepEqual(data.subjects, [subject("s1", "Mathematik")]);
  assert.deepEqual(data.grades, [grade("g1", "s1", 3, { label: "Test" })]);
  await b.removeGrade("g1");
  assert.equal((await b.load()).grades.length, 0);
  assert.ok(await kv.getItem(GUEST_KEY));
  await b.clear();
  assert.equal(await kv.getItem(GUEST_KEY), null);
  assert.deepEqual(await b.load(), { subjects: [], grades: [] });
});

test("Gast: Schlüssel bleibt wie im Web", () => {
  assert.equal(GUEST_KEY, "pensum.notenrechner.guest.v1");
});

test("Gast: Fach löschen löscht seine Noten, andere bleiben", async () => {
  const { d } = deps();
  const s = createGuestStore(d);
  await s.addSubject(subject("s1"));
  await s.addSubject(subject("s2", "Deutsch"));
  await s.addGrade(grade("g1", "s1"));
  await s.addGrade(grade("g2", "s1"));
  await s.addGrade(grade("g3", "s2"));
  await s.removeSubject("s1");
  const data = await s.load();
  assert.deepEqual(data.subjects.map((x) => x.id), ["s2"]);
  assert.deepEqual(data.grades.map((x) => x.id), ["g3"]);
});

test("Gast: schnelle Aufrufe ohne await gehen nicht verloren (serialisiert)", async () => {
  const { d } = deps();
  const s = createGuestStore(d);
  const jobs: Promise<void>[] = [];
  jobs.push(s.addSubject(subject("s1")));
  for (let i = 0; i < 25; i++) jobs.push(s.addGrade(grade("g" + i, "s1", 2, { label: "n" + i })));
  jobs.push(s.updateGrade("g3", { value: 5 }));
  jobs.push(s.removeGrade("g4"));
  await Promise.all(jobs);
  const data = await createGuestStore(d).load();
  assert.equal(data.grades.length, 24);
  assert.equal(data.grades.find((g) => g.id === "g3")?.value, 5);
  assert.ok(!data.grades.some((g) => g.id === "g4"));
  assert.equal(data.grades[0]?.id, "g0"); // Reihenfolge bleibt erhalten
});

test("Gast: auch bei langsamem Speicher bleibt die Reihenfolge und nichts geht verloren", async () => {
  const inner = memoryKv();
  const slow = {
    getItem: async (k: string) => { await new Promise((r) => setTimeout(r, Math.random() * 5)); return inner.getItem(k); },
    setItem: async (k: string, v: string) => { await new Promise((r) => setTimeout(r, Math.random() * 5)); return inner.setItem(k, v); },
    removeItem: (k: string) => inner.removeItem(k),
  };
  const s = createGuestStore({ kv: slow });
  await Promise.all([s.addSubject(subject("s1")), ...Array.from({ length: 15 }, (_, i) => s.addGrade(grade("g" + i, "s1")))]);
  assert.deepEqual((await s.load()).grades.map((g) => g.id), Array.from({ length: 15 }, (_, i) => "g" + i));
});

test("Gast: load wartet auf vorher gestartete Schreibzugriffe", async () => {
  const { d } = deps();
  const s = createGuestStore(d);
  void s.addSubject(subject("s1"));
  const data = await s.load();
  assert.equal(data.subjects.length, 1);
});

test("Gast: kaputte oder fremdartige Daten starten leer; Eingaben werden bereinigt", async () => {
  for (const raw of ["{kaputt", "null", '{"subjects":1,"grades":[]}', "[]"]) {
    const s = createGuestStore({ kv: memoryKv({ [GUEST_KEY]: raw }) });
    assert.deepEqual(await s.load(), { subjects: [], grades: [] }, raw);
  }
  const { d } = deps();
  const s = createGuestStore(d);
  await s.addSubject({ id: "s1", name: "x".repeat(300), schoolYear: "2026/27" });
  await s.addGrade({ id: "g1", subjectId: "s1", value: 2, weight: 1, system: "irgendwas" as never, half: 7 as never });
  const data = await s.load();
  assert.equal(data.subjects[0]?.name.length, 120);
  assert.equal(data.grades[0]?.system, "note");
  assert.equal(data.grades[0]?.half, 1);
  assert.equal(data.grades[0]?.label, "");
});

test("Gast: Schreibfehler des Speichers bricht nicht ab, wird gemeldet, nächste Schreibzugriffe laufen weiter", async () => {
  const inner = memoryKv();
  let fail = true;
  const kv = { ...inner, setItem: async (k: string, v: string) => { if (fail) throw new Error("voll"); return inner.setItem(k, v); } };
  const errors: unknown[] = [];
  const s = createGuestStore({ kv, onStatus: (st, e) => { if (st === "error") errors.push(e); } });
  await s.addSubject(subject("s1")); // wirft nicht
  assert.equal(errors.length, 1);
  fail = false;
  await s.addSubject(subject("s2"));
  assert.deepEqual((await s.load()).subjects.map((x) => x.id), ["s2"]);
});

test("newGuestId: eindeutig, höchstens 36 Zeichen, Fallback ohne crypto.randomUUID", () => {
  const ids = new Set(Array.from({ length: 200 }, () => newGuestId()));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.ok(id.length > 0 && id.length <= 36, id);
  const g = globalThis as { crypto?: unknown };
  const saved = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true, writable: true });
    const fb = new Set(Array.from({ length: 200 }, () => newGuestId()));
    assert.equal(fb.size, 200);
    for (const id of fb) assert.ok(id.length > 0 && id.length <= 36, id);
  } finally {
    if (saved) Object.defineProperty(globalThis, "crypto", saved); else delete g.crypto;
  }
});

/* ---------- Konto ---------- */

const user = (id: string) => ({ $id: id });

test("Konto: anlegen, ändern (gesammelt), löschen", async () => {
  const { d, rows, statuses } = deps();
  const s = createCloudStore(d, user("u1"));
  assert.equal(s.kind, "cloud");
  assert.equal(s.userId, "u1");
  const sid = s.newId();
  await s.addSubject({ id: sid, name: "Mathe", schoolYear: "2026/27" });
  const gid = s.newId();
  await s.addGrade(grade(gid, sid, 2));
  const row = rows.tables.get("subjects")!.get(sid)!;
  assert.equal(row.userId, "u1");
  assert.equal(row.name, "Mathe");
  assert.ok(!("id" in row));
  assert.deepEqual(row.$permissions, rows.ownerPermissions("u1"));
  assert.equal(rows.tables.get("grades")!.get(gid)!.subjectId, sid);

  // mehrere Änderungen derselben Zeile werden zu einem einzigen Update zusammengefasst
  await s.updateGrade(gid, { value: 3 });
  await s.updateGrade(gid, { label: "Test" });
  assert.equal(s.isIdle(), false);
  assert.equal(rows.log.filter((l) => l.startsWith("update:")).length, 0, "noch nicht geschrieben (600-ms-Sammeln)");
  await s.flush();
  assert.deepEqual(rows.log.filter((l) => l.startsWith("update:")), [`update:grades:${gid}`]);
  assert.equal(rows.tables.get("grades")!.get(gid)!.value, 3);
  assert.equal(rows.tables.get("grades")!.get(gid)!.label, "Test");
  assert.equal(s.isIdle(), true);
  assert.equal(statuses[statuses.length - 1], "saved");

  const data = await s.load();
  assert.deepEqual(data.subjects, [{ id: sid, name: "Mathe", schoolYear: "2026/27" }]);
  assert.deepEqual(data.grades, [{ id: gid, subjectId: sid, label: "Test", value: 3, system: "note", weight: 2, half: 1 }]);

  await s.removeGrade(gid);
  assert.equal((await s.load()).grades.length, 0);
  await s.removeSubject(sid);
  assert.equal((await s.load()).subjects.length, 0);
});

test("Konto: Änderung nach 600 ms wird ohne flush geschrieben", async () => {
  const { d, rows } = deps();
  const s = createCloudStore(d, user("u1"));
  const sid = s.newId();
  await s.addSubject({ id: sid, name: "Mathe", schoolYear: "2026/27" });
  await s.updateSubject(sid, { name: "Mathematik" });
  assert.equal(rows.tables.get("subjects")!.get(sid)!.name, "Mathe");
  await new Promise((r) => setTimeout(r, 900));
  assert.equal(rows.tables.get("subjects")!.get(sid)!.name, "Mathematik");
  await s.flush();
});

test("Konto: Fach löschen entfernt die übergebenen Noten mit", async () => {
  const { d, rows } = deps();
  const s = createCloudStore(d, user("u1"));
  const sid = s.newId();
  await s.addSubject({ id: sid, name: "Mathe", schoolYear: "2026/27" });
  const g1 = s.newId(), g2 = s.newId();
  await s.addGrade(grade(g1, sid));
  await s.addGrade(grade(g2, sid));
  await s.removeSubject(sid, [g1, g2]);
  const data = await s.load();
  assert.deepEqual(data, { subjects: [], grades: [] });
  assert.equal(rows.tables.get("grades")!.size, 0);
});

test("Konto: ausstehende Änderung wird beim Löschen verworfen, Löschen einer fehlenden Zeile (404) ist kein Fehler", async () => {
  const { d, rows } = deps();
  const s = createCloudStore(d, user("u1"));
  const sid = s.newId();
  await s.addSubject({ id: sid, name: "Mathe", schoolYear: "2026/27" });
  await s.updateSubject(sid, { name: "Weg" });
  await s.removeSubject(sid);
  await s.flush();
  assert.equal(rows.log.filter((l) => l.startsWith("update:")).length, 0);
  await s.removeGrade("gibt-es-nicht"); // 404 → ok
  assert.equal(s.isIdle(), true);
});

test("Konto: getrennte Konten sehen getrennte Daten, Gast bleibt außen vor", async () => {
  const { d, rows, kv } = deps();
  const a = createCloudStore(d, user("u1"));
  const b = createCloudStore(d, user("u2"));
  const sa = a.newId(), sb = b.newId();
  await a.addSubject({ id: sa, name: "A-Mathe", schoolYear: "2026/27" });
  await b.addSubject({ id: sb, name: "B-Mathe", schoolYear: "2026/27" });
  await a.addGrade(grade(a.newId(), sa));
  assert.deepEqual((await a.load()).subjects.map((x) => x.name), ["A-Mathe"]);
  assert.deepEqual((await b.load()).subjects.map((x) => x.name), ["B-Mathe"]);
  assert.equal((await b.load()).grades.length, 0);
  assert.equal(rows.tables.get("subjects")!.get(sa)!.userId, "u1");
  assert.deepEqual(kv.dump(), {}, "Konto-Daten landen nicht im Gastspeicher");
});

test("Konto: Serverfehler 500 wird wiederholt, 409 beim Anlegen gilt als Erfolg", async () => {
  const { d, rows } = deps();
  const s = createCloudStore(d, user("u1"));
  const sid = s.newId();
  rows.failNext("createRow", { code: 500 });
  await s.addSubject({ id: sid, name: "Mathe", schoolYear: "2026/27" }); // 1. Versuch scheitert, nach 1,5 s klappt der 2.
  assert.equal(rows.tables.get("subjects")!.get(sid)!.name, "Mathe");
  // 409: Zeile existiert schon (erster Versuch kam doch an) → kein Fehler
  await s.addSubject({ id: sid, name: "Mathe", schoolYear: "2026/27" });
  assert.equal(rows.tables.get("subjects")!.size, 1);
});

test("Konto: Client-Fehler (400) wird gemeldet und weitergereicht", async () => {
  const { d, rows, statuses } = deps();
  const s = createCloudStore(d, user("u1"));
  rows.failNext("createRow", { code: 400, message: "ungültig" });
  await assert.rejects(() => s.addSubject({ id: s.newId(), name: "Mathe", schoolYear: "2026/27" }), { code: 400 });
  assert.ok(statuses.includes("error"));
  assert.equal(s.isIdle(), true);
});

test("Konto: Änderungen an einer Zeile laufen in Reihenfolge (Anlegen vor Ändern vor Löschen)", async () => {
  const { d, rows } = deps();
  const s = createCloudStore(d, user("u1"));
  const sid = s.newId();
  void s.addSubject({ id: sid, name: "Mathe", schoolYear: "2026/27" });
  await s.updateSubject(sid, { name: "Mathematik" });
  await s.flush();
  assert.deepEqual(rows.log, [`create:subjects:${sid}`, `update:subjects:${sid}`]);
  assert.equal(rows.tables.get("subjects")!.get(sid)!.name, "Mathematik");
});

/* ---------- Import ---------- */

const guestData = (): NotenData => ({
  subjects: [subject("gs1"), subject("gs2", "Deutsch")],
  grades: [
    grade("gg1", "gs1", 2), grade("gg2", "gs1", 3), grade("gg3", "gs2", 1),
    grade("gg4", "gs2", NaN),           // ungültiger Wert: wird nicht übernommen
    grade("gg5", "unbekannt", 2),       // Note ohne Fach: wird nicht übernommen
    grade("gg6", "gs2", 4, { weight: Infinity }),
  ],
});

test("Import: Gastdaten bekommen neue IDs, Zuordnung Fach → Noten bleibt", async () => {
  const { d, rows } = deps();
  const cloud = createCloudStore(d, user("u1"));
  const result = await importGuestData(cloud, guestData());
  assert.deepEqual(result, { subjects: 2, grades: 3 });
  const data = await cloud.load();
  assert.equal(data.subjects.length, 2);
  assert.equal(data.grades.length, 3);
  assert.ok(!data.subjects.some((s) => s.id.startsWith("gs")));
  const math = data.subjects.find((s) => s.name === "Mathe")!;
  const ger = data.subjects.find((s) => s.name === "Deutsch")!;
  assert.deepEqual(data.grades.filter((g) => g.subjectId === math.id).map((g) => g.value).sort(), [2, 3]);
  assert.deepEqual(data.grades.filter((g) => g.subjectId === ger.id).map((g) => g.value), [1]);
  assert.equal(rows.tables.get("grades")!.size, 3);
});

test("Import: Wiederholung legt (wie im Web) neue Kopien an, ändert aber die erste Übernahme nicht", async () => {
  const { d } = deps();
  const cloud = createCloudStore(d, user("u1"));
  await importGuestData(cloud, guestData());
  const first = await cloud.load();
  await importGuestData(cloud, guestData());
  const second = await cloud.load();
  assert.equal(second.subjects.length, 4);
  assert.equal(second.grades.length, 6);
  assert.deepEqual(second.subjects.slice(0, 2), first.subjects);
  assert.equal(new Set(second.subjects.map((s) => s.id)).size, 4);
});

test("Import: Teilfehler → Fehler wird gemeldet; erneuter Import nach dem Fehler klappt vollständig", async () => {
  const { d, rows } = deps();
  const cloud = createCloudStore(d, user("u1"));
  rows.failNext("createRow", { code: 400 }); // das erste Fach scheitert
  await assert.rejects(() => importGuestData(cloud, guestData()), { code: 400 });
  assert.equal(rows.tables.get("subjects")?.size ?? 0, 0);
  assert.equal(rows.tables.get("grades")?.size ?? 0, 0);

  // Fehler mittendrin: erstes Fach geht durch, die zweite Anlage (Fach 2) scheitert
  const cloud2 = createCloudStore(d, user("u2"));
  let calls = 0;
  const orig = rows.createRow;
  rows.createRow = async (a) => { if (++calls === 2) throw { code: 400 }; return orig(a); };
  await assert.rejects(() => importGuestData(cloud2, guestData()), { code: 400 });
  assert.equal((await cloud2.load()).subjects.length, 1); // das erste Fach blieb stehen
  assert.equal((await cloud2.load()).grades.length, 0);   // Noten werden erst nach den Fächern angelegt
  rows.createRow = orig;
  const ok = await importGuestData(cloud2, guestData());
  assert.deepEqual(ok, { subjects: 2, grades: 3 });
  assert.equal((await cloud2.load()).grades.length, 3);
});

test("Import: Serverfehler 500 mittendrin wird wiederholt, nichts fehlt", async () => {
  const { d, rows } = deps();
  const cloud = createCloudStore(d, user("u1"));
  rows.failNext("createRow", { code: 500 });
  const result = await importGuestData(cloud, guestData());
  assert.deepEqual(result, { subjects: 2, grades: 3 });
  assert.equal((await cloud.load()).grades.length, 3);
});
