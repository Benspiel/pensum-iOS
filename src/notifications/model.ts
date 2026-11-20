/* Push-Benachrichtigungen – reine Modelle (ohne Expo), damit sie testbar bleiben.
 * Pro Gerät liegt eine Zeile in `push_devices` (Besitzer = Konto): Token plus die gewählten Erinnerungen.
 * Die Function `push-daily` (Appwrite, stündlich) sendet zur gewählten Stunde (Europe/Berlin) über den Expo-Push-Dienst. */

export type PushPrefs = { cards: boolean; cardsHour: number; mindmap: boolean; mindmapHour: number };

export const DEFAULT_PUSH_PREFS: PushPrefs = { cards: true, cardsHour: 17, mindmap: false, mindmapHour: 8 };

export const clampHour = (hour: number): number => (Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.round(hour))) : 0);

/** Eine Stunde weiter oder zurück, über Mitternacht hinweg. */
export const stepHour = (hour: number, dir: 1 | -1): number => (clampHour(hour) + dir + 24) % 24;

export const hourLabel = (hour: number): string => `${String(clampHour(hour)).padStart(2, '0')}:00 Uhr`;

/** Zeilen-ID aus dem SHA-256 des Tokens: stabil je Gerät, nur erlaubte Zeichen, höchstens 36 Zeichen. */
export const deviceRowId = (tokenHashHex: string): string => `d${tokenHashHex.replace(/[^0-9a-f]/gi, '').slice(0, 35).toLowerCase()}`;

type Row = { cards?: unknown; cardsHour?: unknown; mindmap?: unknown; mindmapHour?: unknown };

export function prefsFromRow(row: Row): PushPrefs {
  return {
    cards: row.cards === true,
    cardsHour: typeof row.cardsHour === 'number' ? clampHour(row.cardsHour) : DEFAULT_PUSH_PREFS.cardsHour,
    mindmap: row.mindmap === true,
    mindmapHour: typeof row.mindmapHour === 'number' ? clampHour(row.mindmapHour) : DEFAULT_PUSH_PREFS.mindmapHour,
  };
}

export function summary(prefs: PushPrefs | null): string {
  if (!prefs || (!prefs.cards && !prefs.mindmap)) return 'Aus';
  return [prefs.cards ? 'Karteikarten' : '', prefs.mindmap ? 'Mindmap' : ''].filter(Boolean).join(' · ');
}
