/* Mindmap – .goodnotes-Export über die lokale Engine-WebView des Goodnotes-Tools.
 * Die Engine (src/features/goodnotes/engine, host-html.generated.ts) wird unverändert wiederverwendet. Weil ihre Brücke (host-bridge.js)
 * nur Text-Anfragen kennt, ergänzt dieses Skript über `injectedJavaScript` eine zweite Nachrichtenart („mm-goodnotes“): Es zeichnet
 * die Karte auf eine A4-Leinwand und ruft `buildSinglePage` der Engine auf – dieselbe Funktion wie im Web (mindmap.js, buildGoodnotesFile).
 * Die Engine-Dateien und das Goodnotes-Tool bleiben unverändert. Protokoll rein, damit es ohne Gerät testbar ist. */
import type { DrawList, GoodnotesPlacement, GoodnotesStroke } from './scene';

export interface MindmapGoodnotesRequest {
  type: 'mm-goodnotes';
  id: string;
  draw: DrawList;
  ink: string;
  place: GoodnotesPlacement;
  /** Stiftstriche in PDF-Punkten (nur mit vollständiger Handschrift), sonst null = die Karte wird als Seitenbild eingebettet. */
  strokes: GoodnotesStroke[] | null;
}

export type MindmapGoodnotesMessage =
  | { type: 'mm-ready' }
  | { type: 'mm-exported'; id: string; file: string }
  | { type: 'mm-error'; id: string; message: string };

export function parseMindmapMessage(raw: unknown): MindmapGoodnotesMessage | null {
  let m: any;
  try { m = typeof raw === 'string' ? JSON.parse(raw) : null; } catch { return null; }
  if (!m || typeof m !== 'object') return null;
  if (m.type === 'mm-ready') return { type: 'mm-ready' };
  if (m.type === 'mm-exported' && typeof m.id === 'string' && typeof m.file === 'string' && m.file) return { type: 'mm-exported', id: m.id, file: m.file };
  if (m.type === 'mm-error' && typeof m.id === 'string') return { type: 'mm-error', id: m.id, message: typeof m.message === 'string' && m.message ? m.message : 'Unbekannter Fehler.' };
  return null;
}

/** Wird nach dem Laden der Engine-Seite eingespielt. Erwartet die globale Funktion createInkEngine und window.ReactNativeWebView. */
export const MINDMAP_BRIDGE_JS = `(function () {
  if (window.__mindmapBridge) return;
  window.__mindmapBridge = true;
  var PAGE_W = 595.28, PAGE_H = 841.89, BITMAP_W = 1654;
  var STD_FONT = '-apple-system, "Helvetica Neue", Arial, sans-serif';
  var post = function (message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); };
  var engine = createInkEngine();

  function toBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(blob);
    });
  }

  function drawPage(m) {
    var px = BITMAP_W / PAGE_W;
    var page = document.createElement('canvas');
    page.width = BITMAP_W;
    page.height = Math.round(PAGE_H * px);
    var c = page.getContext('2d');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, page.width, page.height);
    c.setTransform(px * m.place.s, 0, 0, px * m.place.s, m.place.ox * px, m.place.oy * px);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = m.ink;
    m.draw.edges.forEach(function (e) {
      c.lineWidth = e.width;
      c.beginPath(); c.moveTo(e.x1, e.y1); c.lineTo(e.x2, e.y2); c.stroke();
    });
    m.draw.nodes.forEach(function (n) {
      if (n.root) {
        c.beginPath();
        c.ellipse(n.x + n.w / 2, n.y + n.h / 2, n.w / 2, n.h / 2, 0, 0, Math.PI * 2);
        c.globalAlpha = 0.1; c.fillStyle = m.ink; c.fill(); c.globalAlpha = 1;
        c.lineWidth = 2.5; c.strokeStyle = m.ink; c.stroke();
      }
      n.texts.forEach(function (t) {
        c.font = t.weight + ' ' + t.size + 'px ' + STD_FONT;
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = m.ink;
        c.fillText(t.t, n.x + t.x, n.y + t.y);
      });
      n.inks.forEach(function (ink) {
        c.save(); c.translate(n.x, n.y);
        c.lineWidth = ink.width; c.strokeStyle = m.ink;
        c.stroke(new Path2D(ink.d));
        c.restore();
      });
    });
    return page;
  }

  async function run(m) {
    try {
      var blob = await engine.buildSinglePage(drawPage(m), m.strokes, m.ink);
      post({ type: 'mm-exported', id: m.id, file: await toBase64(blob) });
    } catch (error) {
      post({ type: 'mm-error', id: m.id, message: String((error && error.message) || error) });
    }
  }

  var queue = Promise.resolve();
  function onMessage(event) {
    var m;
    try { m = JSON.parse(event.data); } catch (e) { return; }
    if (!m || m.type !== 'mm-goodnotes' || typeof m.id !== 'string') return;
    queue = queue.then(function () { return run(m); });
  }
  document.addEventListener('message', onMessage);
  window.addEventListener('message', onMessage);
  post({ type: 'mm-ready' });
})();
true;`;
