/* Notenrechner – weitere reine Logik der Oberfläche (ergänzt model.ts): Konto-Ansicht, Zusammenfassung, Eingaben, Texte.
 * Web-Quelle: tools/notenrechner/notenrechner.js (loadView/saveView für Konten, updateComputed, Fach löschen, Umrechner,
 * ensureDefaults, offerImport; Pensum, Web-Commit 770dbe4). Kein React, kein Speicherzugriff. */
import {
  formatInput, formatNumber, formatOther, noteToPoints, overallAverage, parseGrade, pointsToNote, type Subject, type System,
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
