import assert from 'node:assert/strict';
import test from 'node:test';
import * as H from '../hand';
import { layout, STYLE, HAND_STYLE } from '../layout';
import { measureInter, measureWithHand, faceOf } from '../measure';
import * as C from '../scene';
import * as T from '../tree';

const must = <V,>(value: V | null | undefined): V => { assert.ok(value); return value; };

/* Gepacktes Profil: ganzzahlig in 1/1000 Geviert, { a: Vorschub, s: Striche als flache x,y-Listen } */
const packed = {
  v: 1,
  glyphs: {
    a: { a: 500, s: [[0, 0, 500, 0]] },
    b: { a: 600, s: [[0, 0, 300, 400, 600, 0]] },
    '"': { a: 300, s: [[100, 0, 100, 200], [200, 0, 200, 200]] },
    '.': { a: 200, s: [[100, 500]] },
  },
};

/* ---------- Handschrift ---------- */

test('unpackHand: Vorschub, Strichpunkte und zweimalige Chaikin-Glättung wie ink-engine.js', () => {
  const hand = H.unpackHand(packed);
  assert.deepEqual(Object.keys(hand.glyphs).sort(), ['"', '.', 'a', 'b']);
  assert.equal(hand.glyphs.a!.adv, 0.5);
  assert.deepEqual(hand.glyphs.a!.strokes, [[[0, 0], [0.5, 0]]]); // 2 Punkte bleiben unverändert
  assert.equal(hand.glyphs.b!.strokes[0]!.length, 12); // 3 → 6 → 12
  assert.deepEqual(hand.glyphs.b!.strokes[0]![0], [0, 0]); // Endpunkte bleiben stehen
  assert.deepEqual(hand.glyphs.b!.strokes[0]!.at(-1), [0.6, 0]);
  assert.equal(H.chaikin([[0, 0], [4, 0]]).length, 4);
  assert.deepEqual(H.chaikin([[0, 0], [4, 0]]), [[0, 0], [1, 0], [3, 0], [4, 0]]);
});

test('unpackHand/usableHand: kaputte Daten ergeben keine Handschrift', () => {
  for (const bad of [null, undefined, 5, 'x', {}, { glyphs: null }, { glyphs: { a: null, b: { a: 'x', s: [] }, c: { a: 5, s: 'x' } } }]) {
    assert.equal(H.usableHand(bad), null);
  }
  assert.ok(H.usableHand(packed));
});

test('pathData: Pfad in Pixeln, Leerzeichen und fehlende Zeichen verschieben den Stift', () => {
  const hand = H.unpackHand(packed);
  assert.equal(H.pathData(hand, 'a', 10, 5, 20), 'M5 20L10 20');
  // „a a“: a (0,5·10) + Leerzeichen (0,32·10) → zweites a beginnt bei 5 + 5 + 3,2
  assert.equal(H.pathData(hand, 'a a', 10, 5, 20), 'M5 20L10 20M13.2 20L18.2 20');
  // Punkt aus einem einzigen Punkt bekommt h0.1
  assert.equal(H.pathData(hand, '.', 10, 0, 0), 'M1 5h0.1');
  // unbekanntes Zeichen „z“: Vorschub 0,45
  assert.equal(H.pathData(hand, 'za', 10, 0, 0), 'M4.5 0L9.5 0');
  assert.equal(H.pathData(hand, '', 10, 0, 0), '');
});

test('Zeichenzuordnung: Alias, Groß-/Kleinschreibung und Akzente', () => {
  const hand = H.unpackHand(packed);
  assert.equal(H.covers(hand, 'a b'), true);
  assert.equal(H.covers(hand, 'A'), true); // Kleinbuchstabe als Ersatz
  assert.equal(H.covers(hand, 'á'), true); // á → a
  assert.equal(H.covers(hand, '„a“'), true); // typografische Anführungszeichen → "
  assert.equal(H.covers(hand, 'abc'), false);
  assert.equal(H.covers(null, 'a'), false);
  assert.equal(H.covers(hand, '   '), true);
  assert.equal(H.pathData(hand, 'A', 10, 0, 0), H.pathData(hand, 'a', 10, 0, 0));
});

test('width, strokeWidth und strokes', () => {
  const hand = H.unpackHand(packed);
  assert.ok(Math.abs(H.width(hand, 'a a', 10) - (5 + 3.2 + 5)) < 1e-9);
  assert.ok(Math.abs(H.strokeWidth(20) - 1.5) < 1e-9);
  const st = H.strokes(hand, 'ab', 10, 2, 8);
  assert.equal(st.length, 2);
  assert.deepEqual(st[0], [[2, 8], [7, 8]]);
  assert.equal(st[1]![0]![0], 7); // b beginnt nach dem Vorschub von a
});

/* ---------- Messung ---------- */

test('measureInter: plausible Breiten, SemiBold breiter als Regular, unbekannte Zeichen', () => {
  const regular = measureInter('Mindmap erstellen', 16, 2), semibold = measureInter('Mindmap erstellen', 16, 1);
  assert.ok(regular > 100 && regular < 160, String(regular));
  assert.ok(semibold > regular);
  assert.equal(faceOf(0), 'semibold');
  assert.equal(faceOf(1), 'semibold');
  assert.equal(faceOf(2), 'regular');
  assert.equal(measureInter('', 16, 2), 0);
  assert.ok(Math.abs(measureInter('日本', 10, 2) - 20) < 1e-9);
  assert.ok(Math.abs(measureInter('؀', 10, 2) - 6) < 1e-9);
  assert.ok(Math.abs(measureInter('iiii', 10, 2) * 2 - measureInter('iiiiiiii', 10, 2)) < 1e-9);
});

test('measureWithHand: Handbreite, sonst Standardschrift (ganze Zeile)', () => {
  const hand = H.unpackHand(packed);
  const m = measureWithHand(hand);
  assert.equal(m('aa', 10, 1), H.width(hand, 'aa', 10));
  assert.equal(m('abc', 10, 1), measureInter('abc', 10, 1));
});

/* ---------- Szene ---------- */

const tree = () => must(T.sanitize({ id: 'r', text: 'Thema', children: [
  { id: 'a', text: 'Ast eins', children: [{ id: 'a1', text: 'Unterpunkt', children: [{ id: 'a11', text: 'Tief' }] }] },
  { id: 'b', text: 'Ast zwei' },
] }));
const std = (collapsed: string[] = []) => C.buildScene(layout(tree(), measureInter, STYLE, new Set(collapsed)), null);

test('Kantenbreiten, Schriftschnitt und Zeilenposition wie im Web', () => {
  assert.deepEqual([1, 2, 3, 4].map(C.edgeWidth), [3.2, 2.2, 1.6, 1.6]);
  const scene = std();
  assert.deepEqual(scene.edges.map((e) => [e.toId, e.width]), [['a', 3.2], ['b', 3.2], ['a1', 2.2], ['a11', 1.6]].sort((x, y) => scene.edges.findIndex((e) => e.toId === x[0]) - scene.edges.findIndex((e) => e.toId === y[0])));
  const root = must(scene.nodes.find((n) => n.root));
  const line = must(root.lines[0]);
  assert.equal(line.kind, 'text');
  if (line.kind === 'text') {
    assert.equal(line.face, 'semibold');
    assert.equal(line.size, 24);
    assert.equal(line.weight, 650);
    assert.equal(line.x, root.w / 2);
    assert.ok(Math.abs(line.baseline - (line.y + 0.364 * 24)) < 1e-9);
    assert.ok(Math.abs(line.y - root.h / 2) < 1e-9, 'eine Zeile liegt in der Mitte');
  }
  const deep = must(scene.nodes.find((n) => n.id === 'a11')).lines[0]!;
  assert.equal(deep.kind === 'text' && deep.face, 'regular');
  assert.equal(deep.kind === 'text' && deep.weight, 450);
});

test('Handschrift: Strichpfade, Grundlinie, Strichbreite; Zeile ohne Buchstaben bleibt Standardschrift', () => {
  const hand = H.unpackHand(packed);
  const lay = layout(must(T.sanitize({ id: 'r', text: 'aa', children: [{ id: 'x', text: 'abz' }] })), measureWithHand(hand), HAND_STYLE);
  const scene = C.buildScene(lay, hand);
  const root = must(scene.nodes.find((n) => n.root));
  const ink = must(root.lines[0]);
  assert.equal(ink.kind, 'ink');
  if (ink.kind === 'ink') {
    const n = must(lay.nodes.find((x) => x.id === 'r'));
    assert.ok(ink.d.startsWith('M'));
    assert.ok(Math.abs(ink.width - Math.max(1.3, 0.075 * 46 * 1.2)) < 1e-9);
    const baseline = n.h / 2 - n.lineH / 2 + n.fontSize * 0.88;
    assert.ok(Math.abs(C.handBaseline(n, 0) - baseline) < 1e-9);
    assert.equal(ink.strokes.length, 2);
  }
  assert.equal(must(scene.nodes.find((n) => n.id === 'x')).lines[0]!.kind, 'text', 'z fehlt in der Handschrift');
  assert.equal(C.goodnotesStrokes(scene), null, 'dann geht der Goodnotes-Export als Bild');
});

test('Barrierefreiheit: Beschriftung mit Ebene und Einklappzustand', () => {
  assert.equal(C.nodeLabel({ text: 'Beatles', depth: 0, hasKids: true, folded: false, hidden: 0 }), 'Thema Beatles, Ebene 1, ausgeklappt');
  assert.equal(C.nodeLabel({ text: 'Aufstieg', depth: 1, hasKids: true, folded: true, hidden: 2 }), 'Aufstieg, Ebene 2, eingeklappt, 2 verborgene Punkte');
  assert.equal(C.nodeLabel({ text: 'x', depth: 2, hasKids: true, folded: true, hidden: 1 }), 'x, Ebene 3, eingeklappt, 1 verborgener Punkt');
  assert.equal(C.nodeLabel({ text: ' ', depth: 2, hasKids: false, folded: false, hidden: 0 }), 'leerer Punkt, Ebene 3');
  const scene = std(['a']);
  const a = must(scene.nodes.find((n) => n.id === 'a'));
  assert.equal(a.folded, true);
  assert.equal(a.hidden, 2);
  assert.equal(scene.nodes.some((n) => n.id === 'a1'), false);
});

test('Bewegung: neue Knoten wachsen aus dem Elternknoten und blenden ein, alte gleiten', () => {
  const before = std(['a']);
  const after = std();
  const t = C.planTransition(C.restingPositions(before), after);
  assert.deepEqual([...t.fresh].sort(), ['a1', 'a11']);
  const parent = must(C.restingPositions(before).get('a'));
  const a1 = must(after.nodes.find((n) => n.id === 'a1'));
  assert.ok(Math.abs(must(t.start.get('a1')).x - (parent.x + parent.w / 2 - a1.w / 2)) < 1e-9);
  const f0 = C.frameAt(after, t, 0), f1 = C.frameAt(after, t, 1), b = must(after.nodes.find((n) => n.id === 'b'));
  assert.equal(f0.alpha('a1'), 0);
  assert.equal(f0.alpha('b'), 1);
  assert.equal(f1.alpha('a1'), 1);
  for (const n of after.nodes) { assert.equal(f1.positions.get(n.id)!.x, n.x); assert.equal(f1.positions.get(n.id)!.y, n.y); }
  assert.equal(C.ease(0), 0);
  assert.equal(C.ease(1), 1);
  const first = C.planTransition(undefined, after);
  assert.equal(first.moves, false);
  assert.equal(first.fresh.size, 0);
  assert.equal(C.frameAt(after, first, 0).positions.get('b')!.x, b.x);
});

test('Kantenpfad: gerade Linie, leer bei dichten Kästen', () => {
  const scene = std();
  const rest = C.restingPositions(scene);
  for (const e of scene.edges) assert.match(C.edgePath(e, rest), /^M-?\d+\.\d L-?\d+\.\d$|^M-?\d+\.\d+ -?\d+\.\dL-?\d+\.\d+ -?\d+\.\d$/);
  const e = must(scene.edges[0]);
  const overlapped = new Map(rest);
  const from = must(rest.get(e.fromId));
  overlapped.set(e.toId, { ...from });
  assert.equal(C.edgePath(e, overlapped), '');
  assert.equal(C.edgePath(e, new Map()), '');
});

test('Ausschnitt und Export: SVG enthält Ellipse, Text, Pfade; PDF-Seite A4 quer bzw. hoch', () => {
  const scene = std();
  const b = C.contentBounds(scene, 24);
  assert.ok(b.w < scene.width && b.h <= scene.height + 48);
  const { svg } = C.sceneToSvg(scene, '#0b5fc7');
  assert.match(svg, /<ellipse/);
  assert.match(svg, /<text[^>]*font-weight="650"[^>]*>Thema<\/text>/);
  assert.equal((svg.match(/<path /g) ?? []).length, scene.edges.length);
  const evil = C.sceneToSvg(C.buildScene(layout(must(T.sanitize({ text: '<b>&"x"</b>' })), measureInter), null), '#262626').svg;
  assert.ok(!evil.includes('<b>') && evil.includes('&lt;b&gt;&amp;&quot;x&quot;'));
  const pdf = C.pdfDocument(scene, '#0b5fc7');
  const wide = pdf.width > pdf.height;
  assert.equal(wide, b.w >= b.h);
  assert.ok(pdf.html.includes('<svg') && pdf.html.startsWith('<!doctype html>'));
  const tall = C.pdfDocument(C.buildScene(layout(must(T.sanitize({ text: 'T', children: [{ text: 'x' }] })), () => 8), null), '#000');
  assert.ok(tall.width > 0);
});

test('Goodnotes: Platzierung, Stiftstriche (nur mit voller Handschrift), Zeichenliste', () => {
  const place = C.goodnotesPlacement({ width: 1000, height: 500 });
  assert.ok(Math.abs(place.s - (595.28 - 56) / 1000) < 1e-9);
  assert.ok(Math.abs(place.ox - 28) < 1e-9);
  assert.ok(place.oy > 28);
  assert.equal(C.goodnotesStrokes(std()), null);
  const hand = H.unpackHand(packed);
  const lay = layout(must(T.sanitize({ id: 'r', text: 'ab', children: [{ id: 'x', text: 'a' }] })), measureWithHand(hand), HAND_STYLE);
  const scene = C.buildScene(lay, hand);
  const strokes = must(C.goodnotesStrokes(scene));
  // Thema-Ellipse (49 Punkte) + 1 Kante (3 Punkte) + Striche von „ab“ (2) + „a“ (1)
  assert.equal(strokes.length, 1 + 1 + 2 + 1);
  assert.equal(strokes.filter((s) => s.pts.length === 49).length, 1);
  for (const s of strokes) for (const [x, y] of s.pts) assert.ok(x >= 0 && x <= 595.28 && y >= 0 && y <= 841.89);
  const list = C.drawList(std());
  assert.equal(list.nodes.length, 5);
  assert.equal(list.edges.length, 4);
  assert.equal(list.nodes.every((n) => n.inks.length === 0 && n.texts.length >= 1), true);
  assert.equal(C.drawList(scene).nodes[0]!.inks.length, 1);
});

test('Tinten: vier Farben wie im Web, Schwarz = Papier', () => {
  assert.deepEqual(C.INKS.map((i) => i.id), ['#0b5fc7', '#262626', '#0f6b4f', '#9b1c31']);
  assert.equal(C.DEFAULT_INK, '#0b5fc7');
  assert.equal(C.isPaper('#262626'), true);
  assert.equal(C.isPaper('#0b5fc7'), false);
  assert.equal(C.isInk('#9b1c31'), true);
  assert.equal(C.isInk('red'), false);
});
