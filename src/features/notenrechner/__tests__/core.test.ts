/* Beispielrechnungen für den Notenrechner.
 * Web-Quelle: tests/notenrechner.test.mjs (Pensum, Web-Commit 770dbe4) – Fälle und erwartete Werte 1:1 übernommen,
 * dazu neue Tests für den robusten Zahlenformatierer. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  pointsToNote, noteToPoints, convert, parseGrade, parseWeight, weightedAverage, subjectAverage,
  overallAverage, requiredGrade, formatNumber, formatInput, schoolYearOf, halfOf, schoolYearOptions,
  zeugnisNote, zeugnisAverage, DEFAULT_SUBJECTS, formatOther, formatNumberManual, createNumberFormatter, toSystem,
} from "../core";

const near = (a: number | null, b: number, eps = 1e-9) => assert.ok(a !== null && Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const valueOf = (r: ReturnType<typeof parseGrade>) => (r.ok ? r.value : NaN);

test("gewichteter Durchschnitt: Klausur 2× und mündlich 1×", () => {
  // (2·2 + 3·1) / 3 = 2,33
  near(weightedAverage([{ value: 2, weight: 2 }, { value: 3, weight: 1 }]), 7 / 3);
  // Punkte: (12·2 + 9·1) / 3 = 11
  near(weightedAverage([{ value: 12, weight: 2 }, { value: 9, weight: 1 }]), 11);
  // Gewichtung 50 % / 30 % / 20 %
  near(weightedAverage([{ value: 1, weight: 50 }, { value: 3, weight: 30 }, { value: 4, weight: 20 }]), 2.2);
});

test("leere Fächer und Division durch 0 ergeben keinen Durchschnitt", () => {
  assert.equal(weightedAverage([]), null);
  assert.equal(weightedAverage(null), null);
  assert.equal(weightedAverage([{ value: 2, weight: 0 }]), null);
  assert.equal(subjectAverage([], "note"), null);
  assert.equal(overallAverage([]), null);
  assert.equal(overallAverage([null, null]), null);
});

test("ungültige Einträge werden übersprungen statt mitgerechnet", () => {
  near(weightedAverage([{ value: 2, weight: 1 }, { value: NaN, weight: 1 }, { value: 4, weight: -1 }, { value: 3, weight: Infinity }]), 2);
  near(weightedAverage([{ value: 2, weight: 1 }, { value: 1, weight: 0 }]), 2); // Gewicht 0 zählt nicht
});

test("Umrechnung Punkte → Note", () => {
  near(pointsToNote(15), 2 / 3);
  near(pointsToNote(14), 1);
  near(pointsToNote(11), 2);
  near(pointsToNote(8), 3);
  near(pointsToNote(5), 4);
  near(pointsToNote(2), 5);
  near(pointsToNote(1), 16 / 3);
  near(pointsToNote(0), 6);
});

test("Umrechnung Note → Punkte und zurück", () => {
  near(noteToPoints(1), 14);
  near(noteToPoints(2.5), 9.5);
  near(noteToPoints(4), 5);
  near(noteToPoints(6), 0);
  for (let p = 0; p <= 15; p += 0.5) near(noteToPoints(pointsToNote(p)), p, 1e-9);
  for (let n = 1; n <= 6; n += 0.1) near(pointsToNote(noteToPoints(n)), n, 1e-9);
  assert.equal(convert(3, "note", "note"), 3);
  assert.equal(convert(NaN, "note", "punkte"), null);
});

test("Eingaben prüfen: Noten 1–6", () => {
  assert.deepEqual(parseGrade("2", "note"), { ok: true, value: 2 });
  assert.deepEqual(parseGrade(" 2,5 ", "note"), { ok: true, value: 2.5 });
  assert.deepEqual(parseGrade("3.25", "note"), { ok: true, value: 3.25 });
  near(valueOf(parseGrade("2+", "note")), 5 / 3);
  near(valueOf(parseGrade("2-", "note")), 7 / 3);
  near(valueOf(parseGrade("1+", "note")), 2 / 3);
  assert.equal((parseGrade("", "note") as { empty?: boolean }).empty, true);
  for (const bad of ["0", "7", "6-", "abc", "-2", "2,,5", "1e3", "2 3"]) assert.equal(parseGrade(bad, "note").ok, false, bad);
});

test("Eingaben prüfen: Punkte 0–15 und Gewichtung", () => {
  assert.deepEqual(parseGrade("0", "punkte"), { ok: true, value: 0 });
  assert.deepEqual(parseGrade("15", "punkte"), { ok: true, value: 15 });
  for (const bad of ["16", "-1", "2+", "x"]) assert.equal(parseGrade(bad, "punkte").ok, false, bad);
  assert.deepEqual(parseWeight("2"), { ok: true, value: 2 });
  assert.deepEqual(parseWeight("2x"), { ok: true, value: 2 });
  assert.deepEqual(parseWeight("0,5"), { ok: true, value: 0.5 });
  assert.deepEqual(parseWeight("0"), { ok: true, value: 0 });
  for (const bad of ["-1", "101", "viel"]) assert.equal(parseWeight(bad).ok, false, bad);
  assert.equal((parseWeight("") as { empty?: boolean }).empty, true);
});

test("Fachdurchschnitt rechnet gemischte Systeme um", () => {
  // 11 Punkte = Note 2; zusammen mit einer 3 (gleich gewichtet) → 2,5
  near(subjectAverage([{ value: 11, system: "punkte", weight: 1 }, { value: 3, system: "note", weight: 1 }], "note"), 2.5);
  // dieselben Noten in Punkten: 11 und 8 → 9,5
  near(subjectAverage([{ value: 11, system: "punkte", weight: 1 }, { value: 3, system: "note", weight: 1 }], "punkte"), 9.5);
});

test("Gesamtdurchschnitt ist das Mittel der Fächer, leere Fächer zählen nicht", () => {
  near(overallAverage([2, 3, null, 1]), 2);
  near(overallAverage([11.5]), 11.5);
});

test("Zielnote in Noten: erreichbar", () => {
  // Bisher 3 (2×) und 2 (1×) → Schnitt 2,67. Ziel 2,5 mit einer Arbeit, die 2× zählt:
  // (2,5·5 − 8) / 2 = 2,25 → eintragbar ist höchstens eine 2,2
  const r = requiredGrade({ grades: [{ value: 3, weight: 2 }, { value: 2, weight: 1 }], target: 2.5, nextWeight: 2, system: "note" });
  assert.equal(r.status, "reachable");
  if (r.status !== "reachable") return;
  near(r.needed, 2.25);
  near(r.practical, 2.2);
  assert.ok((8 + r.practical * 2) / 5 <= 2.5);
});

test("Zielnote in Noten: unerreichbar und schon sicher", () => {
  const no = requiredGrade({ grades: [{ value: 5, weight: 1 }, { value: 5, weight: 1 }], target: 2, nextWeight: 1, system: "note" });
  assert.equal(no.status, "unreachable");
  if (no.status === "unreachable") near(no.bestCase, 11 / 3); // selbst mit einer 1: 3,67
  const yes = requiredGrade({ grades: [{ value: 1, weight: 3 }], target: 3, nextWeight: 1, system: "note" });
  assert.equal(yes.status, "guaranteed");
});

test("Zielnote in Punkten", () => {
  // Bisher 8 und 10 Punkte, Ziel 10 im Schnitt, nächste Arbeit zählt doppelt: (10·4 − 18) / 2 = 11
  const r = requiredGrade({ grades: [{ value: 8, weight: 1 }, { value: 10, weight: 1 }], target: 10, nextWeight: 2, system: "punkte" });
  assert.equal(r.status, "reachable");
  if (r.status === "reachable") near(r.practical, 11);
  // krumme Werte werden auf ganze Punkte aufgerundet: (9·3 − 17) / 1 = 10 → 10; (9,5·3 − 17) = 11,5 → 12
  const r2 = requiredGrade({ grades: [{ value: 8, weight: 1 }, { value: 9, weight: 1 }], target: 9.5, nextWeight: 1, system: "punkte" });
  assert.equal(r2.status, "reachable");
  if (r2.status === "reachable") near(r2.practical, 12);
  assert.equal(requiredGrade({ grades: [{ value: 2, weight: 4 }], target: 13, nextWeight: 1, system: "punkte" }).status, "unreachable");
  assert.equal(requiredGrade({ grades: [{ value: 15, weight: 4 }], target: 5, nextWeight: 1, system: "punkte" }).status, "guaranteed");
});

test("Zielnote ohne bisherige Noten und mit ungültigen Angaben", () => {
  const first = requiredGrade({ grades: [], target: 2, nextWeight: 1, system: "note" });
  assert.equal(first.status, "reachable");
  if (first.status === "reachable") near(first.practical, 2);
  assert.equal(requiredGrade({ grades: [], target: 2, nextWeight: 0, system: "note" }).status, "invalid");
  assert.equal(requiredGrade({ grades: [], target: 7, nextWeight: 1, system: "note" }).status, "invalid");
  assert.equal(requiredGrade({ grades: [], target: NaN, nextWeight: 1, system: "punkte" }).status, "invalid");
  assert.equal(requiredGrade({ grades: [], target: 16, nextWeight: 1, system: "punkte" }).status, "invalid");
});

test("Formatierung", () => {
  assert.equal(formatNumber(7 / 3), "2,33");
  assert.equal(formatNumber(11, 1), "11,0");
  assert.equal(formatNumber(null), "–");
  assert.equal(formatInput(5 / 3), "1,67");
  assert.equal(formatInput(2), "2");
  assert.equal(formatInput(NaN), "");
});

test("Schuljahr und Halbjahr", () => {
  assert.equal(schoolYearOf(new Date(2026, 10, 11)), "2026/27");
  assert.equal(schoolYearOf(new Date(2027, 1, 1)), "2026/27");
  assert.equal(schoolYearOf(new Date(2027, 7, 1)), "2027/28");
  assert.equal(schoolYearOf(new Date(1999, 8, 1)), "1999/00");
  assert.equal(halfOf(new Date(2026, 10, 11)), 1);
  assert.equal(halfOf(new Date(2027, 0, 20)), 1);
  assert.equal(halfOf(new Date(2027, 1, 1)), 2);
  assert.deepEqual(schoolYearOptions(["2023/24", "kaputt"], new Date(2026, 10, 11)), ["2027/28", "2026/27", "2025/26", "2023/24"]);
});

test("Zeugnisnote rundet auf ganze Noten, ab ,5 auf; Zeugnisdurchschnitt mittelt die gerundeten Noten", () => {
  assert.equal(zeugnisNote(2.33, "note"), 2);
  assert.equal(zeugnisNote(2.5, "note"), 3);
  assert.equal(zeugnisNote(1.49, "note"), 1);
  assert.equal(zeugnisNote(10.5, "punkte"), 11);
  assert.equal(zeugnisNote(null, "note"), null);
  // 2,33 → 2 | 1,5 → 2 | 3,4 → 3  ⇒ Zeugnisdurchschnitt 2,33 (ungerundet wäre es 2,41)
  assert.ok(Math.abs((zeugnisAverage([2.33, 1.5, 3.4, null], "note") as number) - 7 / 3) < 1e-9);
  assert.equal(zeugnisAverage([], "note"), null);
  assert.ok(DEFAULT_SUBJECTS.includes("Mathematik") && DEFAULT_SUBJECTS.length >= 10);
});

/* ---------- neu: robuste Zahlenformatierung (Intl kann auf dem Gerät fehlen) ---------- */

test("Formatierer: manueller Fallback liefert Komma und feste Nachkommastellen", () => {
  assert.equal(formatNumberManual(1.5, 2), "1,50");
  assert.equal(formatNumberManual(1.5, 1), "1,5");
  assert.equal(formatNumberManual(1.5, 0), "2");
  assert.equal(formatNumberManual(7 / 3, 2), "2,33");
  assert.equal(formatNumberManual(11, 1), "11,0");
  assert.equal(formatNumberManual(0, 2), "0,00");
  assert.equal(formatNumberManual(-2.5, 1), "-2,5");
  assert.equal(formatNumberManual(-0.001, 2), "0,00"); // kein "-0,00"
  assert.equal(formatNumberManual(1234.5, 2), "1.234,50"); // Tausenderpunkt wie de-DE
  assert.equal(formatNumberManual(1234567.891, 1), "1.234.567,9");
});

test("Formatierer: ohne Intl, bei Fehler und bei falschem Locale wird der Fallback benutzt", () => {
  const noIntl = createNumberFormatter(null);
  assert.equal(noIntl(7 / 3), "2,33");
  assert.equal(noIntl(11, 1), "11,0");
  assert.equal(noIntl(2, 0), "2");
  assert.equal(noIntl(null), "–");
  assert.equal(noIntl(NaN), "–");
  assert.equal(noIntl(undefined), "–");

  // Konstruktor wirft (Intl ohne de-DE / kaputt)
  class Throwing { constructor() { throw new RangeError("Incorrect locale information provided"); } format(): string { return ""; } }
  const t = createNumberFormatter(Throwing);
  assert.equal(t(7 / 3), "2,33");
  assert.equal(t(1.5, 1), "1,5");

  // Format wirft erst beim Benutzen
  class FormatThrows { format(): string { throw new Error("kaputt"); } }
  assert.equal(createNumberFormatter(FormatThrows)(7 / 3), "2,33");

  // Intl ignoriert de-DE und liefert englische Zahlen ("2.33"): wird nicht übernommen
  class English {
    private d: number;
    constructor(_l: string, o: { minimumFractionDigits: number }) { this.d = o.minimumFractionDigits; }
    format(x: number) { return x.toFixed(this.d); }
  }
  assert.equal(createNumberFormatter(English)(7 / 3), "2,33");
  assert.equal(createNumberFormatter(English)(11, 1), "11,0");
});

test("Formatierer: echtes Intl und Fallback stimmen überein", () => {
  const real = createNumberFormatter(Intl.NumberFormat as never);
  const manual = createNumberFormatter(null);
  for (const x of [0, 1, 1.5, 2.005, 2 / 3, 7 / 3, 5.3333333, 9.5, 14, 0.125, 99.995]) {
    for (const d of [0, 1, 2] as const) assert.equal(real(x, d), manual(x, d), `${x} @ ${d}`);
  }
  // Zufallswerte (Noten, Punkte, Durchschnitte) und glatte Dezimalwerte – feste Startzahl für Wiederholbarkeit
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let i = 0; i < 3000; i++) {
    const x = i % 3 === 0 ? Math.round(rnd() * 1500) / 100 : i % 3 === 1 ? rnd() * 16 : Math.round(rnd() * 100000) / 1000;
    for (const d of [0, 1, 2] as const) assert.equal(real(x, d), manual(x, d), `${x} @ ${d}`);
  }
  // (negative Werte kommen nicht vor; Intl schriebe -0,004 als "-0,00", der Fallback als "0,00")
  for (const x of [-1.5, 1234.5, 999.999, 0.995, 9.995]) assert.equal(real(x, 2), manual(x, 2), String(x));
});

test("formatOther und toSystem", () => {
  assert.equal(formatOther(7 / 3, "note"), "≙ 10,0 Punkte");
  assert.equal(formatOther(11, "punkte"), "≙ Note 2,00");
  assert.equal(formatOther(NaN, "note"), "");
  // toSystem: Noten ohne eigenes System gelten als im Zielsystem eingegeben; ungültige fallen weg
  assert.deepEqual(toSystem([{ value: 2, weight: 1 }, { value: NaN, weight: 1 }, { value: 3, weight: NaN }], "note"), [{ value: 2, weight: 1 }]);
});
