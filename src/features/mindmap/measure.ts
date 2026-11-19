/* Mindmap – Textmessung ohne Canvas.
 * Das Web misst mit canvas.measureText in „Inter Variable“ (Gewichte 650/600/450). In der App gibt es keine Canvas-Messung;
 * stattdessen werden die Vorschubbreiten der gebündelten statischen Inter-Schnitte addiert (inter-widths.generated.ts, aus den
 * Schriftdateien erzeugt). Kerning und Ligaturen fehlen, typisch weicht die Breite damit um unter 1,5 % ab (siehe docs/b-mindmap.md).
 * Angezeigt wird in genau diesen Schnitten (Regular für Ebene ≥ 2, SemiBold für Thema und Hauptäste), also misst die Schätzung
 * die Schrift, die wirklich erscheint. */
import { fontFamilies } from '../../theme/tokens';
import { covers, width as handWidth, type Hand } from './hand';
import type { Measure } from './layout';
import { INTER_WIDTHS } from './inter-widths.generated';

export type Face = 'regular' | 'semibold';

/** Web: Thema 650, Hauptast 600, tiefere Ebenen 450. App: SemiBold (≙ 600/650) bzw. Regular (≙ 400/450). */
export const faceOf = (depth: number): Face => (depth <= 1 ? 'semibold' : 'regular');
export const familyOf = (face: Face): string => fontFamilies[face];
/** Gewicht für die Systemschrift im Export (Druck-WebView hat kein Inter) – wie im Web 650/600/450. */
export const webWeightOf = (depth: number): number => (depth === 0 ? 650 : depth === 1 ? 600 : 450);

const isWide = (cp: number) => (cp >= 0x2e80 && cp <= 0xffef) || cp >= 0x1f000;

/** Breite eines Textes in Inter bei Schriftgröße `size`. Unbekannte Zeichen: 0,6 em, CJK und Emoji 1 em. */
export function measureInter(text: string, size: number, depth: number): number {
  const table = INTER_WIDTHS[faceOf(depth)];
  let units = 0;
  for (const ch of String(text)) {
    const known = table[ch];
    units += known ?? (isWide(ch.codePointAt(0) ?? 0) ? 1000 : 600);
  }
  return (units / 1000) * size;
}

/** Zeichen, die in der eigenen Handschrift fehlen, werden in Standardschrift gesetzt (die ganze Zeile), sonst würden sie fehlen. */
export const measureWithHand = (hand: Hand): Measure => (text, size, depth) => (covers(hand, text) ? handWidth(hand, text, size) : measureInter(text, size, depth));
