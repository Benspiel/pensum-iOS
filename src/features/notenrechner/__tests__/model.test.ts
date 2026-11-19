/* Tests für Modell und Einstellungen der Notenrechner-Oberfläche (Web-Quelle der Logik: notenrechner.js, Web-Commit 770dbe4). */
import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeView, defaultView, visibleSubjects, gradesOf, gradeValue, planSetGrade, planSeed, missingSuggestions,
  checkNewSubjectName, subjectValues, type GradeRec, type View,
} from "../model";
import { loadView, saveView, VIEW_KEY, isSeeded, markSeeded, seedKey, isDeclined, markDeclined, SEEDED_KEY } from "../prefs";
import { DEFAULT_SUBJECTS, type Subject } from "../core";
import { memoryKv } from "../../shared/testing";

const NOW = new Date(2026, 10, 11); // 11.11.2026 → 2026/27, 1. Halbjahr
const view: View = { system: "note", schoolYear: "2026/27", half: 1 };
const sub = (id: string, name = id, schoolYear = "2026/27"): Subject => ({ id, name, schoolYear });
const gr = (id: string, subjectId: string, value: number, extra: Partial<GradeRec> = {}): GradeRec =>
  ({ id, subjectId, label: "", value, system: "note", weight: 1, half: 1, saved: true, ...extra });
const ids = () => { let n = 0; return () => "n" + ++n; };

test("sanitizeView: Standard, Altwerte, Müll", () => {
  assert.deepEqual(defaultView(NOW), { system: "note", schoolYear: "2026/27", half: 1 });
  assert.deepEqual(sanitizeView(null, NOW), defaultView(NOW));
  assert.deepEqual(sanitizeView("x", NOW), defaultView(NOW));
  assert.deepEqual(sanitizeView({ system: "punkte", schoolYear: "2025/26", half: 2 }, NOW), { system: "punkte", schoolYear: "2025/26", half: 2 });
  assert.deepEqual(sanitizeView({ system: "punkte", schoolYear: "2025/26", half: "2" }, NOW).half, 2);
  assert.equal(sanitizeView({ half: 0 }, NOW).half, 1, "früheres „ganzes Schuljahr“");
  assert.equal(sanitizeView({ system: "toString" }, NOW).system, "note");
  assert.equal(sanitizeView({ schoolYear: "2025-26" }, NOW).schoolYear, "2026/27");
});

test("visibleSubjects und gradesOf filtern nach Schuljahr, Halbjahr und gültigem Wert", () => {
  const subs = [sub("a"), sub("b", "b", "2025/26")];
  assert.deepEqual(visibleSubjects(subs, view).map((s) => s.id), ["a"]);
  const grades = [gr("1", "a", 2), gr("2", "a", 3, { half: 2 }), gr("3", "a", NaN), gr("4", "b", 1)];
  assert.deepEqual(gradesOf(grades, "a", view).map((g) => g.id), ["1"]);
});

test("gradeValue: eine Note wird umgerechnet, mehrere gewichtet gemittelt", () => {
  assert.equal(gradeValue([gr("1", "a", 3)], "a", view), 3);
  assert.equal(gradeValue([gr("1", "a", 11, { system: "punkte" })], "a", view), 2);
  assert.equal(gradeValue([gr("1", "a", 3)], "a", { ...view, system: "punkte" }), 8);
  assert.equal(gradeValue([gr("1", "a", 2, { weight: 2 }), gr("2", "a", 5, { weight: 1 })], "a", view), 3);
  assert.equal(gradeValue([], "a", view), null);
});

test("planSetGrade: neue Note wird angelegt, vorhandene geändert, leer entfernt", () => {
  const newId = ids();
  let r = planSetGrade([], "a", 2, view, newId);
  assert.equal(r.grades.length, 1);
  assert.deepEqual(r.effects.map((e) => e.kind), ["add"]);
  assert.equal(r.grades[0]?.id, "n1");
  assert.equal(r.grades[0]?.weight, 1);
  assert.equal(r.grades[0]?.half, 1);

  r = planSetGrade(r.grades, "a", 3, { ...view, system: "punkte" }, newId);
  assert.equal(r.grades.length, 1);
  assert.deepEqual(r.effects, [{ kind: "update", id: "n1", data: { label: "", value: 3, system: "punkte", weight: 1, half: 1 } }]);
  assert.equal(r.grades[0]?.system, "punkte");

  r = planSetGrade(r.grades, "a", null, { ...view, system: "punkte" }, newId);
  assert.equal(r.grades.length, 0);
  assert.deepEqual(r.effects.map((e) => e.kind), ["remove"]);
  assert.deepEqual(planSetGrade([], "a", null, view, newId), { grades: [], effects: [] });
});

test("planSetGrade: Altlasten (mehrere Noten) werden auf eine reduziert, andere Halbjahre/Fächer bleiben", () => {
  const grades = [gr("1", "a", 2), gr("2", "a", 4), gr("3", "a", 1, { half: 2 }), gr("4", "b", 5)];
  const r = planSetGrade(grades, "a", 3, view, ids());
  assert.deepEqual(r.grades.map((g) => g.id), ["1", "3", "4"]);
  assert.deepEqual(r.effects.map((e) => e.kind), ["remove", "update"]);
  assert.equal(r.effects[0]?.kind === "remove" && r.effects[0].grade.id, "2");
  assert.equal(grades.length, 4, "Eingabe unverändert");
});

test("planSeed und missingSuggestions: nur fehlende Fächer, Groß/Klein egal", () => {
  const subs = [sub("1", "deutsch"), sub("2", "Mathematik"), sub("3", "Latein", "2025/26")];
  const seed = planSeed(subs, view, ids());
  assert.equal(seed.length, DEFAULT_SUBJECTS.length - 2);
  assert.ok(!seed.some((s) => s.name === "Deutsch"));
  assert.ok(seed.every((s) => s.schoolYear === "2026/27"));
  assert.equal(new Set(seed.map((s) => s.id)).size, seed.length);
  const miss = missingSuggestions(subs, view);
  assert.ok(!miss.includes("Deutsch") && miss.includes("Latein") && miss.includes("Englisch"));
  assert.equal(planSeed(planSeed([], view, ids()), view, ids()).length, 0);
});

test("checkNewSubjectName", () => {
  const subs = [sub("1", "Mathe"), sub("2", "Kunst", "2025/26")];
  assert.deepEqual(checkNewSubjectName("  ", subs, view), { ok: false, error: "Gib dem Fach einen Namen." });
  assert.deepEqual(checkNewSubjectName("mathe", subs, view), { ok: false, error: "„mathe“ gibt es im Schuljahr 2026/27 schon." });
  assert.deepEqual(checkNewSubjectName(" Kunst ", subs, view), { ok: true, name: "Kunst" });
});

test("subjectValues zählt Fächer mit Note", () => {
  const subs = [sub("a"), sub("b"), sub("c")];
  const r = subjectValues(subs, [gr("1", "a", 2), gr("2", "b", 3)], view);
  assert.deepEqual(r, { values: [2, 3], total: 3 });
});

test("Einstellungen über kv: Ansicht, seeded, declined", async () => {
  const kv = memoryKv();
  assert.deepEqual(await loadView(kv, NOW), defaultView(NOW));
  await saveView(kv, { system: "punkte", schoolYear: "2025/26", half: 2 });
  assert.deepEqual(await loadView(kv, NOW), { system: "punkte", schoolYear: "2025/26", half: 2 });
  assert.equal(VIEW_KEY, "pensum.notenrechner.view.v1");

  const k = seedKey(null, "2026/27");
  assert.equal(k, "guest|2026/27");
  assert.equal(await isSeeded(kv, k), false);
  await markSeeded(kv, k); await markSeeded(kv, k);
  assert.equal(await isSeeded(kv, k), true);
  assert.equal(await isSeeded(kv, seedKey("u1", "2026/27")), false);
  assert.deepEqual(JSON.parse((await kv.getItem(SEEDED_KEY)) as string), ["guest|2026/27"]);

  assert.equal(await isDeclined(kv, "u1"), false);
  await markDeclined(kv, "u1");
  assert.equal(await isDeclined(kv, "u1"), true);
  assert.equal(await isDeclined(kv, "u2"), false);
});

test("Einstellungen: kaputter Speicher und Schreibfehler stören nicht", async () => {
  const bad = memoryKv({ [VIEW_KEY]: "{kaputt", [SEEDED_KEY]: "5" });
  assert.deepEqual(await loadView(bad, NOW), defaultView(NOW));
  assert.equal(await isSeeded(bad, "x"), false);
  const broken = { getItem: async () => { throw new Error("x"); }, setItem: async () => { throw new Error("x"); }, removeItem: async () => {} };
  assert.deepEqual(await loadView(broken, NOW), defaultView(NOW));
  await saveView(broken, defaultView(NOW));
  await markDeclined(broken, "u");
  assert.equal(await isDeclined(broken, "u"), false);
});
