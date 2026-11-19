/* Goodnotes – Layout-Entscheidungen für breite Fenster (iPad). Reine Funktionen ohne React Native, deshalb testbar.
 * Web-Vorlage: tools/goodnotes/goodnotes.css (.gn-split: links Vorschau, rechts Einstellungen). Telefon bleibt einspaltig. */

/** Gewichte der beiden Spalten (Vorschau : Einstellungen). */
export const PREVIEW_WEIGHT = 6;
export const SETTINGS_WEIGHT = 4;
/** Abstand zwischen den Spalten in pt. */
export const COLUMN_GAP = 32;
/** Innenabstand plus Rand eines Panels (Card: padding 24, Rand 1) je Seite. */
export const PANEL_INSET = 25;

/** Höchstbreite des Handschrift-Blatts auf dem iPad. */
export const HAND_PAD_MAX_WIDTH = 720;
/** Kürzeste Fensterseite (pt), ab der ein Tablet-Fenster gilt. */
export const TABLET_SHORT_SIDE = 600;

/** Tablet-Fenster: kurze Seite ≥ 600 pt und Schrift höchstens 1,25 (sonst bleibt das Telefon-Blatt). */
export function isTabletWindow(width: number, height: number, fontScale: number): boolean {
  return Math.min(width, height) >= TABLET_SHORT_SIDE && fontScale <= 1.25;
}

/** Breiten (pt) der beiden Spalten bei der nutzbaren Inhaltsbreite `inner`. */
export function splitColumnWidths(inner: number, gap: number = COLUMN_GAP): { preview: number; settings: number } {
  const free = Math.max(0, inner - gap);
  const preview = Math.floor((free * PREVIEW_WEIGHT) / (PREVIEW_WEIGHT + SETTINGS_WEIGHT));
  return { preview, settings: free - preview };
}

/**
 * Spaltenzahl der Kachelraster (Schrift, Papier). Einspaltig wie bisher nach Fensterbreite (Telefon unverändert);
 * in der schmalen Einstellungsspalte nach deren Breite abzüglich Panel-Rand.
 */
export function optionColumns(windowWidth: number, split: boolean, settingsWidth: number): { fonts: number; papers: number } {
  if (!split) return { fonts: windowWidth >= 480 ? 3 : 2, papers: windowWidth >= 480 ? 4 : 2 };
  const inner = settingsWidth - 2 * PANEL_INSET;
  return { fonts: inner >= 320 ? 3 : 2, papers: inner >= 440 ? 4 : 2 };
}

/**
 * Höhe des Zeichenfelds. Telefon: 220. Tablet: wächst mit dem Fenster, sodass das Blatt (Kopf, Hinweis, Knöpfe, Zeichenleiste) ohne Scrollen
 * hineinpasst – die WebView darf nicht in einem Scroll-Container liegen, sonst konkurrieren Strich und Scrollgeste.
 */
export function handPadHeight(windowHeight: number, tablet: boolean): number {
  if (!tablet) return 220;
  return Math.max(220, Math.min(420, Math.round(windowHeight * 0.96 - 540)));
}
