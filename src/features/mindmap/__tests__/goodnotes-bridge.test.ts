import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { MINDMAP_BRIDGE_JS, parseMindmapMessage, type MindmapGoodnotesRequest } from '../goodnotes-bridge';
import { HAND_STYLE, layout } from '../layout';
import { measureWithHand } from '../measure';
import { unpackHand } from '../hand';
import { buildScene, drawList, goodnotesPlacement, goodnotesStrokes } from '../scene';
import * as T from '../tree';

test('parseMindmapMessage: gültige Nachrichten, alles andere ergibt null', () => {
  assert.deepEqual(parseMindmapMessage('{"type":"mm-ready"}'), { type: 'mm-ready' });
  assert.deepEqual(parseMindmapMessage('{"type":"mm-exported","id":"mm1","file":"AAAA"}'), { type: 'mm-exported', id: 'mm1', file: 'AAAA' });
  assert.deepEqual(parseMindmapMessage('{"type":"mm-error","id":"mm1","message":"kaputt"}'), { type: 'mm-error', id: 'mm1', message: 'kaputt' });
  assert.deepEqual(parseMindmapMessage('{"type":"mm-error","id":"mm1"}'), { type: 'mm-error', id: 'mm1', message: 'Unbekannter Fehler.' });
  for (const bad of [null, 5, '', '{kaputt', '[]', '{"type":"ready"}', '{"type":"mm-exported","id":"x"}', '{"type":"mm-exported","id":"x","file":""}', '{"type":"mm-exported","file":"A"}']) {
    assert.equal(parseMindmapMessage(bad), null);
  }
});

/* Das eingespielte Skript läuft hier gegen eine nachgebaute Seite (ohne echte Engine); mit der echten Engine wurde es im Browser geprüft. */
function harness(buildSinglePage: (page: unknown, strokes: unknown, ink: string) => Promise<Blob>) {
  const listeners: ((event: { data: string }) => void)[] = [];
  const posted: Record<string, unknown>[] = [];
  const calls: { canvas: { width: number; height: number; ops: string[] }; strokes: unknown; ink: string }[] = [];
  const ctx = (ops: string[]) => new Proxy({}, {
    get: (_t, key: string) => (...args: unknown[]) => { ops.push(`${key}(${args.map((a) => (typeof a === 'number' ? Math.round(a * 100) / 100 : typeof a)).join(',')})`); },
    set: (_t, key: string, value) => { ops.push(`${key}=${String(value)}`); return true; },
  });
  const window = {
    ReactNativeWebView: { postMessage: (m: string) => posted.push(JSON.parse(m)) },
    addEventListener: (_: string, fn: (event: { data: string }) => void) => listeners.push(fn),
  };
  const document = {
    addEventListener: () => {},
    createElement: () => {
      const ops: string[] = [];
      return { width: 0, height: 0, ops, getContext: () => ctx(ops) };
    },
  };
  const createInkEngine = () => ({
    buildSinglePage: (page: { width: number; height: number; ops: string[] }, strokes: unknown, ink: string) => {
      calls.push({ canvas: page, strokes, ink });
      return buildSinglePage(page, strokes, ink);
    },
  });
  class FileReader {
    result = ''; onload: () => void = () => {}; onerror: () => void = () => {};
    readAsDataURL() { this.result = 'data:application/octet-stream;base64,QUJD'; this.onload(); }
  }
  runInNewContext(MINDMAP_BRIDGE_JS, { window, document, createInkEngine, FileReader, Path2D: class {}, JSON, Math, String, Promise });
  const send = (message: unknown) => { for (const l of listeners) l({ data: typeof message === 'string' ? message : JSON.stringify(message) }); };
  return { posted, calls, send, listeners };
}

const request = (id: string, withHand: boolean): MindmapGoodnotesRequest => {
  const hand = unpackHand({ v: 1, glyphs: { a: { a: 500, s: [[0, 0, 500, 0]] }, b: { a: 500, s: [[0, 0, 500, 100]] } } });
  const tree = T.sanitize({ id: 'r', text: 'ab', children: [{ id: 'x', text: 'ba' }] })!;
  const scene = buildScene(layout(tree, measureWithHand(hand), HAND_STYLE), withHand ? hand : null);
  return { type: 'mm-goodnotes', id, draw: drawList(scene), ink: '#0b5fc7', place: goodnotesPlacement(scene), strokes: goodnotesStrokes(scene) };
};

test('Brücke meldet Bereitschaft, ignoriert Fremdes und baut eine Datei über buildSinglePage', async () => {
  const h = harness(async () => new Blob(['x']));
  assert.deepEqual(h.posted, [{ type: 'mm-ready' }]);
  h.send({ type: 'render', id: 'gn1', text: 'x' }); // Nachricht der Goodnotes-Brücke bleibt unberührt
  h.send('{kaputt');
  h.send({ type: 'mm-goodnotes' }); // ohne id
  await new Promise((r) => setImmediate(r));
  assert.equal(h.calls.length, 0);

  const req = request('mm1', true);
  assert.ok(req.strokes && req.strokes.length > 0);
  h.send(req);
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(h.posted.at(-1), { type: 'mm-exported', id: 'mm1', file: 'QUJD' });
  const call = h.calls[0]!;
  assert.equal(call.canvas.width, 1654);
  assert.equal(call.canvas.height, Math.round(841.89 * (1654 / 595.28)));
  assert.deepEqual(call.strokes, JSON.parse(JSON.stringify(req.strokes)));
  assert.equal(call.ink, '#0b5fc7');
  assert.ok(call.canvas.ops.some((op) => op.startsWith('setTransform(')));
  assert.ok(call.canvas.ops.some((op) => op.startsWith('ellipse(')), 'Thema als Ellipse');
});

test('Brücke: Standardschrift ohne Striche zeichnet Text, Fehler der Engine kommen als mm-error zurück', async () => {
  let fail = false;
  const h = harness(async () => { if (fail) throw new Error('Engine kaputt'); return new Blob(['x']); });
  const std = request('mm2', false);
  assert.equal(std.strokes, null);
  h.send(std);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(h.calls[0]!.strokes, null);
  assert.ok(h.calls[0]!.canvas.ops.some((op) => op.startsWith('fillText(')));
  fail = true;
  h.send(request('mm3', false));
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(h.posted.at(-1), { type: 'mm-error', id: 'mm3', message: 'Engine kaputt' });
});

test('Brücke hängt genau einen Nachrichten-Empfänger an', () => {
  const h = harness(async () => new Blob(['x']));
  assert.equal(h.listeners.length, 1);
});
