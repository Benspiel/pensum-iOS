/* Planer – reine Logik (Datum, Gruppen, Beschriftungen), ohne Oberfläche und deshalb testbar.
 * Web-Quelle: tools/planer/core.js (Pensum, Web-Commit 770dbe4). Verhalten unverändert, nur typisiert.
 * Abweichungen: Wochentag stimmt jetzt auch für Daten vor 1970 (Web lieferte dort "undefined");
 * neu: mergeGuestItems (im Web Teil der Oberfläche, hier als reine Funktion).
 *
 * Eintrag: { id, kind: "task" | "exam", title, subject, date: "JJJJ-MM-TT" oder "", note, done, deckId }
 *   task = Hausaufgabe (date = Fälligkeit), exam = Klausur (date = Termin, deckId = verknüpfter Karteikarten-Stapel).
 * Alle Daten sind lokale Kalendertage als Text, so gibt es keine Zeitzonen-Fehler.
 * „Heute“ wird nie intern geholt: Funktionen bekommen `today` (Text) bzw. `now` (Date) von außen. */

export const MAX_ITEMS = 500;

export type ItemKind = "task" | "exam";

export interface PlanItem {
  id: string;
  kind: ItemKind;
  title: string;
  subject: string;
  /** "JJJJ-MM-TT" oder "" */
  date: string;
  note: string;
  done: boolean;
  /** Karteikarten-Stapel (nur Klausuren), "" = keiner; höchstens 36 Zeichen */
  deckId: string;
}

export interface PlanData {
  items: PlanItem[];
}

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const DAY_SHORT = ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."];

/** Wochentag (0 = Sonntag) für „Tage seit 1970“; der 1.1.1970 war ein Donnerstag. Auch für negative Werte. */
const weekday = (n: number) => (((n + 4) % 7) + 7) % 7;

/** Tage seit 1970 für einen Text „JJJJ-MM-TT“, sonst null (auch bei Daten wie 31.02.). */
export function parseDay(iso: unknown): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return Math.round(t / 86400000);
}

/** Heutiger lokaler Kalendertag als "JJJJ-MM-TT". `now` ist für Tests und „neuer Tag“-Prüfungen austauschbar. */
export function todayISO(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Tage von today bis iso (negativ = vorbei), null ohne gültiges Datum. */
export function daysUntil(iso: unknown, today: unknown): number | null {
  const a = parseDay(iso), b = parseDay(today);
  return a == null || b == null ? null : a - b;
}

export function formatDate(iso: string, today?: string): string {
  const n = parseDay(iso);
  if (n == null) return "";
  const [y, m, d] = iso.split("-");
  const wd = DAY_SHORT[weekday(n)];
  const sameYear = today && String(today).slice(0, 4) === y;
  return sameYear ? `${wd} ${d}.${m}.` : `${wd} ${d}.${m}.${y}`;
}

/** Beschriftung der Fälligkeit einer Hausaufgabe. */
export function dueLabel(iso: string, today: string): string {
  const diff = daysUntil(iso, today);
  if (diff == null) return "Ohne Datum";
  if (diff < -1) return `${-diff} Tage überfällig`;
  if (diff === -1) return "Gestern fällig";
  if (diff === 0) return "Heute";
  if (diff === 1) return "Morgen";
  if (diff === 2) return "Übermorgen";
  if (diff < 7) return DAY_NAMES[weekday(parseDay(iso) as number)] as string;
  return formatDate(iso, today);
}

export type CountdownState = "none" | "past" | "today" | "soon" | "later";

/** Countdown bei Klausuren. */
export function examCountdown(iso: string, today: string): { big: string; small: string; state: CountdownState } {
  const diff = daysUntil(iso, today);
  if (diff == null) return { big: "?", small: "kein Datum", state: "none" };
  if (diff < 0) return { big: "✓", small: "vorbei", state: "past" };
  if (diff === 0) return { big: "Heute", small: "schreibst du", state: "today" };
  if (diff === 1) return { big: "Morgen", small: "schreibst du", state: "soon" };
  return { big: String(diff), small: "Tage noch", state: diff <= 7 ? "soon" : "later" };
}

export type GroupKey = "overdue" | "today" | "week" | "later" | "none";

/** Offene Hausaufgaben nach Dringlichkeit gruppieren (leere Gruppen fallen weg). */
export function groupTasks<T extends { date: string; done: boolean }>(tasks: readonly T[], today: string): Array<{ key: GroupKey; label: string; items: T[] }> {
  const open = tasks.filter((t) => !t.done);
  const byDate = (a: T, b: T) => (parseDay(a.date) ?? Infinity) - (parseDay(b.date) ?? Infinity);
  const groups: Array<{ key: GroupKey; label: string; test: (d: number | null) => boolean }> = [
    { key: "overdue", label: "Überfällig", test: (d) => d != null && d < 0 },
    { key: "today", label: "Heute", test: (d) => d === 0 },
    { key: "week", label: "Diese Woche", test: (d) => d != null && d >= 1 && d <= 7 },
    { key: "later", label: "Später", test: (d) => d != null && d > 7 },
    { key: "none", label: "Ohne Datum", test: (d) => d == null },
  ];
  return groups
    .map((g) => ({ key: g.key, label: g.label, items: open.filter((t) => g.test(daysUntil(t.date, today))).sort(byDate) }))
    .filter((g) => g.items.length);
}

/** Klausuren: kommende nach Datum, vergangene getrennt (neueste zuerst). */
export function splitExams<T extends { date: string }>(exams: readonly T[], today: string): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [], past: T[] = [];
  for (const e of exams) {
    const d = daysUntil(e.date, today);
    (d != null && d < 0 ? past : upcoming).push(e);
  }
  const key = (e: T) => parseDay(e.date) ?? Infinity;
  upcoming.sort((a, b) => key(a) - key(b));
  past.sort((a, b) => key(b) - key(a));
  return { upcoming, past };
}

export interface PlanStats<T> {
  open: number;
  overdue: number;
  dueToday: number;
  nextExam: T | null;
  nextExamDays: number | null;
}

/** Kennzahlen für den Kopf der Seite. */
export function stats<T extends PlanItem>(items: readonly T[], today: string): PlanStats<T> {
  const tasks = items.filter((i) => i.kind === "task");
  const exams = items.filter((i) => i.kind === "exam");
  const open = tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => { const d = daysUntil(t.date, today); return d != null && d < 0; }).length;
  const dueToday = open.filter((t) => daysUntil(t.date, today) === 0).length;
  const next = splitExams(exams, today).upcoming.find((e) => daysUntil(e.date, today) != null) || null;
  return { open: open.length, overdue, dueToday, nextExam: next, nextExamDays: next ? daysUntil(next.date, today) : null };
}

const byGerman = (a: string, b: string): number => {
  try { return a.localeCompare(b, "de"); } catch (_) { return a < b ? -1 : a > b ? 1 : 0; } // ohne Locale-Unterstützung
};

/** Fächer, die schon vorkommen (für die Vorschlagsliste im Formular). */
export function usedSubjects(items: ReadonlyArray<{ subject: string }>): string[] {
  return [...new Set(items.map((i) => i.subject).filter(Boolean))].sort(byGerman);
}

/**
 * Gast-Einträge ins Konto übernehmen (im Web in der Oberfläche, planer.js → offerImport):
 * Es passt nur so viel hinein, wie MAX_ITEMS erlaubt; die Einträge bekommen neue IDs, und die
 * Stapel-Verknüpfung entfällt, weil Stapel-IDs nur im Gast-Modus gelten.
 */
export function mergeGuestItems(current: readonly PlanItem[], guest: readonly PlanItem[], newId: () => string): { items: PlanItem[]; taken: number } {
  const room = Math.max(0, MAX_ITEMS - current.length);
  const take = guest.slice(0, room).map((i) => ({ ...i, id: newId(), deckId: "" }));
  return { items: [...current, ...take], taken: take.length };
}
