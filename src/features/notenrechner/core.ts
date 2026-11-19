/* Notenrechner – reine Rechenlogik ohne UI und ohne Speicher.
 * Web-Quelle: tools/notenrechner/core.js (Pensum, Web-Commit 770dbe4). Verhalten unverändert, nur typisiert;
 * Abweichung: Zahlenformatierung ist robust gegen fehlendes/fehlerhaftes Intl (siehe createNumberFormatter).
 *
 * Zwei Notensysteme:
 *   "note"   – Noten 1–6 (Sek I), kleiner ist besser. Tendenzen: 2+ = 1,67 · 2− = 2,33.
 *   "punkte" – 0–15 Punkte (Oberstufe), größer ist besser.
 *
 * Umrechnung nach der üblichen KMK-Zuordnung: Note = (17 − Punkte) / 3,
 * also 15 P = 1+ (0,67), 14 P = 1, 11 P = 2, 8 P = 3, 5 P = 4, 2 P = 5, 1 P = 5− (5,33).
 * 0 Punkte sind die Note 6; zwischen 1 und 0 Punkten wird linear verbunden, damit die
 * Umrechnung in beide Richtungen stetig und umkehrbar bleibt.
 */

export type System = "note" | "punkte";
export type Half = 1 | 2;

export interface SystemInfo {
  id: System;
  label: string;
  unit: string;
  min: number;
  max: number;
  best: number;
  worst: number;
  lowerIsBetter: boolean;
}

export interface Subject {
  id: string;
  name: string;
  /** z. B. "2026/27" */
  schoolYear: string;
}

export interface Grade {
  id: string;
  subjectId: string;
  label: string;
  value: number;
  system: System;
  weight: number;
  half: Half;
}

/** Wert und Gewicht, wie sie in Durchschnitte eingehen. `system` ist optional (Standard = Zielsystem). */
export interface WeightedValue {
  value: number;
  weight: number;
  system?: System;
}

export const SYSTEMS: Record<System, SystemInfo> = {
  note: { id: "note", label: "Noten 1–6", unit: "Note", min: 1, max: 6, best: 1, worst: 6, lowerIsBetter: true },
  punkte: { id: "punkte", label: "Punkte 0–15", unit: "Punkte", min: 0, max: 15, best: 15, worst: 0, lowerIsBetter: false },
};

const NOTE_MIN = 2 / 3; // 1+ (entspricht 15 Punkten)
const NOTE_AT_ONE_POINT = 16 / 3;
const EPS = 1e-9;

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function pointsToNote(p: unknown): number | null {
  if (!isNum(p)) return null;
  const q = clamp(p, 0, 15);
  return q >= 1 ? (17 - q) / 3 : 6 - q * (6 - NOTE_AT_ONE_POINT);
}

export function noteToPoints(n: unknown): number | null {
  if (!isNum(n)) return null;
  const m = clamp(n, NOTE_MIN, 6);
  return m <= NOTE_AT_ONE_POINT ? 17 - 3 * m : (6 - m) / (6 - NOTE_AT_ONE_POINT);
}

/** Wert von einem System ins andere umrechnen. */
export function convert(value: unknown, from: System, to: System): number | null {
  if (!isNum(value)) return null;
  if (from === to) return value;
  return from === "note" ? noteToPoints(value) : pointsToNote(value);
}

const parseNumber = (s: string): number => (/^\d+(?:[.,]\d+)?$/.test(s) ? parseFloat(s.replace(",", ".")) : NaN);

export type ParseResult = { ok: true; value: number } | { ok: false; empty?: boolean; error?: string };

/** Eingabe einer Note prüfen. */
export function parseGrade(input: unknown, system: System): ParseResult {
  const s = String(input ?? "").trim();
  if (!s) return { ok: false, empty: true };
  if (system === "punkte") {
    const v = parseNumber(s);
    if (!isNum(v) || v < 0 || v > 15) return { ok: false, error: "Punkte zwischen 0 und 15 eingeben." };
    return { ok: true, value: v };
  }
  // Tendenz: 2+ ist ein Drittel besser, 2− ein Drittel schlechter
  const t = s.match(/^([1-6])\s*([+\-−–])$/);
  if (t) {
    const v = Number(t[1]) + (t[2] === "+" ? -1 / 3 : 1 / 3);
    if (v > 6 + EPS) return { ok: false, error: "Schlechter als 6 geht nicht." };
    return { ok: true, value: v };
  }
  const v = parseNumber(s);
  if (!isNum(v) || v < 1 || v > 6) return { ok: false, error: "Note zwischen 1 und 6 eingeben, z. B. 2 oder 2,3." };
  return { ok: true, value: v };
}

/** Gewichtung prüfen: Zahl von 0 bis 100 (0 = zählt nicht). */
export function parseWeight(input: unknown): ParseResult {
  const s = String(input ?? "").trim().replace(/^[x×]\s*|\s*[x×]$/gi, "");
  if (!s) return { ok: false, empty: true };
  const v = parseNumber(s);
  if (!isNum(v) || v > 100) return { ok: false, error: "Gewichtung zwischen 0 und 100 eingeben." };
  return { ok: true, value: v };
}

/**
 * Gewichteter Durchschnitt. Ungültige Einträge werden übersprungen.
 * @returns null, wenn nichts zählt (keine Einträge oder Gewichtssumme 0)
 */
export function weightedAverage(items: ReadonlyArray<{ value: number; weight: number } | null | undefined> | null | undefined): number | null {
  let sum = 0, weights = 0;
  for (const it of items || []) {
    if (!it || !isNum(it.value) || !isNum(it.weight) || it.weight <= 0) continue;
    sum += it.value * it.weight;
    weights += it.weight;
  }
  return weights > 0 ? sum / weights : null;
}

/** Noten eines Fachs (beliebig gemischt eingegeben) ins Zielsystem bringen. */
export function toSystem(grades: ReadonlyArray<WeightedValue> | null | undefined, system: System): Array<{ value: number; weight: number }> {
  const out: Array<{ value: number; weight: number }> = [];
  for (const g of grades || []) {
    const value = convert(g.value, g.system || system, system);
    if (isNum(value) && isNum(g.weight)) out.push({ value, weight: g.weight });
  }
  return out;
}

/** Durchschnitt eines Fachs im gewünschten System. */
export const subjectAverage = (grades: ReadonlyArray<WeightedValue> | null | undefined, system: System): number | null =>
  weightedAverage(toSystem(grades, system));

/** Gesamtdurchschnitt: Mittel der Fachdurchschnitte; Fächer ohne Noten zählen nicht. */
export function overallAverage(averages: ReadonlyArray<number | null | undefined> | null | undefined): number | null {
  const valid = (averages || []).filter(isNum);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

/** Zeugnisnote: Fachdurchschnitt auf eine ganze Note (bzw. ganze Punkte) gerundet, ab ,5 auf. */
export function zeugnisNote(avg: unknown, system: System): number | null {
  const sys = SYSTEMS[system];
  if (!sys || !isNum(avg)) return null;
  return Math.min(sys.max, Math.max(sys.min, Math.round(avg + 1e-9)));
}

/** Zeugnisdurchschnitt: Mittel der gerundeten Zeugnisnoten; Fächer ohne Noten zählen nicht. */
export function zeugnisAverage(averages: ReadonlyArray<number | null | undefined> | null | undefined, system: System): number | null {
  const grades = (averages || []).map((a) => zeugnisNote(a, system)).filter(isNum);
  return grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null;
}

/** Übliche Schulfächer: werden für ein neues Schuljahr vorgeschlagen und lassen sich ändern oder löschen. */
export const DEFAULT_SUBJECTS: readonly string[] = ["Deutsch", "Mathematik", "Englisch", "Biologie", "Chemie", "Physik", "Geschichte", "Erdkunde", "Politik", "Kunst", "Musik", "Sport"];
export const MORE_SUBJECTS: readonly string[] = ["Französisch", "Spanisch", "Latein", "Informatik", "Religion", "Ethik", "Wirtschaft", "Philosophie", "Sozialkunde", "Technik"];

/** Ergebnis der Zielnoten-Rechnung. */
export type RequiredGradeResult =
  | { status: "invalid"; error: string }
  /** practical: nächste eintragbare Note */
  | { status: "reachable"; needed: number; practical: number }
  /** jede Note reicht */
  | { status: "guaranteed"; needed: number }
  /** bestCase: Durchschnitt mit der Bestnote */
  | { status: "unreachable"; needed: number; bestCase: number };

export interface RequiredGradeInput {
  /** bereits im angegebenen System (siehe toSystem) */
  grades: ReadonlyArray<{ value: number; weight: number } | null | undefined> | null | undefined;
  target: number;
  nextWeight: number;
  system: System;
}

/** Zielnote: Welche Note braucht die nächste Arbeit, damit der Durchschnitt das Ziel erreicht? */
export function requiredGrade({ grades, target, nextWeight, system }: RequiredGradeInput): RequiredGradeResult {
  const sys = SYSTEMS[system];
  if (!sys) return { status: "invalid", error: "Unbekanntes Notensystem." };
  if (!isNum(target) || target < sys.min || target > sys.max) {
    return { status: "invalid", error: `Wunsch-Durchschnitt zwischen ${sys.min} und ${sys.max} eingeben.` };
  }
  if (!isNum(nextWeight) || nextWeight <= 0) {
    return { status: "invalid", error: "Die Gewichtung der nächsten Arbeit muss größer als 0 sein." };
  }
  let sum = 0, weights = 0;
  for (const g of grades || []) {
    if (!g || !isNum(g.value) || !isNum(g.weight) || g.weight <= 0) continue;
    sum += g.value * g.weight;
    weights += g.weight;
  }
  const needed = (target * (weights + nextWeight) - sum) / nextWeight;
  const bestCase = (sum + sys.best * nextWeight) / (weights + nextWeight);

  if (sys.lowerIsBetter) {
    if (needed >= sys.worst - EPS) return { status: "guaranteed", needed };
    if (needed < sys.best - EPS) return { status: "unreachable", needed, bestCase };
    return { status: "reachable", needed, practical: Math.max(sys.best, Math.floor(needed * 10 + EPS) / 10) };
  }
  if (needed <= sys.worst + EPS) return { status: "guaranteed", needed };
  if (needed > sys.best + EPS) return { status: "unreachable", needed, bestCase };
  return { status: "reachable", needed, practical: Math.min(sys.best, Math.ceil(needed - EPS)) };
}

/* ---------- Darstellung ---------- */

type Digits = 0 | 1 | 2;
interface NumberFormatLike { format(x: number): string }
type NumberFormatCtor = new (locale: string, options: { minimumFractionDigits: number; maximumFractionDigits: number }) => NumberFormatLike;

/** Auf `digits` Nachkommastellen runden wie Intl (halfExpand auf der kürzesten Dezimaldarstellung: 2,005 → 2,01). */
function roundedDigits(abs: number, digits: number): string {
  const s = String(abs);
  if (/e/i.test(s)) return abs.toFixed(digits); // sehr große/kleine Zahlen: toFixed genügt
  const [intPart = "", fracPart = ""] = s.split(".");
  if (fracPart.length <= digits) return digits ? intPart + "." + fracPart.padEnd(digits, "0") : intPart;
  const roundUp = fracPart.charCodeAt(digits) >= 53; // Ziffer '5' oder höher
  const ds = (intPart + fracPart.slice(0, digits)).split("").map(Number);
  if (roundUp) {
    let i = ds.length - 1;
    while (i >= 0 && ds[i] === 9) ds[i--] = 0;
    if (i >= 0) ds[i] = (ds[i] ?? 0) + 1; else ds.unshift(1);
  }
  const all = ds.join("");
  const cut = all.length - digits;
  return digits ? all.slice(0, cut) + "." + all.slice(cut) : all;
}

/** Deutsch ohne Intl: Komma, feste Nachkommastellen, Punkt als Tausendertrenner (wie de-DE). */
export function formatNumberManual(x: number, digits: Digits = 2): string {
  const fixed = roundedDigits(Math.abs(x), digits);
  const [int = "", frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const neg = x < 0 && Number(fixed) !== 0;
  return (neg ? "-" : "") + grouped + (frac ? "," + frac : "");
}

/**
 * Formatierer für deutsche Zahlen. Nutzt Intl.NumberFormat("de-DE"), falls vorhanden und brauchbar;
 * fehlt Intl (oder liefert es kein Komma, z. B. weil Hermes ohne Locale-Daten läuft), springt er auf
 * formatNumberManual. Die Konstruktor-Abhängigkeit ist nur für Tests austauschbar.
 */
export function createNumberFormatter(ctor?: NumberFormatCtor | null): (x: unknown, digits?: Digits) => string {
  const fmts: Array<NumberFormatLike | null> = [0, 1, 2].map((d) => {
    try {
      if (!ctor) return null;
      const f = new ctor("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
      // Selbsttest: ein brauchbares de-DE-Format liefert "1,5" bzw. "1,50"; sonst nicht verwenden
      const probe = f.format(1.5);
      if (typeof probe !== "string" || probe !== formatNumberManual(1.5, d as Digits)) return null;
      return f;
    } catch (_) {
      return null;
    }
  });
  return (x, digits = 2) => {
    if (!isNum(x)) return "–";
    const f = fmts[digits];
    if (f) {
      try {
        const out = f.format(x);
        if (typeof out === "string") return out;
      } catch (_) { /* fällt unten auf den manuellen Weg zurück */ }
    }
    return formatNumberManual(x, digits);
  };
}

const intlCtor = (): NumberFormatCtor | null => {
  try {
    const I = (globalThis as { Intl?: { NumberFormat?: unknown } }).Intl;
    return I && typeof I.NumberFormat === "function" ? (I.NumberFormat as unknown as NumberFormatCtor) : null;
  } catch (_) {
    return null;
  }
};

/** Zahl deutsch formatieren (Komma), feste Nachkommastellen. Ungültig → "–". */
export const formatNumber: (x: unknown, digits?: Digits) => string = createNumberFormatter(intlCtor());

/** Wert für ein Eingabefeld: so kurz wie möglich, höchstens zwei Nachkommastellen. */
export function formatInput(x: unknown): string {
  if (!isNum(x)) return "";
  return String(Math.round(x * 100) / 100).replace(".", ",");
}

/** „2,33 (≙ 10,0 Punkte)“ – Gegenwert im anderen System. */
export function formatOther(value: unknown, system: System): string {
  if (!isNum(value)) return "";
  return system === "note"
    ? `≙ ${formatNumber(noteToPoints(value), 1)} Punkte`
    : `≙ Note ${formatNumber(pointsToNote(value), 2)}`;
}

/* ---------- Schuljahr / Halbjahr ---------- */

/** Schuljahr eines Datums, z. B. "2026/27" (Wechsel am 1. August, lokale Zeit). */
export function schoolYearOf(date: Date = new Date()): string {
  const y = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
  return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
}

/** Halbjahr eines Datums: August–Januar = 1, Februar–Juli = 2. */
export function halfOf(date: Date = new Date()): Half {
  const m = date.getMonth();
  return m >= 7 || m === 0 ? 1 : 2;
}

/** Auswahlliste: vorhandene Schuljahre plus das laufende, das vorige und das nächste. */
export function schoolYearOptions(existing: readonly string[] = [], date: Date = new Date()): string[] {
  const start = Number(schoolYearOf(date).slice(0, 4));
  const label = (y: number) => `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
  const set = new Set([label(start - 1), label(start), label(start + 1), ...existing.filter((s) => /^\d{4}\/\d{2}$/.test(s))]);
  return [...set].sort().reverse();
}
