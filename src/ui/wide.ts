/* Breite Ansicht (iPad): Inhaltsbreite und Spaltenzahl. Reine Rechenregeln ohne React Native.
 * Telefon: eine Spalte bis 760 pt wie bisher. iPad: der Inhalt darf bis 1120 pt breit werden,
 * die Werkzeug-Kacheln stehen in 2 (Hochformat) oder 3 Spalten (Querformat). Große Schrift (Dynamic Type > 1,25) bleibt einspaltig. */

export const NARROW_CONTENT_MAX = 760;
export const WIDE_CONTENT_MAX = 1120;
/** Ab dieser Fensterbreite (pt) darf ein Screen mit `wide` die große Inhaltsbreite nutzen (iPad Hochformat ab 744 pt: 2 Spalten, ab 900 größer). */
export const WIDE_LAYOUT_MIN = 900;

/** Höchstbreite des Inhalts. `wide` ist die Zustimmung des Screens, breiter als eine Lesespalte zu werden. */
export function contentMaxWidth(windowWidth: number, wide: boolean): number {
  return wide && windowWidth >= WIDE_LAYOUT_MIN ? WIDE_CONTENT_MAX : NARROW_CONTENT_MAX;
}

/** Nutzbare Inhaltsbreite zwischen den Seitenrändern. */
export function innerWidth(windowWidth: number, sideInsets: number, gutter: number, wide: boolean): number {
  const available = Math.max(0, windowWidth - sideInsets);
  return Math.max(0, Math.min(contentMaxWidth(windowWidth, wide), available) - 2 * gutter);
}

export interface ToolGrid { columns: 1 | 2 | 3; gap: number; tileWidth: number | undefined; }

/** Raster der Werkzeug-Kacheln auf der Startseite. `tileWidth` ist bei einer Spalte undefined (volle Breite). */
export function toolGrid(inner: number, fontScale: number, gap: number): ToolGrid {
  const columns = fontScale > 1.25 ? 1 : inner >= 1000 ? 3 : inner >= 640 ? 2 : 1;
  return { columns, gap, tileWidth: columns === 1 ? undefined : Math.floor((inner - gap * (columns - 1)) / columns) };
}
