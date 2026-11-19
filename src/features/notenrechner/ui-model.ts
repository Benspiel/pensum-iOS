/* Notenrechner – weitere reine Logik der Oberfläche (ergänzt model.ts): Konto-Ansicht, Zusammenfassung, Eingaben, Texte.
 * Web-Quelle: tools/notenrechner/notenrechner.js (loadView/saveView für Konten, updateComputed, Fach löschen, Umrechner,
 * ensureDefaults, offerImport; Pensum, Web-Commit 770dbe4). Kein React, kein Speicherzugriff. */
import {
  formatInput, formatNumber, formatOther, noteToPoints, overallAverage, parseGrade, pointsToNote, type Grade, type Subject, type System,
} from "./core";
import { HALF_LABEL, sanitizeView, subjectValues, type GradeRec, type View } from "./model";

/* ---------- Ansicht im Konto (Einstellungen nrSystem, nrYear, nrHalf) ---------- */

/** Ansicht aus den Konto-Einstellungen; null, wenn dort noch nichts gespeichert ist (dann gilt die lokale Ansicht). */
export function viewFromPrefs(prefs: Readonly<Record<string, unknown>> | null | undefined, now?: Date): View | null {
  if (!prefs || !prefs.nrSystem) return null;
  return sanitizeView({ system: prefs.nrSystem, schoolYear: prefs.nrYear, half: prefs.nrHalf }, now);
}

/** Konto-Einstellungen zur Ansicht (das Halbjahr wie im Web als Text). */
export const prefsFromView = (view: View): { nrSystem: System; nrYear: string; nrHalf: string } =>
  ({ nrSystem: view.system, nrYear: view.schoolYear, nrHalf: String(view.half) });

/* ---------- Noten und Fächer ---------- */

/** Eine Note als „nicht gespeichert“ markieren (Anlegen im Speicher ist fehlgeschlagen). */
export const markUnsaved = (grades: readonly GradeRec[], id: string): GradeRec[] =>
  grades.map((g) => (g.id === id ? { ...g, saved: false } : g));

/** Fach löschen: neue Listen, Anzahl der Noten (für die Rückfrage) und IDs der im Speicher vorhandenen Noten. */
export function planRemoveSubject(subjects: readonly Subject[], grades: readonly GradeRec[], subjectId: string) {
  const own = grades.filter((g) => g.subjectId === subjectId);
  return {
    subjects: subjects.filter((s) => s.id !== subjectId),
    grades: grades.filter((g) => g.subjectId !== subjectId),
    gradeCount: own.length,
    savedGradeIds: own.filter((g) => g.saved).map((g) => g.id),
  };
}

/** Rückfrage beim Löschen eines Fachs mit Noten (ohne Noten wird nicht gefragt). */
export function removeSubjectPrompt(name: string, gradeCount: number): { title: string; text: string; confirm: string } {
  const one = gradeCount === 1;
  return {
    title: `„${name}“ löschen?`,
    text: `${one ? "Die Note" : `Alle ${gradeCount} Noten`} dieses Fachs ${one ? "wird" : "werden"} mit gelöscht. Das lässt sich nicht rückgängig machen.`,
    confirm: "Fach löschen",
  };
}

/** Neuer Name beim Umbenennen: leer oder nur Leerzeichen → null (dann bleibt der alte Name). */
export const cleanSubjectName = (input: string): string | null => input.trim() || null;

/* ---------- Standardfächer und Übernahme ---------- */

/** Offene Übernahme: Konto angemeldet, lokale Gast-Fächer vorhanden und für dieses Konto nicht abgelehnt. */
export const importPending = (userId: string | null, guestSubjectCount: number, declined: readonly string[]): boolean =>
  userId !== null && guestSubjectCount > 0 && !declined.includes(userId);

/**
 * Ein Schuljahr ohne Fächer bekommt einmal die Standardfächer. Wer sie löscht, dem werden sie nicht wieder aufgedrängt;
 * solange eine Übernahme von Gast-Daten offen ist, wird nichts eingefügt.
 */
export function shouldSeedDefaults(a: { loading: boolean; visibleCount: number; seeded: readonly string[]; key: string; importPending: boolean }): boolean {
  if (a.loading || a.visibleCount > 0 || a.seeded.includes(a.key)) return false;
  return !a.importPending;
}

export function importPromptText(subjects: number, grades: number): string {
  return `Auf diesem Gerät ${subjects === 1 ? "liegt 1 Fach" : `liegen ${subjects} Fächer`} mit ${grades} ${grades === 1 ? "Note" : "Noten"} aus dem Gast-Modus. Sollen sie in dein Konto übernommen werden? Sonst bleiben sie getrennt auf diesem Gerät.`;
}

export function importDoneText(n: { subjects: number; grades: number }): string {
  return `${n.subjects} ${n.subjects === 1 ? "Fach" : "Fächer"} und ${n.grades} ${n.grades === 1 ? "Note" : "Noten"} in dein Konto übernommen.`;
}

/* ---------- Anzeige ---------- */

export interface Summary {
  average: number | null;
  /** großer Wert, z. B. "2,33" oder "–" */
  valueText: string;
  info: string;
}

/** Zeugnisdurchschnitt der Ansicht: Mittel der Fächer mit Note (Fächer ohne Note zählen nicht). */
export function summarize(subjects: readonly Subject[], grades: readonly GradeRec[], view: View): Summary {
  const { values, total } = subjectValues(subjects, grades, view);
  const average = overallAverage(values);
  const info = average === null
    ? "Trag bei deinen Fächern die Zeugnisnote ein."
    : `${formatOther(average, view.system)} · Mittel aus ${values.length} von ${total} ${total === 1 ? "Fach" : "Fächern"} · ${HALF_LABEL[view.half]}`;
  return { average, valueText: formatNumber(average, 2), info };
}

/** Wirkung einer Eingabe im Notenfeld eines Fachs. */
export type GradeInputResult = { kind: "set"; value: number } | { kind: "clear" } | { kind: "error"; error: string };

export function interpretGradeInput(text: string, system: System): GradeInputResult {
  const r = parseGrade(text, system);
  if (r.ok) return { kind: "set", value: r.value };
  if (r.empty) return { kind: "clear" };
  return { kind: "error", error: r.error ?? "" };
}

/** Umrechner: Eingabe in `from` → Text im anderen System. invalid = Eingabe vorhanden, aber unbrauchbar. */
export function convertInput(text: string, from: System): { invalid: boolean; other: string } {
  const r = parseGrade(text, from);
  if (!r.ok) return { invalid: !r.empty, other: "" };
  return { invalid: false, other: formatInput(from === "note" ? noteToPoints(r.value) : pointsToNote(r.value)) };
}

/* ---------- Gast-Daten ins Konto übernehmen (wiederholbar ohne Duplikate) ---------- */

export interface GuestImportPlan {
  /** neu anzulegende Fächer (neue IDs) */
  subjects: Subject[];
  /** neu anzulegende Noten (neue IDs, auf das Ziel-Fach im Konto umgeschrieben) */
  grades: Grade[];
  /** Gast-Fächer, die auf ein vorhandenes oder bereits geplantes Fach gleichen Namens im selben Schuljahr fielen */
  mergedSubjects: number;
  /** Gast-Noten, die wegfielen, weil das Ziel-Fach im Konto für dieses Halbjahr schon eine Note hat */
  skippedGrades: number;
}

const subjectKey = (s: { name: string; schoolYear: string }) => `${s.schoolYear}|${s.name.trim().toLowerCase()}`;

/**
 * Plan für die Übernahme der Gast-Daten ins Konto, abhängig vom aktuellen Stand im Konto. Dadurch ist eine Wiederholung nach einem
 * Teilfehler sicher: Was schon im Konto liegt, wird nicht noch einmal angelegt.
 *  - Fächer gleichen Namens (ohne Groß-/Kleinschreibung, getrimmt) im selben Schuljahr werden mit dem vorhandenen Fach zusammengeführt,
 *    auch untereinander im Gastspeicher.
 *  - Je Ziel-Fach und Halbjahr zählt die Note im Konto: Hat das Fach dort schon eine Note, entfallen die Gast-Noten dafür.
 *  - Noten ohne Fach oder mit ungültigem Wert/Gewicht werden nicht übernommen (wie im Web).
 */
export function planGuestImport(
  guest: { subjects: readonly Subject[]; grades: readonly Grade[] },
  cloud: { subjects: readonly Subject[]; grades: readonly Grade[] },
  newId: () => string,
): GuestImportPlan {
  const target = new Map<string, string>();
  for (const s of cloud.subjects) if (!target.has(subjectKey(s))) target.set(subjectKey(s), s.id);
  const taken = new Set(cloud.grades.filter((g) => Number.isFinite(g.value)).map((g) => `${g.subjectId}|${g.half}`));

  const idMap = new Map<string, string>();
  const subjects: Subject[] = [];
  let mergedSubjects = 0;
  for (const s of guest.subjects) {
    const key = subjectKey(s);
    const existing = target.get(key);
    if (existing) { idMap.set(s.id, existing); mergedSubjects++; continue; }
    const created: Subject = { id: newId(), name: s.name.trim() || s.name, schoolYear: s.schoolYear };
    target.set(key, created.id);
    idMap.set(s.id, created.id);
    subjects.push(created);
  }

  const grades: Grade[] = [];
  let skippedGrades = 0;
  const cloudKeys = new Set(taken);
  const owner = new Map<string, string>(); // Ziel-Fach|Halbjahr → Gast-Fach, das die Note geliefert hat
  for (const g of guest.grades) {
    const subjectId = idMap.get(g.subjectId);
    if (!subjectId || !Number.isFinite(g.value) || !Number.isFinite(g.weight)) continue;
    const key = `${subjectId}|${g.half}`;
    // Konto hat schon eine Note, oder ein anderes (zusammengeführtes) Gast-Fach hat dieses Halbjahr schon belegt
    if (cloudKeys.has(key) || (owner.has(key) && owner.get(key) !== g.subjectId)) { skippedGrades++; continue; }
    owner.set(key, g.subjectId);
    grades.push({ ...g, id: newId(), subjectId });
  }
  return { subjects, grades, mergedSubjects, skippedGrades };
}

/** Meldung nach der Übernahme; wenn alles schon im Konto war, ein eigener Text. */
export function importResultText(n: { subjects: number; grades: number }): string {
  return n.subjects === 0 && n.grades === 0 ? "Die lokalen Daten waren schon in deinem Konto." : importDoneText(n);
}
