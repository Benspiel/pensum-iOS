/* Mindmap – Zeichenbeschreibung aus dem Layout (rein). Daraus entstehen die Bildschirmdarstellung (react-native-svg), der
 * PDF-Export (SVG-Text), das Seitenbild für Goodnotes und die Goodnotes-Stiftstriche. Die Zahlen stammen aus
 * Web tools/mindmap/mindmap.js (edgeWidth, textTop, handBaseline, handStroke, updateNodeView, drawToCanvas, buildGoodnotesFile). */
import * as H from './hand';
import { edgeLine, type LayoutNode, type MapLayout } from './layout';
import { faceOf, webWeightOf, type Face } from './measure';

export const INKS = [
  { id: '#0b5fc7', name: 'Blau' },
  { id: '#262626', name: 'Schwarz' },
  { id: '#0f6b4f', name: 'Grün' },
  { id: '#9b1c31', name: 'Rot' },
] as const;
export const DEFAULT_INK: string = INKS[0].id;
export const isInk = (value: unknown): value is string => INKS.some((ink) => ink.id === value);
/** Schwarze Schrift: weißes Blatt, auch im dunklen Modus (Web `.mm-canvas.is-paper`). */
export const isPaper = (ink: string): boolean => ink === '#262626';

export const edgeWidth = (depth: number): number => (depth <= 1 ? 3.2 : depth === 2 ? 2.2 : 1.6);
export const ROOT_STROKE = 2.5;
export const ROOT_FILL_OPACITY = 0.1;
/** Vertikaler Textanfang einer Beschriftung. */
export const textTop = (n: Pick<LayoutNode, 'h' | 'lines' | 'lineH'>): number => (n.h - n.lines.length * n.lineH) / 2;
/** Grundlinie der Handschrift in Zeile i. */
export const handBaseline = (n: Pick<LayoutNode, 'h' | 'lines' | 'lineH' | 'fontSize'>, i: number): number => textTop(n) + n.lineH * i + n.fontSize * 0.88;
export const handStroke = (n: Pick<LayoutNode, 'fontSize' | 'depth'>): number => Math.max(1.3, H.strokeWidth(n.fontSize) * (n.depth <= 1 ? 1.2 : 1.05));
/** Abstand der Grundlinie zur Zeilenmitte für Inter (Web: dominant-baseline central): (Ascent − Descent) / 2 = (0,969 − 0,241) / 2. */
export const BASELINE_SHIFT = 0.364;

export interface SceneText { kind: 'text'; text: string; x: number; y: number; baseline: number; size: number; face: Face; weight: number }
export interface SceneInk { kind: 'ink'; d: string; width: number; strokes: [number, number][][] }
export type SceneLine = SceneText | SceneInk;

export interface SceneNode {
  id: string;
  text: string;
  depth: number;
  root: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  hasKids: boolean;
  folded: boolean;
  hidden: number;
  lines: SceneLine[];
}
export interface SceneEdge { id: string; fromId: string; toId: string; width: number; depth: number }
export interface Scene { width: number; height: number; nodes: SceneNode[]; edges: SceneEdge[] }

/** Zeilen einer Beschriftung. Mit Handschrift Strichpfade, sofern sie jedes Zeichen der Zeile kennt, sonst Standardschrift. */
export function nodeLines(n: LayoutNode, hand: H.Hand | null): SceneLine[] {
  return n.lines.map((line, i): SceneLine => {
    if (hand && H.covers(hand, line)) {
      const lw = H.width(hand, line, n.fontSize);
      const x = (n.w - lw) / 2, baseline = handBaseline(n, i);
      return { kind: 'ink', d: H.pathData(hand, line, n.fontSize, x, baseline), width: handStroke(n), strokes: H.strokes(hand, line, n.fontSize, x, baseline) };
    }
    const y = textTop(n) + n.lineH * (i + 0.5);
    return { kind: 'text', text: line, x: n.w / 2, y, baseline: y + BASELINE_SHIFT * n.fontSize, size: n.fontSize, face: faceOf(n.depth), weight: webWeightOf(n.depth) };
  });
}

export function buildScene(lay: MapLayout, hand: H.Hand | null): Scene {
  return {
    width: lay.width,
    height: lay.height,
    nodes: lay.nodes.map((n) => ({
      id: n.id, text: n.text, depth: n.depth, root: n.depth === 0, x: n.x, y: n.y, w: n.w, h: n.h,
      hasKids: n.hasKids, folded: n.folded, hidden: n.hidden, lines: nodeLines(n, hand),
    })),
    edges: lay.edges.map((e) => ({ id: e.to.id, fromId: e.from.id, toId: e.to.id, width: edgeWidth(e.to.depth), depth: e.to.depth })),
  };
}

/* ---------- Bewegung (Web: renderMap/paintFrame – bestehende Beschriftungen gleiten, neue wachsen aus dem Elternknoten) ---------- */

export interface Pos { x: number; y: number }
export type Positions = ReadonlyMap<string, Pos & { w: number; h: number; depth: number }>;

export const ease = (t: number): number => 1 - Math.pow(1 - t, 3);
export const ANIMATION_MS = 380;

export interface Transition {
  start: Map<string, Pos>;
  /** Neu hinzugekommene Knoten (blenden ein, ihre Linie auch). */
  fresh: Set<string>;
  moves: boolean;
}

/** Startpositionen für den Übergang von der alten zur neuen Szene. Ohne `prev` (erste Anzeige) gibt es keine Bewegung. */
export function planTransition(prev: Positions | undefined, next: Scene): Transition {
  const start = new Map<string, Pos>();
  const fresh = new Set<string>();
  if (!prev || !prev.size) return { start, fresh, moves: false };
  const parentOf = new Map(next.edges.map((e) => [e.toId, e.fromId]));
  let moves = false;
  for (const n of next.nodes) {
    const old = prev.get(n.id);
    if (old) {
      start.set(n.id, { x: old.x, y: old.y });
      if (Math.abs(old.x - n.x) > 0.5 || Math.abs(old.y - n.y) > 0.5) moves = true;
    } else {
      const parent = prev.get(parentOf.get(n.id) ?? '');
      start.set(n.id, parent ? { x: parent.x + parent.w / 2 - n.w / 2, y: parent.y + parent.h / 2 - n.h / 2 } : { x: n.x, y: n.y });
      fresh.add(n.id);
    }
  }
  return { start, fresh, moves };
}

export interface Frame { positions: Map<string, Pos & { w: number; h: number; depth: number }>; alpha: (id: string) => number }

/** Zustand bei Fortschritt t (0…1). Bei t = 1 stehen alle Knoten auf ihrem Platz. */
export function frameAt(next: Scene, transition: Transition, t: number): Frame {
  const k = ease(Math.min(1, Math.max(0, t)));
  const positions = new Map<string, Pos & { w: number; h: number; depth: number }>();
  for (const n of next.nodes) {
    const s = transition.start.get(n.id) ?? { x: n.x, y: n.y };
    positions.set(n.id, { x: s.x + (n.x - s.x) * k, y: s.y + (n.y - s.y) * k, w: n.w, h: n.h, depth: n.depth });
  }
  return { positions, alpha: (id) => (transition.fresh.has(id) ? k : 1) };
}

export const restingPositions = (scene: Scene): Map<string, Pos & { w: number; h: number; depth: number }> =>
  new Map(scene.nodes.map((n) => [n.id, { x: n.x, y: n.y, w: n.w, h: n.h, depth: n.depth }]));

/** Linie einer Kante für gegebene Positionen als SVG-Pfad („M…L…“, wie Web edgePath); leer, wenn beide zu dicht liegen. */
export function edgePath(edge: SceneEdge, positions: Positions): string {
  const a = positions.get(edge.fromId), b = positions.get(edge.toId);
  if (!a || !b) return '';
  const l = edgeLine({ ...a }, { ...b });
  return l ? `M${l.x1.toFixed(1)} ${l.y1.toFixed(1)}L${l.x2.toFixed(1)} ${l.y2.toFixed(1)}` : '';
}

/* ---------- Eingerückter Knotenzugriff für Tastatur-/VoiceOver-Ersatz ---------- */

/** VoiceOver-Beschriftung: „Thema Beatles, Ebene 1“ / „Aufstieg, Ebene 2, eingeklappt, 2 verborgene Punkte“. */
export function nodeLabel(n: Pick<SceneNode, 'text' | 'depth' | 'hasKids' | 'folded' | 'hidden'>): string {
  const name = n.text.trim() || 'leerer Punkt';
  const parts = [n.depth === 0 ? `Thema ${name}` : name, `Ebene ${n.depth + 1}`];
  if (n.hasKids) parts.push(n.folded ? `eingeklappt, ${n.hidden} ${n.hidden === 1 ? 'verborgener Punkt' : 'verborgene Punkte'}` : 'ausgeklappt');
  return parts.join(', ');
}

/* ---------- Ausschnitt und Export ---------- */

/** Umschließendes Rechteck aller Beschriftungen (Thema-Ellipse samt Strich), plus pad. */
export function contentBounds(scene: Scene, pad = 0): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of scene.nodes) {
    const e = n.root ? ROOT_STROKE / 2 : 0;
    x0 = Math.min(x0, n.x - e); y0 = Math.min(y0, n.y - e); x1 = Math.max(x1, n.x + n.w + e); y1 = Math.max(y1, n.y + n.h + e);
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: scene.width, h: scene.height };
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}

const f1 = (n: number) => n.toFixed(1);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
const STD_FONT = "Inter, -apple-system, 'Helvetica Neue', Arial, sans-serif";

/** Die Karte als eigenständiges SVG (weißer Grund), zugeschnitten auf den Inhalt plus pad. Für den PDF-Export. */
export function sceneToSvg(scene: Scene, ink: string, pad = 24): { svg: string; width: number; height: number } {
  const b = contentBounds(scene, pad);
  const rest = restingPositions(scene);
  const edges = scene.edges.map((e) => {
    const d = edgePath(e, rest);
    return d ? `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${e.width}" stroke-linecap="round"/>` : '';
  }).join('');
  const nodes = scene.nodes.map((n) => {
    const shape = n.root
      ? `<ellipse cx="${f1(n.w / 2)}" cy="${f1(n.h / 2)}" rx="${f1(n.w / 2)}" ry="${f1(n.h / 2)}" fill="${ink}" fill-opacity="${ROOT_FILL_OPACITY}" stroke="${ink}" stroke-width="${ROOT_STROKE}"/>`
      : '';
    const lines = n.lines.map((line) => line.kind === 'ink'
      ? `<path d="${line.d}" fill="none" stroke="${ink}" stroke-width="${line.width.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<text x="${f1(line.x)}" y="${f1(line.baseline)}" text-anchor="middle" font-size="${line.size}" font-weight="${line.weight}" fill="${ink}">${esc(line.text)}</text>`).join('');
    return `<g transform="translate(${f1(n.x)} ${f1(n.y)})">${shape}${lines}</g>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f1(b.x)} ${f1(b.y)} ${f1(b.w)} ${f1(b.h)}" width="${f1(b.w)}" height="${f1(b.h)}" font-family="${STD_FONT}">${edges}${nodes}</svg>`;
  return { svg, width: b.w, height: b.h };
}

const A4: readonly [number, number] = [595.28, 841.89];

/** HTML und Seitengröße (Punkte) für expo-print: A4, quer bei breiter Karte, Rand 28 pt, zentriert (Web exportPdfFile). */
export function pdfDocument(scene: Scene, ink: string): { html: string; width: number; height: number } {
  const { svg, width, height } = sceneToSvg(scene, ink, 24);
  const landscape = width >= height;
  const [pw, ph] = landscape ? [A4[1], A4[0]] : A4;
  const m = 28;
  const k = Math.min((pw - 2 * m) / width, (ph - 2 * m) / height);
  const w = width * k, h = height * k;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:0}html,body{margin:0;padding:0;background:#fff}` +
    `.page{position:absolute;left:${((pw - w) / 2).toFixed(2)}pt;top:${((ph - h) / 2).toFixed(2)}pt;width:${w.toFixed(2)}pt;height:${h.toFixed(2)}pt}.page svg{width:100%;height:100%;display:block}</style></head><body><div class="page">${svg}</div></body></html>`;
  return { html, width: Math.round(pw), height: Math.round(ph) };
}

/* ---------- Goodnotes ---------- */

export interface GoodnotesPlacement { s: number; ox: number; oy: number }
export const GN_PAGE = { w: 595.28, h: 841.89, margin: 28, scale: 11 / 6 } as const;

/** Eine A4-Seite (Hochformat), Karte eingepasst und zentriert (Web buildGoodnotesFile). */
export function goodnotesPlacement(scene: Pick<Scene, 'width' | 'height'>): GoodnotesPlacement {
  const s = Math.min((GN_PAGE.w - 2 * GN_PAGE.margin) / scene.width, (GN_PAGE.h - 2 * GN_PAGE.margin) / scene.height);
  return { s, ox: (GN_PAGE.w - scene.width * s) / 2, oy: (GN_PAGE.h - scene.height * s) / 2 };
}

export interface GoodnotesStroke { pts: [number, number][]; width: number }

/** Stiftstriche der Karte in PDF-Punkten, oder null, wenn eine Zeile nicht in Handschrift gesetzt werden kann (dann geht die Karte als Bild). */
export function goodnotesStrokes(scene: Scene): GoodnotesStroke[] | null {
  if (!scene.nodes.every((n) => n.lines.every((line) => line.kind === 'ink'))) return null;
  const { s, ox, oy } = goodnotesPlacement(scene);
  const P = (x: number, y: number): [number, number] => [ox + x * s, oy + y * s];
  const out: GoodnotesStroke[] = [];
  const rest = restingPositions(scene);
  for (const e of scene.edges) {
    const a = rest.get(e.fromId), b = rest.get(e.toId);
    if (!a || !b) continue;
    const l = edgeLine({ ...a }, { ...b });
    if (!l) continue;
    const mid: [number, number] = [(l.x1 + l.x2) / 2, (l.y1 + l.y2) / 2];
    out.push({ pts: [P(l.x1, l.y1), P(mid[0], mid[1]), P(l.x2, l.y2)], width: e.width * s * GN_PAGE.scale });
  }
  for (const n of scene.nodes) {
    if (n.root) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        pts.push(P(n.x + n.w / 2 + Math.cos(a) * n.w / 2, n.y + n.h / 2 + Math.sin(a) * n.h / 2));
      }
      out.push({ pts, width: ROOT_STROKE * s * GN_PAGE.scale });
    }
    for (const line of n.lines) {
      if (line.kind !== 'ink') continue;
      for (const st of line.strokes) out.push({ pts: st.map(([x, y]) => P(n.x + x, n.y + y)), width: line.width * s * GN_PAGE.scale });
    }
  }
  return out;
}

/** Flache Zeichenliste (absolute Koordinaten) für das Seitenbild in der Engine-WebView. */
export interface DrawList {
  width: number;
  height: number;
  edges: { x1: number; y1: number; x2: number; y2: number; width: number }[];
  nodes: { root: boolean; x: number; y: number; w: number; h: number; texts: { t: string; x: number; y: number; size: number; weight: number }[]; inks: { d: string; width: number }[] }[];
}

export function drawList(scene: Scene): DrawList {
  const rest = restingPositions(scene);
  const edges: DrawList['edges'] = [];
  for (const e of scene.edges) {
    const a = rest.get(e.fromId), b = rest.get(e.toId);
    const l = a && b ? edgeLine({ ...a }, { ...b }) : null;
    if (l) edges.push({ ...l, width: e.width });
  }
  return {
    width: scene.width,
    height: scene.height,
    edges,
    nodes: scene.nodes.map((n) => ({
      root: n.root, x: n.x, y: n.y, w: n.w, h: n.h,
      texts: n.lines.flatMap((line) => (line.kind === 'text' ? [{ t: line.text, x: line.x, y: line.y, size: line.size, weight: line.weight }] : [])),
      inks: n.lines.flatMap((line) => (line.kind === 'ink' ? [{ d: line.d, width: line.width }] : [])),
    })),
  };
}
