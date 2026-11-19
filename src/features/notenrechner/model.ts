/* Notenrechner – Modell der Oberfläche (reine Funktionen, ohne React).
 * Web-Quelle: tools/notenrechner/notenrechner.js (Pensum, Web-Commit 770dbe4): sanitizeView, visibleSubjects, gradesOf,
 * gradeValue, setSubjectGrade, seedDefaults, Namensprüfung. Im Web waren das veränderliche Funktionen auf einem globalen
 * Zustand; hier liefern sie neue Listen und eine Liste von „Effekten“, die der Hook am Speicher ausführt. */
import {
  SYSTEMS, DEFAULT_SUBJECTS, MORE_SUBJECTS, convert, subjectAverage, schoolYearOf, halfOf,
  type Grade, type Half, type Subject, type System,
} from "./core";

export interface View { system: System; schoolYear: string; half: Half }

/** Note im Speicher der Oberfläche; saved=false, wenn das Anlegen im Konto fehlgeschlagen ist (dann nie ändern/löschen). */
export type GradeRec = Grade & { saved: boolean };

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

export const defaultView = (now: Date = new Date()): View => ({ system: "note", schoolYear: schoolYearOf(now), half: halfOf(now) });

/** Gespeicherte Ansicht prüfen; Altwerte (z. B. Halbjahr 0 = ganzes Schuljahr) fallen auf das Aktuelle zurück. */
export function sanitizeView(v: unknown, now: Date = new Date()): View {
  const d = defaultView(now);
  if (!v || typeof v !== "object") return d;
  const o = v as Record<string, unknown>;
  const system = typeof o.system === "string" && Object.prototype.hasOwnProperty.call(SYSTEMS, o.system) ? (o.system as System) : d.system;
  const schoolYear = typeof o.schoolYear === "string" && /^\d{4}\/\d{2}$/.test(o.schoolYear) ? o.schoolYear : d.schoolYear;
  const h = Number(o.half);
  return { system, schoolYear, half: h === 1 || h === 2 ? h : d.half };
}

export const visibleSubjects = (subjects: readonly Subject[], view: View): Subject[] => subjects.filter((s) => s.schoolYear === view.schoolYear);

export const gradesOf = (grades: readonly GradeRec[], subjectId: string, view: View): GradeRec[] =>
  grades.filter((g) => g.subjectId === subjectId && g.half === view.half && isNum(g.value));

/** Zeugnisnote des Fachs im gewählten System (null = keine). Mehrere Noten aus früheren Versionen werden gewichtet gemittelt. */
export function gradeValue(grades: readonly GradeRec[], subjectId: string, view: View): number | null {
  const list = gradesOf(grades, subjectId, view);
  const first = list[0];
  if (list.length === 1 && first) return convert(first.value, first.system, view.system);
  return subjectAverage(list.filter((g) => isNum(g.weight)), view.system);
}

export type GradeEffect =
  | { kind: "remove"; grade: GradeRec }
  | { kind: "update"; id: string; data: Omit<Grade, "id" | "subjectId"> }
  | { kind: "add"; grade: GradeRec };

/** Zeugnisnote eines Fachs im gewählten Halbjahr setzen (null = entfernen). Es bleibt immer höchstens eine Note je Fach. */
export function planSetGrade(grades: readonly GradeRec[], subjectId: string, value: number | null, view: View, newId: () => string): { grades: GradeRec[]; effects: GradeEffect[] } {
  const [keep, ...extra] = gradesOf(grades, subjectId, view);
  const effects: GradeEffect[] = extra.map((g) => ({ kind: "remove", grade: g }));
  let next = grades.filter((g) => !extra.includes(g));
  if (value === null) {
    if (keep) { effects.push({ kind: "remove", grade: keep }); next = next.filter((g) => g !== keep); }
    return { grades: next, effects };
  }
  const data = { label: "", value, system: view.system, weight: 1, half: view.half } as const;
  if (keep) {
    next = next.map((g) => (g === keep ? { ...g, ...data } : g));
    effects.push({ kind: "update", id: keep.id, data });
  } else {
    const grade: GradeRec = { id: newId(), subjectId, ...data, saved: true };
    next = [...next, grade];
    effects.push({ kind: "add", grade });
  }
  return { grades: next, effects };
}

/** Standardfächer, die im Schuljahr noch fehlen (Vergleich ohne Groß-/Kleinschreibung). */
export function planSeed(subjects: readonly Subject[], view: View, newId: () => string): Subject[] {
  const have = new Set(visibleSubjects(subjects, view).map((s) => s.name.toLowerCase()));
  return DEFAULT_SUBJECTS.filter((n) => !have.has(n.toLowerCase())).map((name) => ({ id: newId(), name, schoolYear: view.schoolYear }));
}

/** Vorschlags-Chips: Standard- und weitere Fächer, die es im Schuljahr noch nicht gibt. */
export function missingSuggestions(subjects: readonly Subject[], view: View): string[] {
  const have = new Set(visibleSubjects(subjects, view).map((s) => s.name.toLowerCase()));
  return [...DEFAULT_SUBJECTS, ...MORE_SUBJECTS].filter((n) => !have.has(n.toLowerCase()));
}

/** Name für ein neues Fach prüfen. */
export function checkNewSubjectName(input: string, subjects: readonly Subject[], view: View): { ok: true; name: string } | { ok: false; error: string } {
  const name = input.trim();
  if (!name) return { ok: false, error: "Gib dem Fach einen Namen." };
  if (visibleSubjects(subjects, view).some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `„${name}“ gibt es im Schuljahr ${view.schoolYear} schon.` };
  }
  return { ok: true, name };
}

/** Mittelwerte für die Zusammenfassung: Fachwerte, die es gibt, und deren Zahl. */
export function subjectValues(subjects: readonly Subject[], grades: readonly GradeRec[], view: View): { values: number[]; total: number } {
  const list = visibleSubjects(subjects, view);
  const values: number[] = [];
  for (const s of list) { const v = gradeValue(grades, s.id, view); if (isNum(v)) values.push(v); }
  return { values, total: list.length };
}

export const HALF_LABEL: Record<Half, string> = { 1: "1. Halbjahr", 2: "2. Halbjahr" };
