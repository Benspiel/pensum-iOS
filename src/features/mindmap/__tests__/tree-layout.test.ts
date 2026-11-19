/* Port von Web tests/mindmap.test.mjs (Baum und Layout, Erwartungswerte unverändert).
 * Die Function-Tests des Web (functions/mindmap/lib.js) betreffen den Server und gehören nicht in die App. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { edgeLine, layout, wrap, STYLE, clampFontScale, scaleStyle, HAND_STYLE } from '../layout';
import * as T from '../tree';

const must = <V,>(value: V | null | undefined): V => { assert.ok(value); return value; };
const sample = () => must(T.sanitize({ text: 'Thema', children: [{ text: 'A', children: [{ text: 'A1' }, { text: 'A2' }] }, { text: 'B' }] }));
const texts = (n: T.MindmapNode): string[] => [n.text, ...n.children.flatMap(texts)];

/* ---------- Baum ---------- */

test('sanitize: leere Knoten fallen weg, Grenzen gelten, IDs sind eindeutig', () => {
  const wide = { text: 'W', children: Array.from({ length: 30 }, (_, i) => ({ text: 'k' + i })) };
  assert.equal(must(T.sanitize(wide)).children.length, T.MAP.children);
  assert.equal(T.sanitize({ text: '  ' }), null);
  assert.equal(T.sanitize('x'), null);
  const r = must(T.sanitize({ text: 'x'.repeat(200), children: [{ text: '' }, { text: 'ok' }, null] }));
  assert.equal(r.text.length, T.MAP.text);
  assert.deepEqual(r.children.map((c) => c.text), ['ok']);
  const dup = must(T.sanitize({ id: 'a', text: 'r', children: [{ id: 'a', text: 'c' }] }));
  assert.notEqual(dup.id, dup.children[0]!.id);
  let deep: unknown = { text: 'd' };
  for (let i = 0; i < 20; i++) deep = { text: 'd', children: [deep] };
  assert.equal(T.countNodes(must(T.sanitize(deep))), T.MAP.depth + 1);
});

test('sanitize: höchstens 80 Knoten insgesamt', () => {
  const big = { text: 'r', children: Array.from({ length: 10 }, (_, i) => ({ text: 'a' + i, children: Array.from({ length: 10 }, (_, j) => ({ text: `b${i}${j}`, children: [{ text: 'c' }, { text: 'd' }] })) })) };
  assert.equal(T.countNodes(must(T.sanitize(big))), T.MAP.nodes);
});

test('parse: kaputtes JSON ergibt null, gültiges einen Baum', () => {
  assert.equal(T.parse('{kaputt'), null);
  assert.equal(must(T.parse('{"text":"T","children":[{"text":"x"}]}')).children[0]!.text, 'x');
});

test('Bearbeiten verändert das Original nie und wählt den richtigen Knoten', () => {
  const root = sample();
  const before = JSON.stringify(root);
  const a = root.children[0]!;

  const child = T.addChild(root, a.id, 'Neu');
  assert.equal(JSON.stringify(root), before);
  assert.deepEqual(texts(must(child.root)), ['Thema', 'A', 'A1', 'A2', 'Neu', 'B']);
  assert.equal(must(T.find(must(child.root), must(child.selectId))).node.text, 'Neu');

  const sib = T.addSibling(root, a.id, 'Zwischen');
  assert.deepEqual(must(sib.root).children.map((c) => c.text), ['A', 'Zwischen', 'B']);
  assert.match(String(T.addSibling(root, root.id).error), /Thema/);

  assert.deepEqual(must(T.move(root, a.id, 1).root).children.map((c) => c.text), ['B', 'A']);
  assert.equal(T.move(root, a.id, -1).error, null); // schon ganz oben: nichts zu tun, kein Fehler
  assert.ok(T.remove(root, root.id).error); // das Thema bleibt
  const removed = T.remove(root, a.id);
  assert.deepEqual(texts(must(removed.root)), ['Thema', 'B']);
  assert.equal(must(T.find(must(removed.root), must(removed.selectId))).node.text, 'B');

  assert.ok(T.rename(root, root.id, '  ').error); // Thema nie leer
  assert.equal(must(T.rename(root, a.id, 'A neu').root).children[0]!.text, 'A neu');
});

test('Bearbeiten respektiert Knoten-, Tiefen- und Kinderlimit', () => {
  let root = must(T.sanitize({ text: 'r' }));
  for (let i = 0; i < T.MAP.children; i++) root = must(T.addChild(root, root.id).root);
  assert.match(String(T.addChild(root, root.id).error), /höchstens/);
  let chain = must(T.sanitize({ text: 'r' })), id = chain.id;
  for (let i = 0; i < T.MAP.depth; i++) { const r = T.addChild(chain, id); chain = must(r.root); id = must(r.selectId); }
  assert.match(String(T.addChild(chain, id).error), /Ebenen/);
});

test('Einklapp-Hilfen: ancestors, autoCollapse, branchIds', () => {
  const root = sample();
  const a1 = root.children[0]!.children[0]!;
  assert.deepEqual(T.ancestors(root, a1.id), [root.id, root.children[0]!.id]);
  assert.deepEqual(T.ancestors(root, 'gibt-es-nicht'), []);
  assert.deepEqual([...T.autoCollapse(root)], []);
  assert.deepEqual(T.branchIds(root), [root.children[0]!.id]);
  const big = must(T.sanitize({ text: 'r', children: Array.from({ length: 6 }, (_, i) => ({ text: 'a' + i, children: Array.from({ length: 4 }, (_, j) => ({ text: `b${i}${j}`, children: [{ text: 'c' }, { text: 'd' }] })) })) }));
  const set = T.autoCollapse(big);
  assert.equal(set.size, 24);
  for (const id of set) assert.equal(must(T.find(big, id)).depth, 2);
});

test('formatTree rückt ein', () => {
  assert.equal(T.formatTree(sample()), 'Thema\n  • A\n    • A1\n    • A2\n  • B');
});

/* ---------- Layout ---------- */

const measure = (s: string, size = 14) => s.length * size * 0.55;

const sampleBig = () => must(T.sanitize({ text: 'Beatles', children: [
  { text: 'Musikalische Entwicklung', children: [{ text: 'Einflussreiche Alben' }, { text: 'Neue Techniken' }, { text: "Frühe Rock-'n'-Roll-Einflüsse" }] },
  { text: 'Einfluss für die Gesellschaft', children: [{ text: 'Jugendkultur der 1960er' }, { text: 'Mode & Lifestyle' }, { text: 'Friedensbewegung' }] },
  { text: 'Aufstieg', children: [{ text: 'Durchbruch in Großbritannien' }, { text: 'erste Erfolge in Hamburg' }] },
  { text: 'Nachwirkungen', children: [{ text: 'Einfluss in Rock- und Popmusik' }, { text: 'Kulturikonen' }, { text: 'bis heute Kultstatus' }] },
  { text: 'Das Ende', children: [{ text: 'Trennung umstritten' }, { text: 'Soloprojekte' }, { text: 'Offizielle Trennung 1970' }, { text: 'Spannung innerhalb der Band' }] },
  { text: 'Mitglieder & Entstehung', children: [{ text: 'George Harrison' }, { text: 'Ringo Starr' }, { text: 'John Lennon', children: [{ text: 'Gitarre' }, { text: 'Gesang' }] }, { text: 'Paul McCartney' }, { text: 'Ursprünge in Liverpool' }] },
] }));

test('wrap: bricht an Wortgrenzen und trennt zu lange Wörter', () => {
  const m = (s: string) => s.length * 8;
  assert.deepEqual(wrap('ein kurzer Satz hier', m, 100), ['ein kurzer', 'Satz hier']);
  const lines = wrap('Donaudampfschifffahrt', m, 80);
  assert.ok(lines.length > 1 && lines.every((l) => m(l) <= 80));
  assert.deepEqual(wrap('', m, 80), ['']);
  // nach Bindestrichen darf umgebrochen werden, Wörter bleiben heil
  const hy = wrap("Frühe Rock-'n'-Roll-Einflüsse", m, 120);
  assert.ok(hy.length > 1 && hy.every((l) => m(l) <= 120) && hy.join('').replace(/\s/g, '') === "FrüheRock-'n'-Roll-Einflüsse", JSON.stringify(hy));
  assert.ok(!hy.some((l) => /^sse/.test(l)), 'Einflüsse bleibt ganz');
});

const apart = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;

test('layout: Thema in der Mitte, Hauptäste rundherum, Unterpunkte außen, nichts überlappt', () => {
  const root = sampleBig();
  const lay = layout(root, measure);
  const by = Object.fromEntries(lay.nodes.map((n) => [n.text, n]));
  const t = must(by['Beatles']);
  const cx = (n: { x: number; w: number }) => n.x + n.w / 2, cy = (n: { y: number; h: number }) => n.y + n.h / 2;
  const dist = (n: typeof t) => Math.hypot(cx(n) - cx(t), cy(n) - cy(t));

  // Hauptäste verteilen sich auf alle vier Seiten des Themas
  const mains = lay.nodes.filter((n) => n.depth === 1);
  assert.equal(mains.length, 6);
  assert.ok(mains.some((n) => cx(n) < cx(t)) && mains.some((n) => cx(n) > cx(t)), 'links und rechts');
  assert.ok(mains.some((n) => cy(n) < cy(t)) && mains.some((n) => cy(n) > cy(t)), 'oben und unten');
  // Unterpunkte liegen weiter außen als ihr Hauptast
  for (const [p, c] of [['Aufstieg', 'Durchbruch in Großbritannien'], ['Das Ende', 'Soloprojekte'], ['John Lennon', 'Gitarre']] as const) {
    assert.ok(dist(must(by[c])) > dist(must(by[p])), `${c} liegt nicht außen`);
  }
  // keine Überlappung zwischen zwei Beschriftungen und kein Hauptast im Thema
  for (const a of lay.nodes) for (const b of lay.nodes) {
    if (a === b) continue;
    assert.ok(apart(a, b), `${a.text} überlappt ${b.text}`);
  }
  // alles liegt im positiven Bereich der Zeichenfläche
  for (const n of lay.nodes) assert.ok(n.x >= 0 && n.y >= 0 && n.x + n.w <= lay.width && n.y + n.h <= lay.height);
  assert.equal(lay.edges.length, T.countNodes(root) - 1);
  assert.deepEqual(lay.nodes[0]!.id, root.id);
  assert.equal(lay.nodes[0]!.depth, 0);
});

test('layout: bleibt bei gleicher Eingabe gleich und bewältigt große Karten', () => {
  const a = JSON.stringify(layout(sampleBig(), measure).nodes.map((n) => [n.text, Math.round(n.x), Math.round(n.y)]));
  const b = JSON.stringify(layout(sampleBig(), measure).nodes.map((n) => [n.text, Math.round(n.x), Math.round(n.y)]));
  assert.equal(a, b);
  const big = must(T.sanitize({ text: 'r', children: Array.from({ length: 8 }, (_, i) => ({ text: 'Ast ' + i, children: Array.from({ length: 4 }, (_, j) => ({ text: `Punkt ${i}.${j}`, children: [{ text: 'Detail a' }, { text: 'Detail b' }] })) })) }));
  const t0 = Date.now();
  const lay = layout(big, measure);
  assert.ok(Date.now() - t0 < 1500, 'Layout zu langsam');
  for (const x of lay.nodes) for (const y of lay.nodes) {
    if (x === y) continue;
    assert.ok(apart(x, y), `${x.text} überlappt ${y.text}`);
  }
});

test('layout: eingeklappte Äste verbergen ihre Unterpunkte, einzelne Äste und nur das Thema gehen', () => {
  const root = sampleBig();
  const aufstieg = root.children[2]!;
  const lay = layout(root, measure, STYLE, new Set([aufstieg.id]));
  const hit = must(lay.nodes.find((n) => n.id === aufstieg.id));
  assert.ok(hit.folded && hit.hidden === 2);
  assert.ok(!lay.nodes.some((n) => n.text === 'erste Erfolge in Hamburg'));
  assert.equal(lay.nodes.length, T.countNodes(root) - 2);
  assert.equal(layout(must(T.sanitize({ text: 'T' })), measure).nodes.length, 1);
  const one = layout(must(T.sanitize({ text: 'T', children: [{ text: 'x' }] })), measure);
  assert.equal(one.nodes.length, 2);
  assert.ok(one.nodes[1]!.x > one.nodes[0]!.x + one.nodes[0]!.w - 1, 'ein einzelner Ast liegt rechts');
});

test('edgeLine: gerade Linie zwischen den Rändern, nicht durch den Text, bei zu dichten Kästen keine', () => {
  const a = { x: 0, y: 0, w: 100, h: 40, depth: 1 }, b = { x: 300, y: 0, w: 100, h: 40, depth: 1 };
  const e = must(edgeLine(a, b, 7));
  assert.ok(Math.abs(e.x1 - 107) < 1e-6 && Math.abs(e.x2 - 293) < 1e-6 && Math.abs(e.y1 - 20) < 1e-6 && Math.abs(e.y2 - 20) < 1e-6);
  const diag = must(edgeLine(a, { x: 300, y: 300, w: 100, h: 40, depth: 2 }, 7));
  assert.ok(diag.x1 > 50 && diag.y1 > 20 && diag.x2 < 350 && diag.y2 < 320);
  const ell = must(edgeLine({ x: 0, y: 0, w: 200, h: 100, depth: 0 }, { x: 400, y: 35, w: 60, h: 30, depth: 1 }, 0));
  assert.ok(Math.abs(ell.x1 - 200) < 1e-6, 'Rand der Ellipse'); // Mitte 100, Halbachse 100
  assert.equal(edgeLine({ x: 0, y: 0, w: 100, h: 40, depth: 1 }, { x: 105, y: 0, w: 100, h: 40, depth: 1 }), null);
  assert.equal(edgeLine(a, a), null);
});

/* ---------- Ergänzungen der App ---------- */

test('Dynamic Type: Skalierung nur bis 1,3 und nur für Schriftgrößen', () => {
  assert.equal(clampFontScale(0.8), 1);
  assert.equal(clampFontScale(2), 1.3);
  assert.equal(clampFontScale(Number.NaN), 1);
  assert.equal(scaleStyle(STYLE, 1), STYLE);
  const scaled = scaleStyle(STYLE, 1.3);
  assert.deepEqual(scaled.maxW, STYLE.maxW);
  assert.ok(Math.abs(scaled.sizes[0]! - 31.2) < 1e-9);
  const big = layout(sampleBig(), measure, scaleStyle(HAND_STYLE, 1.3));
  assert.ok(big.width > 0 && big.nodes.length === T.countNodes(sampleBig()));
});
