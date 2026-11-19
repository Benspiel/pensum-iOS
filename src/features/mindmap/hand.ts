/* Mindmap – eigene Handschrift als Strichpfade (rein, ohne React/Expo).
 * Web-Quelle: tools/mindmap/hand.js (SVG-Pfade aus den Glyphen) und tools/goodnotes/ink-engine.js (unpackHand, chaikin),
 * Web-Commit 1612dc2. Gelesen wird das gepackte Profil aus der Tabelle „handwriting“ (src/features/goodnotes/hand-store.ts);
 * nichts wird hochgeladen oder zusätzlich gespeichert. */

export type Point = readonly [number, number];
export interface Glyph { adv: number; strokes: Point[][] }
export interface Hand { glyphs: Record<string, Glyph> }

const SPACE = 0.32; // Breite eines Leerzeichens (wie im Goodnotes-Tool)
const MISSING = 0.45; // Vorschub für nicht gezeichnete Zeichen
const STROKE = 0.075; // Strichbreite in Geviert-Einheiten
const ALIAS: Record<string, string> = { '„': '"', '“': '"', '”': '"', '«': '"', '»': '"', '‚': "'", '‘': "'", '’': "'", '–': '-', '—': '-', '•': '.' };

/** Chaikin-Glättung (ein Durchgang), Endpunkte bleiben stehen (ink-engine.js chaikin). */
export function chaikin(pts: readonly Point[]): Point[] {
  const out: Point[] = [pts[0]!];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i]!, [bx, by] = pts[i + 1]!;
    out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** Gepackte Handschrift (ganzzahlig, 1/1000 Geviert; { glyphs: { zeichen: { a, s } } }) → Laufzeitformat mit geglätteten Strichen. */
export function unpackHand(data: unknown): Hand {
  const glyphs: Record<string, Glyph> = {};
  const source = data && typeof data === 'object' ? (data as { glyphs?: unknown }).glyphs : undefined;
  if (!source || typeof source !== 'object') return { glyphs };
  for (const [ch, raw] of Object.entries(source)) {
    if (!raw || typeof raw !== 'object') continue;
    const g = raw as { a?: unknown; s?: unknown };
    if (typeof g.a !== 'number' || !Array.isArray(g.s)) continue;
    glyphs[ch] = {
      adv: g.a / 1000,
      strokes: g.s.map((flat: unknown) => {
        const list = Array.isArray(flat) ? flat : [];
        let pts: Point[] = [];
        for (let i = 0; i + 1 < list.length; i += 2) pts.push([Number(list[i]) / 1000, Number(list[i + 1]) / 1000]);
        if (pts.length > 2) pts = chaikin(chaikin(pts));
        return pts;
      }),
    };
  }
  return { glyphs };
}

/** Nur Handschriften mit mindestens einem Zeichen sind brauchbar. */
export function usableHand(packed: unknown): Hand | null {
  const hand = unpackHand(packed);
  return Object.keys(hand.glyphs).length ? hand : null;
}

function glyph(hand: Hand, ch: string): Glyph | null {
  const g = hand.glyphs;
  if (g[ch]) return g[ch]!;
  const alt = ALIAS[ch] || (ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase());
  if (g[alt]) return g[alt]!;
  const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, ''); // é -> e, ñ -> n
  return base !== ch ? g[base] || g[base.toLowerCase()] || g[base.toUpperCase()] || null : null;
}

/** Hat die Handschrift für jedes Zeichen des Textes einen Buchstaben? */
export const covers = (hand: Hand | null, text: string): boolean => !!hand && [...String(text)].every((ch) => !ch.trim() || !!glyph(hand, ch));

const advance = (hand: Hand, ch: string): number => (ch.trim() ? (glyph(hand, ch) || { adv: MISSING }).adv : SPACE);

/** Breite eines Textes in Pixeln bei Schriftgröße size. */
export function width(hand: Hand, text: string, size: number): number {
  let w = 0;
  for (const ch of String(text)) w += advance(hand, ch);
  return w * size;
}

export const strokeWidth = (size: number): number => STROKE * size;

/** SVG-Pfad (d) für den Text; x = linker Rand, baseline = Grundlinie. */
export function pathData(hand: Hand, text: string, size: number, x: number, baseline: number): string {
  const f = (n: number) => Math.round(n * 10) / 10;
  let pen = x, d = '';
  for (const ch of String(text)) {
    const g = ch.trim() ? glyph(hand, ch) : null;
    if (g) {
      for (const pts of g.strokes) {
        if (!pts.length) continue;
        d += `M${f(pen + pts[0]![0] * size)} ${f(baseline + pts[0]![1] * size)}`;
        if (pts.length === 1) d += 'h0.1';
        for (let i = 1; i < pts.length; i++) d += `L${f(pen + pts[i]![0] * size)} ${f(baseline + pts[i]![1] * size)}`;
      }
    }
    pen += advance(hand, ch) * size;
  }
  return d;
}

/** Wie pathData, aber als Punktlisten je Strich ([[x, y], …][]) – für den Goodnotes-Export. */
export function strokes(hand: Hand, text: string, size: number, x: number, baseline: number): [number, number][][] {
  const out: [number, number][][] = [];
  let pen = x;
  for (const ch of String(text)) {
    const g = ch.trim() ? glyph(hand, ch) : null;
    if (g) for (const pts of g.strokes) if (pts.length) out.push(pts.map(([px, py]) => [pen + px * size, baseline + py * size] as [number, number]));
    pen += advance(hand, ch) * size;
  }
  return out;
}
