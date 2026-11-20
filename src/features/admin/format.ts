/* Team – reine Hilfen für die Diagramme (Vorlage: tools/admin/core.js der Website). */

export type Count = number | null;

/** 1234 → "1.234"; fehlende Zahl → "–". */
export const fmt = (n: Count | undefined): string => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('de-DE') : '–');

/** Anteil von part an whole in Prozent (0 bis 100, ganzzahlig); ohne Basis 0. */
export function pct(part: Count | undefined, whole: Count | undefined): number {
  if (typeof part !== 'number' || typeof whole !== 'number' || !Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

/** Wochentag-Kürzel eines Datums JJJJ-MM-TT ("2026-11-19" → "Do"). */
export function weekday(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? '' : (['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getUTCDay()] ?? '');
}

/** Höhen der Balken in Prozent des höchsten Werts (kleinster sichtbarer Balken 4 %, ohne Besuche 0 %). */
export function barHeights(values: readonly Count[]): number[] {
  const finite = values.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0));
  const max = Math.max(0, ...finite);
  return finite.map((v) => (v <= 0 || max <= 0 ? 0 : Math.max(4, Math.round((v / max) * 100))));
}

/** "heute", "gestern", "vor 3 Tagen" für ein Datum JJJJ-MM-TT, bezogen auf today. */
export function dayAgo(day: string | null, today: string): string {
  if (!day) return '';
  const a = Date.parse(`${day}T12:00:00Z`);
  const b = Date.parse(`${today}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return '';
  const n = Math.round((b - a) / 86400000);
  return n <= 0 ? 'heute' : n === 1 ? 'gestern' : `vor ${n} Tagen`;
}

/** Heutiges Datum JJJJ-MM-TT in Berliner Zeit. */
export const berlinToday = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/** Uhrzeit der Antwort als „14:05“. */
export function clock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
