/* Planer – Zustandslogik der Oberfläche (reine Funktionen, ohne React und ohne Gerät, deshalb testbar).
 * Web-Quelle: tools/planer/planer.js (render, itemDialog, Schnellerfassung, Kennzahlen, Speicher-Hinweis, offerImport), Web-Commit 770dbe4.
 * „Heute“ kommt immer als Parameter (Text „JJJJ-MM-TT“), nie aus der Systemuhr: so gibt es keine Zeitzonen-Fehler.
 * Neu gegenüber dem Web: Datumsfeld als Text (parseDateInput / formatDateInput), weil es kein Datumsfeld wie <input type="date"> gibt. */
import {
  MAX_ITEMS,
  daysUntil,
  dueLabel,
  examCountdown,
  formatDate,
  parseDay,
  stats,
  usedSubjects,
  type CountdownState,
  type ItemKind,
  type PlanItem,
} from "./core";
import type { DeckSummary } from "./links";

/* ---------- Datumsfeld ---------- */

const pad2 = (n: string) => n.padStart(2, "0");

/**
 * Eingabe → "JJJJ-MM-TT" oder null (nicht lesbar oder kein echtes Datum wie 31.02.).
 * Erlaubt: "TT.MM.JJJJ", "T.M.JJJJ" (Leerzeichen um die Punkte und am Rand sind egal) und "JJJJ-MM-TT".
 * Eine leere Eingabe ergibt null; ob „leer“ erlaubt ist, entscheidet validateForm.
 */
export function parseDateInput(text: string): string | null {
  const s = String(text ?? "").trim();
  const de = /^(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})$/.exec(s);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  let out: string;
  if (de) out = `${de[3]}-${pad2(de[2] as string)}-${pad2(de[1] as string)}`;
  else if (iso) out = s;
  else return null;
  return parseDay(out) == null ? null : out;
}

/** "JJJJ-MM-TT" → "TT.MM.JJJJ" für das Textfeld; ungültig oder leer → "". */
export function formatDateInput(iso: string): string {
  if (parseDay(iso) == null) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/* ---------- Texte (Wortlaut aus dem Web) ---------- */

export const TEXT = {
  loading: "Dein Planer wird geladen …",
  titleMissing: "Gib einen Titel ein.",
  dateInvalid: "Gib das Datum so ein: TT.MM.JJJJ.",
  maxDialog: "Du hast die maximale Anzahl an Einträgen erreicht. Lösche alte Einträge.",
  maxQuick: "Du hast die maximale Anzahl an Einträgen erreicht.",
  deleted: "Gelöscht.",
  taskCreated: "Hausaufgabe eingetragen.",
  examCreated: "Klausur eingetragen.",
  noDecks: "Du hast noch keine Karteikarten-Stapel. Lege im Karteikarten-Modul einen an.",
  saveFailedToast: "Speichern fehlgeschlagen. Prüfe deine Verbindung, die Änderung ist noch nicht im Konto.",
  /* Abweichung vom Web („Der Browser verweigert …“): auf dem Gerät gibt es keinen Browser. */
  deviceRefusedToast: "Das Gerät verweigert das Speichern. Deine Einträge gehen beim Schließen verloren.",
} as const;

/* ---------- Tabs und Dialog ---------- */

export type Tab = "task" | "exam";

/** Welcher Eintrag-Dialog ist offen? null = keiner. itemId = null → neuer Eintrag. */
export type DialogState = { kind: ItemKind; itemId: string | null } | null;

export const openNewDialog = (tab: Tab): DialogState => ({ kind: tab, itemId: null });
export const openEditDialog = (item: Pick<PlanItem, "kind" | "id">): DialogState => ({ kind: item.kind, itemId: item.id });

export function dialogTitle(kind: ItemKind, creating: boolean): string {
  if (kind === "exam") return creating ? "Neue Klausur." : "Klausur bearbeiten.";
  return creating ? "Neue Hausaufgabe." : "Hausaufgabe bearbeiten.";
}

export const newButtonLabel = (tab: Tab) => (tab === "task" ? "+ Neue Hausaufgabe" : "+ Neue Klausur");

/** Beschriftungen der Dialogfelder (Web: Aufgabe/Bezeichnung, Fällig am/Datum, Notiz/Themen (optional)). */
export function dialogLabels(kind: ItemKind) {
  const exam = kind === "exam";
  return {
    title: exam ? "Bezeichnung" : "Aufgabe",
    titlePlaceholder: exam ? "z. B. Klassenarbeit 2" : "z. B. Seite 42, Aufgabe 3 bis 5",
    subject: "Fach",
    subjectPlaceholder: "z. B. Mathe",
    date: exam ? "Datum" : "Fällig am",
    datePlaceholder: "TT.MM.JJJJ",
    note: exam ? "Themen (optional)" : "Notiz (optional)",
    notePlaceholder: exam ? "z. B. Bruchrechnen, Gleichungen" : "",
    deck: "Karteikarten-Stapel zum Lernen",
    submit: (creating: boolean) => (creating ? "Eintragen" : "Speichern"),
  };
}

export interface ItemForm { title: string; subject: string; date: string; note: string; deckId: string }

export const emptyForm = (): ItemForm => ({ title: "", subject: "", date: "", note: "", deckId: "" });

/** Formularwerte aus einem bestehenden Eintrag (Datum als "TT.MM.JJJJ"). */
export const formFromItem = (i: PlanItem): ItemForm =>
  ({ title: i.title, subject: i.subject, date: formatDateInput(i.date), note: i.note, deckId: i.deckId });

export type FormFields = Pick<PlanItem, "title" | "subject" | "date" | "note" | "deckId">;
export interface FormErrors { title?: string; date?: string; form?: string }
export type FormResult = { ok: true; fields: FormFields } | { ok: false; errors: FormErrors };

/**
 * Formular prüfen. Titel ist Pflicht; ein neuer Eintrag passt nur, solange MAX_ITEMS nicht erreicht ist;
 * das Datum darf leer sein, sonst muss es lesbar sein. deckId gilt nur bei Klausuren.
 */
export function validateForm(form: ItemForm, kind: ItemKind, creating: boolean, itemCount: number): FormResult {
  const errors: FormErrors = {};
  const title = form.title.trim().slice(0, 120);
  if (!title) errors.title = TEXT.titleMissing;
  if (creating && itemCount >= MAX_ITEMS) errors.form = TEXT.maxDialog;
  const dateText = form.date.trim();
  let date = "";
  if (dateText) {
    const parsed = parseDateInput(dateText);
    if (parsed == null) errors.date = TEXT.dateInvalid;
    else date = parsed;
  }
  if (errors.title || errors.date || errors.form) return { ok: false, errors };
  return {
    ok: true,
    fields: {
      title,
      subject: form.subject.trim().slice(0, 60),
      date,
      note: form.note.trim().slice(0, 500),
      deckId: kind === "exam" ? form.deckId.slice(0, 36) : "",
    },
  };
}

/** Fächer-Chips im Dialog: schon benutzte Fächer, die zur Eingabe passen (ohne die exakt gleiche), höchstens `limit`. */
export function subjectSuggestions(items: ReadonlyArray<{ subject: string }>, typed: string, limit = 8): string[] {
  const q = typed.trim().toLocaleLowerCase("de");
  return usedSubjects(items)
    .filter((s) => { const l = s.toLocaleLowerCase("de"); return l !== q && (!q || l.includes(q)); })
    .slice(0, limit);
}

/* ---------- Listenänderungen (rein) ---------- */

export const isFull = (items: readonly unknown[]) => items.length >= MAX_ITEMS;

export const newItem = (id: string, kind: ItemKind, fields: Partial<FormFields>): PlanItem =>
  ({ id, kind, title: "", subject: "", date: "", note: "", done: false, deckId: "", ...fields });

export type QuickResult =
  | { ok: true; title: string }
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "full"; message: string };

/** Schnellerfassung: leere Eingabe wird ignoriert, ab MAX_ITEMS kommt ein Hinweis. */
export function validateQuick(title: string, itemCount: number): QuickResult {
  const t = title.trim().slice(0, 120);
  if (!t) return { ok: false, reason: "empty" };
  if (itemCount >= MAX_ITEMS) return { ok: false, reason: "full", message: TEXT.maxQuick };
  return { ok: true, title: t };
}

export const toggleDone = (items: readonly PlanItem[], id: string): PlanItem[] =>
  items.map((i) => (i.id === id && i.kind === "task" ? { ...i, done: !i.done } : i));
export const removeItem = (items: readonly PlanItem[], id: string): PlanItem[] => items.filter((i) => i.id !== id);
export const clearDone = (items: readonly PlanItem[]): PlanItem[] => items.filter((i) => !(i.kind === "task" && i.done));
export const updateItem = (items: readonly PlanItem[], id: string, fields: Partial<FormFields>): PlanItem[] =>
  items.map((i) => (i.id === id ? { ...i, ...fields } : i));

/* ---------- Kopf: Kennzahlen, Tabs, Speicher-Hinweis ---------- */

export interface HeaderStats {
  open: number;
  /** überfällig + heute fällig */
  alertCount: number;
  /** "überfällig" sobald etwas überfällig ist, sonst "heute fällig" */
  alertLabel: "überfällig" | "heute fällig";
  alert: boolean;
  /** "Heute", "Morgen", "n Tage" oder "–" */
  nextText: string;
  /** "bis <Fach>" (ohne Fach "bis Klausur") oder "nächste Klausur" */
  nextLabel: string;
  /** rot bei höchstens 3 Tagen */
  nextAlert: boolean;
}

export function headerStats(items: readonly PlanItem[], today: string): HeaderStats {
  const s = stats(items, today);
  const days = s.nextExamDays;
  const alertCount = s.overdue + s.dueToday;
  return {
    open: s.open,
    alertCount,
    alertLabel: s.overdue ? "überfällig" : "heute fällig",
    alert: alertCount >= 1,
    nextText: !s.nextExam || days == null ? "–" : days === 0 ? "Heute" : days === 1 ? "Morgen" : `${days} Tage`,
    nextLabel: s.nextExam ? "bis " + (s.nextExam.subject || "Klausur") : "nächste Klausur",
    nextAlert: days != null && days <= 3,
  };
}

/** Tab-Titel mit Zählern: offene Hausaufgaben, kommende Klausuren (wie im Web, splitExams.upcoming). */
export function tabTitles(items: readonly PlanItem[], today: string): Record<Tab, string> {
  const open = items.filter((i) => i.kind === "task" && !i.done).length;
  const upcoming = items.filter((i) => { const d = daysUntil(i.date, today); return i.kind === "exam" && !(d != null && d < 0); }).length;
  return { task: `Hausaufgaben (${open})`, exam: `Klausuren (${upcoming})` };
}

export type SaveState = "saving" | "saved" | "error";

/** Speicher-Hinweis unter den Kennzahlen. `filled` = Punkt ausgefüllt (gesichert), sonst hohl. */
export function saveNote(account: boolean, status: SaveState): { text: string; filled: boolean } {
  if (!account) return { text: "Nur auf diesem Gerät gespeichert. Anmelden, um alles in deinem Konto zu sichern.", filled: false };
  if (status === "saving") return { text: "Speichert …", filled: false };
  if (status === "error") return { text: "Speichern fehlgeschlagen. Es wird erneut versucht, sobald du wieder online bist.", filled: false };
  return { text: "In deinem Konto gespeichert, auf allen deinen Geräten.", filled: true };
}

/* ---------- Hausaufgaben und Klausuren: Anzeige ---------- */

export type DueTone = "late" | "today" | "normal";

export function taskRowModel(t: PlanItem, today: string): { dueText: string; tone: DueTone } {
  const diff = daysUntil(t.date, today);
  return { dueText: dueLabel(t.date, today), tone: diff != null && diff < 0 ? "late" : diff === 0 ? "today" : "normal" };
}

export function taskEmpty(items: readonly PlanItem[]): { title: string; message: string } {
  const hasTasks = items.some((i) => i.kind === "task");
  return hasTasks
    ? { title: "Alles erledigt.", message: "Keine offenen Aufgaben. Genieß die freie Zeit." }
    : { title: "Noch keine Hausaufgaben.", message: "Tipp oben eine Aufgabe ein, mit „Neue Hausaufgabe“ trägst du auch Fach, Fälligkeit und Notiz ein." };
}

export const EXAM_EMPTY = {
  title: "Keine Klausuren geplant.",
  message: "Trag deine nächsten Klausuren ein. Du siehst, wie viele Tage noch bleiben, und kannst einen Karteikarten-Stapel zum Lernen verknüpfen.",
  action: "Klausur eintragen",
} as const;

export interface ExamCardModel {
  big: string;
  small: string;
  state: CountdownState;
  /** lange Wörter („Heute“, „Morgen“) kleiner setzen */
  longBig: boolean;
  dateText: string;
}

export function examCardModel(e: PlanItem, today: string): ExamCardModel {
  const c = examCountdown(e.date, today);
  return { ...c, longBig: c.big.length > 3, dateText: e.date ? formatDate(e.date, today) : "Ohne Datum" };
}

export const groupHeading = (label: string, count: number) => `${label} · ${count}`;

/* ---------- Gast → Konto ---------- */

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function importPrompt(count: number) {
  return {
    title: "Lokale Einträge übernehmen?",
    message: `Auf diesem Gerät ${count === 1 ? "liegt 1 Eintrag" : `liegen ${count} Einträge`} aus dem Gast-Modus. Sollen sie in dein Konto übernommen werden? Sonst bleiben sie getrennt auf diesem Gerät.`,
    confirm: "Ins Konto übernehmen",
    cancel: "Nicht übernehmen",
  };
}

export const importDoneMessage = (taken: number) => `${plural(taken, "Eintrag", "Einträge")} in dein Konto übernommen.`;

/* ---------- Neuer Tag ---------- */

/** Hat sich der lokale Kalendertag seit dem gemerkten Wert geändert? */
export function dayChanged(remembered: string, now: string): boolean {
  return parseDay(now) != null && remembered !== now;
}

/** Millisekunden bis zum nächsten lokalen Mitternacht (mindestens 1000, damit ein Timer nicht in Schleife läuft). */
export function msUntilNextDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

/* ---------- Stapel-Liste ---------- */

/** Auswahl im Dialog: „Keiner“ zuerst, dann die Stapel. */
export function deckOptions(decks: readonly DeckSummary[]): Array<{ id: string; name: string }> {
  return [{ id: "", name: "Keiner" }, ...decks.map((d) => ({ id: d.id, name: d.name }))];
}
