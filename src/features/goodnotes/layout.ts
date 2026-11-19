const MIN_EDITOR_WIDTH = 440;
const MIN_PREVIEW_WIDTH = 220;

/** Höchstbreite des Handschrift-Blatts auf dem iPad. */
export const HAND_PAD_MAX_WIDTH = 720;
/** Kürzeste Fensterseite (pt), ab der ein Tablet-Fenster gilt. */
export const TABLET_SHORT_SIDE = 600;

/** Tablet-Fenster: kurze Seite ≥ 600 pt und Schrift höchstens 1,25 (sonst bleibt das Telefon-Blatt). */
export function isTabletWindow(width: number, height: number, fontScale: number): boolean {
  return Math.min(width, height) >= TABLET_SHORT_SIDE && fontScale <= 1.25;
}

/** Die Vorschau erscheint neben dem Editor nur, wenn beide ausreichend Platz haben. */
export function previewColumns(inner: number, windowHeight: number, fontScale: number) {
  const gap = inner >= 960 ? 40 : 16;
  const columnSpace = inner - gap;
  const maxPreview = columnSpace - MIN_EDITOR_WIDTH;
  if (maxPreview < MIN_PREVIEW_WIDTH || windowHeight < 540 || fontScale > 1.25) return undefined;
  const preferredPreview = Math.round(columnSpace * 1.05 / 2.05);
  const preview = Math.min(maxPreview, Math.max(MIN_PREVIEW_WIDTH, preferredPreview));
  return { preview, editor: columnSpace - preview, gap };
}

export function optionColumns(width: number, fontScale: number, sectionInset: number): { fonts: number; papers: number } {
  const inner = (width - 2 * sectionInset) / Math.max(1, fontScale);
  return { fonts: inner >= 360 ? 3 : 2, papers: inner >= 420 ? 4 : 2 };
}

/**
 * Höhe des Zeichenfelds. Telefon: 220. Tablet: wächst mit dem Fenster, sodass das Blatt (Kopf, Hinweis, Knöpfe, Zeichenleiste) ohne Scrollen
 * hineinpasst – die WebView darf nicht in einem Scroll-Container liegen, sonst konkurrieren Strich und Scrollgeste.
 */
export function handPadHeight(windowHeight: number, tablet: boolean): number {
  if (!tablet) return 220;
  return Math.max(220, Math.min(420, Math.round(windowHeight * 0.96 - 540)));
}
