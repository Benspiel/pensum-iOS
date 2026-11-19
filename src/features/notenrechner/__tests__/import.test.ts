/* Tests für die Übernahme der Gast-Daten ins Konto (planGuestImport, importGuestSafe). */
import test from "node:test";
import assert from "node:assert/strict";
import { createCloudStore, createGuestStore, GUEST_KEY, type NotenData } from "../store";
import { importGuestSafe } from "../import";
import { planGuestImport, importResultText } from "../ui-model";
import type { Grade, Subject } from "../core";
import { memoryKv, memoryRows, testTableIds } from "../../shared/testing";
import type { StoreDeps } from "../../shared/ports";

const sub = (id: string, name: string, schoolYear = "2026/27"): Subject => ({ id, name, schoolYear });
const gr = (id: string, subjectId: string, value: number, half: 1 | 2 = 1, extra: Partial<Grade> = {}): Grade =>
  ({ id, subjectId, label: "", value, system: "note", weight: 1, half, ...extra });
const ids = () => { let n = 0; return () => "n" + ++n; };

const guestData = (): NotenData => ({
  subjects: [sub("g1", "Mathe"), sub("g2", "Deutsch")],
  grades: [gr("a", "g1", 2), gr("b", "g1", 3, 2), gr("c", "g2", 1), gr("d", "g2", NaN), gr("e", "unbekannt", 2)],
});

/* ---------- reine Planung ---------- */

test("planGuestImport: leeres Konto → alles neu, ungültige Noten entfallen", () => {
  const p = planGuestImport(guestData(), { subjects: [], grades: [] }, ids());
  assert.deepEqual(p.subjects.map((s) => s.name), ["Mathe", "Deutsch"]);
  assert.equal(p.grades.length, 3);
  assert.equal(p.mergedSubjects, 0);
  assert.equal(p.skippedGrades, 0);
  const math = p.subjects.find((s) => s.name === "Mathe");
  assert.deepEqual(p.grades.filter((g) => g.subjectId === math?.id).map((g) => g.half).sort(), [1, 2]);
  assert.ok(p.grades.every((g) => g.id.startsWith("n") && !["a", "b", "c"].includes(g.id)));
});

test("planGuestImport: Fächer gleichen Namens im selben Schuljahr werden zusammengeführt (Groß/Klein, Leerzeichen egal)", () => {
  const cloud = { subjects: [sub("c1", "mathe")], grades: [] };
  const guest: NotenData = { subjects: [sub("g1", " Mathe "), sub("g2", "Mathe", "2025/26"), sub("g3", "MATHE ")], grades: [gr("a", "g1", 2), gr("b", "g2", 3)] };
  const p = planGuestImport(guest, cloud, ids());
  assert.deepEqual(p.subjects.map((s) => [s.name, s.schoolYear]), [["Mathe", "2025/26"]], "anderes Schuljahr ist ein anderes Fach");
  assert.equal(p.mergedSubjects, 2);
  assert.equal(p.grades.find((g) => g.value === 2)?.subjectId, "c1", "Note landet auf dem vorhandenen Fach");
});

test("planGuestImport: Gast-Fächer gleichen Namens untereinander ergeben ein Fach", () => {
  const guest: NotenData = { subjects: [sub("g1", "Kunst"), sub("g2", "kunst")], grades: [gr("a", "g1", 2), gr("b", "g2", 4), gr("c", "g2", 1, 2)] };
  const p = planGuestImport(guest, { subjects: [], grades: [] }, ids());
  assert.equal(p.subjects.length, 1);
  assert.equal(p.mergedSubjects, 1);
  // je Fach und Halbjahr nur eine Note: Halbjahr 1 vom ersten Gast-Fach, Halbjahr 2 vom zweiten
  assert.deepEqual(p.grades.map((g) => [g.half, g.value]), [[1, 2], [2, 1]]);
  assert.equal(p.skippedGrades, 1);
});

test("planGuestImport: Note je Fach und Halbjahr nicht doppelt – das Konto gewinnt", () => {
  const cloud = { subjects: [sub("c1", "Mathe")], grades: [gr("x", "c1", 5, 1)] };
  const p = planGuestImport(guestData(), cloud, ids());
  assert.equal(p.grades.some((g) => g.subjectId === "c1" && g.half === 1), false);
  assert.equal(p.grades.some((g) => g.subjectId === "c1" && g.half === 2), true, "anderes Halbjahr kommt dazu");
  assert.equal(p.skippedGrades, 1);
});

test("planGuestImport: mehrere Altnoten im selben Fach und Halbjahr bleiben erhalten (wie im Web)", () => {
  const guest: NotenData = { subjects: [sub("g1", "Mathe")], grades: [gr("a", "g1", 2), gr("b", "g1", 4, 1, { weight: 2 })] };
  assert.equal(planGuestImport(guest, { subjects: [], grades: [] }, ids()).grades.length, 2);
});

test("planGuestImport verändert die Eingaben nicht; Meldungstext", () => {
  const g = guestData();
  const snapshot = JSON.stringify(g);
  planGuestImport(g, { subjects: [], grades: [] }, ids());
  assert.equal(JSON.stringify(g), snapshot);
  assert.equal(importResultText({ subjects: 2, grades: 3 }), "2 Fächer und 3 Noten in dein Konto übernommen.");
  assert.equal(importResultText({ subjects: 0, grades: 0 }), "Die lokalen Daten waren schon in deinem Konto.");
});

/* ---------- Übernahme gegen den Testspeicher ---------- */

const setup = () => {
  const rows = memoryRows();
  const kv = memoryKv();
  const deps: StoreDeps = { kv, rows, tableIds: testTableIds };
  return { rows, kv, deps, cloud: createCloudStore(deps, { $id: "u1" }) };
};
const snapshotOf = async (cloud: ReturnType<typeof setup>["cloud"]) => {
  const d = await cloud.load();
  return { subjects: d.subjects.map((s) => s.name).sort(), grades: d.grades.length };
};

test("Übernahme: Erfolg – alles im Konto, Zuordnung bleibt, Zahlen stimmen", async () => {
  const { cloud } = setup();
  const r = await importGuestSafe(cloud, guestData());
  assert.deepEqual(r, { subjects: 2, grades: 3, merged: 0, skipped: 0 });
  const d = await cloud.load();
  assert.equal(d.subjects.length, 2);
  const math = d.subjects.find((s) => s.name === "Mathe");
  assert.deepEqual(d.grades.filter((g) => g.subjectId === math?.id).map((g) => g.value).sort(), [2, 3]);
  assert.equal(cloud.isIdle(), true);
});

test("Übernahme: Wiederholung nach vollständigem Erfolg erzeugt keine Duplikate", async () => {
  const { cloud } = setup();
  await importGuestSafe(cloud, guestData());
  const again = await importGuestSafe(cloud, guestData());
  assert.deepEqual(again, { subjects: 0, grades: 0, merged: 2, skipped: 3 });
  assert.deepEqual(await snapshotOf(cloud), { subjects: ["Deutsch", "Mathe"], grades: 3 });
});

test("Übernahme: Teilfehler beim Anlegen eines Fachs → Fehler, Gastdaten bleiben, Wiederholung ergänzt ohne Duplikate", async () => {
  const { cloud, rows, kv, deps } = setup();
  const guest = createGuestStore(deps);
  await guest.addSubject(sub("g1", "Mathe")); await guest.addSubject(sub("g2", "Deutsch"));
  await guest.addGrade(gr("a", "g1", 2)); await guest.addGrade(gr("c", "g2", 1));
  const local = await guest.load();

  let calls = 0;
  const orig = rows.createRow;
  rows.createRow = async (a) => { if (++calls === 2) throw { code: 400 }; return orig(a); }; // zweites Fach scheitert
  await assert.rejects(() => importGuestSafe(cloud, local), { code: 400 });
  assert.ok(await kv.getItem(GUEST_KEY), "Gastdaten sind unberührt (der Aufrufer löscht erst nach Erfolg)");
  assert.deepEqual(await snapshotOf(cloud), { subjects: ["Mathe"], grades: 0 });

  rows.createRow = orig;
  const r = await importGuestSafe(cloud, local);
  assert.deepEqual({ s: r.subjects, g: r.grades, m: r.merged }, { s: 1, g: 2, m: 1 });
  assert.deepEqual(await snapshotOf(cloud), { subjects: ["Deutsch", "Mathe"], grades: 2 });
  await cloud.flushOrThrow(); // frühere Fehler stehen der Abmeldung nicht mehr im Weg
});

test("Übernahme: Teilfehler bei den Noten (ein Stapel) → Wiederholung legt nur Fehlendes an", async () => {
  const { cloud, rows } = setup();
  const subjects = Array.from({ length: 8 }, (_, i) => sub("g" + i, "Fach" + i));
  const grades = subjects.map((s, i) => gr("n" + i, s.id, 2 + (i % 3)));
  const data: NotenData = { subjects, grades };

  let gradeCalls = 0;
  const orig = rows.createRow;
  rows.createRow = async (a) => {
    if (a.tableId === "grades" && ++gradeCalls === 3) throw { code: 400 };
    return orig(a);
  };
  await assert.rejects(() => importGuestSafe(cloud, data), { code: 400 });
  const partial = (await cloud.load()).grades.length;
  assert.ok(partial >= 1 && partial < 8, `teilweise übernommen (${partial})`);

  rows.createRow = orig;
  await importGuestSafe(cloud, data);
  const d = await cloud.load();
  assert.equal(d.subjects.length, 8);
  assert.equal(d.grades.length, 8, "keine Note doppelt, keine fehlt");
  assert.equal(new Set(d.grades.map((g) => g.subjectId)).size, 8);
  await cloud.flushOrThrow();
});

test("Übernahme: Serverfehler 500 wird wiederholt, Ergebnis vollständig", async () => {
  const { cloud, rows } = setup();
  rows.failNext("createRow", { code: 500 });
  const r = await importGuestSafe(cloud, guestData());
  assert.equal(r.subjects, 2);
  assert.deepEqual(await snapshotOf(cloud), { subjects: ["Deutsch", "Mathe"], grades: 3 });
});

test("Übernahme: bestehende Konto-Fächer werden zusammengeführt", async () => {
  const { cloud } = setup();
  await cloud.addSubject(sub("c1", "mathe"));
  const r = await importGuestSafe(cloud, guestData());
  assert.deepEqual({ s: r.subjects, m: r.merged }, { s: 1, m: 1 });
  const d = await cloud.load();
  assert.deepEqual(d.subjects.map((s) => s.name).sort(), ["Deutsch", "mathe"]);
  assert.equal(d.grades.filter((g) => g.subjectId === "c1").length, 2);
});
