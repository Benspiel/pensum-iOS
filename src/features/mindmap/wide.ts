/* Mindmap auf dem iPad: reine Rechenregeln für die breite Ansicht (ohne React Native, getestet in __tests__/wide.test.ts).
 * Telefon und schmale Fenster (< 900 pt) behalten die bisherige Höhe und eine Spalte. */
import { fitZoom } from './state';

/** Gewichte der beiden Spalten im Editor: Karte : Seitenleiste ungefähr 6 : 4. */
export const MAP_COLUMN_WEIGHTS = { primary: 6, secondary: 4 } as const;

/** Breite eines einzelnen Panels, das allein in der breiten Ansicht stünde (z. B. „Mindmap für heute erstellen.“ ohne Liste): wie das Web-Panel `.mm-gate`. */
export const SOLO_PANEL_MAX = 560;

/** Breite der Kartenspalte (flex-Anteil der Gesamtbreite nach Abzug des Spaltenabstands). */
export function mapColumnWidth(inner: number, gap: number): number {
  const { primary, secondary } = MAP_COLUMN_WEIGHTS;
  return Math.max(0, Math.floor(((inner - gap) * primary) / (primary + secondary)));
}

export interface MapSize { sceneWidth: number; sceneHeight: number; canvasWidth: number }

const WIDE_MIN = 440;
const WIDE_MAX = 900;
const WIDE_SHARE = 0.8;
const FIT_PADDING = 24;

/**
 * Höhe der Zeichenfläche.
 * Telefon: 55 % der Fensterhöhe zwischen 340 und 560 pt (wie bisher).
 * Breit (iPad quer): höchstens 80 % der Fensterhöhe (zwischen 440 und 900 pt). Ist die Karte bekannt, wird die Fläche nicht höher,
 * als die eingepasste Karte braucht (Einpassen richtet sich nach der Breite; sonst bliebe oben und unten leerer Platz).
 */
export function canvasHeightFor(windowHeight: number, split: boolean, map?: MapSize): number {
  const height = Number.isFinite(windowHeight) && windowHeight > 0 ? windowHeight : 0;
  if (!split) return Math.round(Math.min(560, Math.max(340, height * 0.55)));
  const cap = Math.round(Math.min(WIDE_MAX, Math.max(WIDE_MIN, height * WIDE_SHARE)));
  if (!map || !(map.sceneWidth > 0) || !(map.sceneHeight > 0) || !(map.canvasWidth > 0)) return cap;
  const zoom = fitZoom(map.sceneWidth, map.sceneHeight, map.canvasWidth, Number.MAX_SAFE_INTEGER);
  const needed = Math.ceil(map.sceneHeight * zoom) + FIT_PADDING;
  return Math.min(cap, Math.max(WIDE_MIN, needed));
}

/** Höchstbreite eines Panels: nur ein Panel, das in der breiten Ansicht allein steht, wird begrenzt. */
export function soloPanelMaxWidth(split: boolean, hasSecondary: boolean): number | undefined {
  return split && !hasSecondary ? SOLO_PANEL_MAX : undefined;
}
