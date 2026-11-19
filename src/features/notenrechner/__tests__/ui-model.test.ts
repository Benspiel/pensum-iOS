/* Tests für ui-model.ts (Web-Quelle der Logik: tools/notenrechner/notenrechner.js, Web-Commit 770dbe4). */
import test from "node:test";
import assert from "node:assert/strict";
import {
  viewFromPrefs, prefsFromView, markUnsaved, planRemoveSubject, removeSubjectPrompt, cleanSubjectName, importPending,
  shouldSeedDefaults, importPromptText, importDoneText, summarize, interpretGradeInput, convertInput,
} from "../ui-model";
import type { GradeRec, View } from "../model";
import type { Subject } from "../core";

const NOW = new Date(2026, 10, 11);
const view: View = { system: "note", schoolYear: "2026/27", half: 1 };
const sub = (id: string, name = id, schoolYear = "2026/27"): Subject => ({ id, name, schoolYear });
const gr = (id: string, subjectId: string, value: number, extra: Partial<GradeRec> = {}): GradeRec =>
  ({ id, subjectId, label: "", value, system: "note", weight: 1, half: 1, saved: true, ...extra });

test("Konto-Ansicht: Einstellungen lesen und schreiben", () => {
  assert.equal(viewFromPrefs({}, NOW), null);
  assert.equal(viewFromPrefs(null, NOW), null);
  assert.equal(viewFromPrefs({ other: 1 }, NOW), null);
  assert.deepEqual(viewFromPrefs({ nrSystem: "punkte", nrYear: "2025/26", nrHalf: "2" }, NOW), { system: "punkte", schoolYear: "2025/26", half: 2 });
  // kaputte Einzelwerte fallen auf den Standard
  assert.deepEqual(viewFromPrefs({ nrSystem: "punkte", nrYear: "x", nrHalf: "0" }, NOW), { system: "punkte", schoolYear: "2026/27", half: 1 });
  assert.deepEqual(prefsFromView({ system: "punkte", schoolYear: "2025/26", half: 2 }), { nrSystem: "punkte", nrYear: "2025/26", nrHalf: "2" });
  const round = viewFromPrefs(prefsFromView(view), NOW);
  assert.deepEqual(round, view);
});

test("markUnsaved und planRemoveSubject", () => {
  const grades = [gr("1", "a", 2), gr("2", "a", 3, { half: 2, saved: false }), gr("3", "b", 1)];
  assert.deepEqual(markUnsaved(grades, "1").map((g) => g.saved), [false, false, true]);
  assert.equal(grades[0]?.saved, true, "Eingabe unverändert");
  const r = planRemoveSubject([sub("a"), sub("b")], grades, "a");
  assert.deepEqual(r.subjects.map((s) => s.id), ["b"]);
  assert.deepEqual(r.grades.map((g) => g.id), ["3"]);
  assert.equal(r.gradeCount, 2);
  assert.deepEqual(r.savedGradeIds, ["1"], "nicht gespeicherte Noten werden nicht beim Speicher gelöscht");
  assert.equal(planRemoveSubject([sub("a")], [], "a").gradeCount, 0);
});

test("Texte: Rückfrage beim Löschen und Übernahme", () => {
  assert.deepEqual(removeSubjectPrompt("Mathe", 1), { title: "„Mathe“ löschen?", text: "Die Note dieses Fachs wird mit gelöscht. Das lässt sich nicht rückgängig machen.", confirm: "Fach löschen" });
  assert.equal(removeSubjectPrompt("Mathe", 3).text, "Alle 3 Noten dieses Fachs werden mit gelöscht. Das lässt sich nicht rückgängig machen.");
  assert.equal(importPromptText(1, 1), "Auf diesem Gerät liegt 1 Fach mit 1 Note aus dem Gast-Modus. Sollen sie in dein Konto übernommen werden? Sonst bleiben sie getrennt auf diesem Gerät.");
  assert.equal(importPromptText(12, 0), "Auf diesem Gerät liegen 12 Fächer mit 0 Noten aus dem Gast-Modus. Sollen sie in dein Konto übernommen werden? Sonst bleiben sie getrennt auf diesem Gerät.");
  assert.equal(importDoneText({ subjects: 1, grades: 1 }), "1 Fach und 1 Note in dein Konto übernommen.");
  assert.equal(importDoneText({ subjects: 12, grades: 5 }), "12 Fächer und 5 Noten in dein Konto übernommen.");
});

test("cleanSubjectName", () => {
  assert.equal(cleanSubjectName("  Mathe "), "Mathe");
  assert.equal(cleanSubjectName("   "), null);
  assert.equal(cleanSubjectName(""), null);
});

test("Standardfächer: nur einmal, nicht bei offener Übernahme, nicht beim Laden", () => {
  assert.equal(importPending(null, 5, []), false, "Gast");
  assert.equal(importPending("u1", 0, []), false, "keine lokalen Fächer");
  assert.equal(importPending("u1", 3, []), true);
  assert.equal(importPending("u1", 3, ["u1"]), false, "abgelehnt");
  assert.equal(importPending("u1", 3, ["u2"]), true);
  const base = { loading: false, visibleCount: 0, seeded: [] as string[], key: "guest|2026/27", importPending: false };
  assert.equal(shouldSeedDefaults(base), true);
  assert.equal(shouldSeedDefaults({ ...base, loading: true }), false);
  assert.equal(shouldSeedDefaults({ ...base, visibleCount: 1 }), false);
  assert.equal(shouldSeedDefaults({ ...base, seeded: ["guest|2026/27"] }), false);
  assert.equal(shouldSeedDefaults({ ...base, seeded: ["guest|2025/26"] }), true);
  assert.equal(shouldSeedDefaults({ ...base, importPending: true }), false);
});

test("summarize: Zeugnisdurchschnitt, Info-Text, leer", () => {
  const subs = [sub("a"), sub("b"), sub("c"), sub("x", "x", "2025/26")];
  assert.deepEqual(summarize(subs, [], view), { average: null, valueText: "–", info: "Trag bei deinen Fächern die Zeugnisnote ein." });
  const s = summarize(subs, [gr("1", "a", 2), gr("2", "b", 3), gr("3", "x", 1)], view);
  assert.equal(s.average, 2.5);
  assert.equal(s.valueText, "2,50");
  assert.equal(s.info, "≙ 9,5 Punkte · Mittel aus 2 von 3 Fächern · 1. Halbjahr");
  const one = summarize([sub("a")], [gr("1", "a", 2)], { ...view, half: 2 });
  assert.equal(one.average, null, "Noten eines anderen Halbjahres zählen nicht");
  const p = summarize([sub("a")], [gr("1", "a", 11, { system: "punkte", half: 2 })], { system: "punkte", schoolYear: "2026/27", half: 2 });
  assert.equal(p.valueText, "11,00");
  assert.equal(p.info, "≙ Note 2,00 · Mittel aus 1 von 1 Fach · 2. Halbjahr");
});

test("interpretGradeInput", () => {
  assert.deepEqual(interpretGradeInput("2,5", "note"), { kind: "set", value: 2.5 });
  assert.deepEqual(interpretGradeInput("  ", "note"), { kind: "clear" });
  assert.deepEqual(interpretGradeInput("7", "note"), { kind: "error", error: "Note zwischen 1 und 6 eingeben, z. B. 2 oder 2,3." });
  assert.deepEqual(interpretGradeInput("16", "punkte"), { kind: "error", error: "Punkte zwischen 0 und 15 eingeben." });
  assert.equal(interpretGradeInput("2+", "note").kind, "set");
});

test("convertInput: Umrechner Note ↔ Punkte", () => {
  assert.deepEqual(convertInput("2", "note"), { invalid: false, other: "11" });
  assert.deepEqual(convertInput("2,5", "note"), { invalid: false, other: "9,5" });
  assert.deepEqual(convertInput("10", "punkte"), { invalid: false, other: "2,33" });
  assert.deepEqual(convertInput("", "note"), { invalid: false, other: "" });
  assert.deepEqual(convertInput("abc", "note"), { invalid: true, other: "" });
  assert.deepEqual(convertInput("20", "punkte"), { invalid: true, other: "" });
});
