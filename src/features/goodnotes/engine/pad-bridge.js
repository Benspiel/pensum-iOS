/* Zeichenfeld für die eigene Handschrift (läuft in der Pad-WebView, neben der Engine createInkEngine()).
 * Logik aus tools/goodnotes/goodnotes.js (Abschnitt „Handschrift zeichnen“, Web-Commit 770dbe4): Koordinaten in Geviert-Einheiten,
 * Ursprung Grundlinie, Striche sind schon Mittellinien. Bedienung (Weiter, Zurück, Rückgängig, …) kommt per Nachricht aus der App.
 * Nachrichten: siehe ../protocol.ts (PadRequest / PadMessage). */
const post = (m) => window.ReactNativeWebView.postMessage(JSON.stringify(m));
const engine = createInkEngine();
const CH = engine.HAND_CHARS, HAND_W = engine.HAND_W;
const PAD_BASE = 0.7, PAD_EM = 0.5;
const pad = { draft: {}, idx: 0, drawing: null, ink: "#1d3f9e" };
const c = document.getElementById("pad");
const ctx = c.getContext("2d");

function sizePad() {
  const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  c.width = Math.max(1, Math.round(r.width * dpr));
  c.height = Math.max(1, Math.round(r.height * dpr));
  drawPad();
}
const padEm = () => c.height * PAD_EM;
const padOrigin = () => [c.width * 0.3, c.height * PAD_BASE];

function drawPad() {
  const em = padEm(), [ox, oy] = padOrigin();
  ctx.clearRect(0, 0, c.width, c.height);
  const line = (yEm, color, dash) => {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, em * 0.008); ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(0, oy + yEm * em); ctx.lineTo(c.width, oy + yEm * em); ctx.stroke(); ctx.restore();
  };
  line(-0.72, "#e0e0e0", [em * 0.04, em * 0.04]);
  line(-0.42, "#adadad", [em * 0.04, em * 0.04]);
  line(0, "#707070");
  line(0.28, "#e0e0e0", [em * 0.04, em * 0.04]);
  const ch = CH[pad.idx];
  const strokes = pad.draft[ch] || [];
  if (!strokes.length) { ctx.save(); ctx.fillStyle = "#f0f0f0"; ctx.font = `400 ${em}px "Caveat", cursive`; ctx.fillText(ch, ox, oy); ctx.restore(); }
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = pad.ink; ctx.lineWidth = HAND_W * em; ctx.lineCap = ctx.lineJoin = "round";
  for (const st of strokes) {
    if (st.length === 1) { ctx.beginPath(); ctx.arc(ox + st[0][0] * em, oy + st[0][1] * em, HAND_W * em / 2, 0, 7); ctx.fill(); continue; }
    ctx.beginPath();
    st.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * em, oy + y * em) : ctx.moveTo(ox + x * em, oy + y * em)));
    ctx.stroke();
  }
  ctx.restore();
}

const has = (ch) => !!(pad.draft[ch] && pad.draft[ch].length);
function emitState() {
  const done = CH.map(has);
  post({ type: "pad-state", idx: pad.idx, char: CH[pad.idx], total: CH.length, done, doneCount: done.filter(Boolean).length, current: has(CH[pad.idx]) });
}
function update() { drawPad(); emitState(); }

function padPoint(e) {
  const r = c.getBoundingClientRect(), em = padEm(), [ox, oy] = padOrigin();
  const x = (e.clientX - r.left) * (c.width / r.width), y = (e.clientY - r.top) * (c.height / r.height);
  return [(x - ox) / em, (y - oy) / em];
}

function packHand() {
  const glyphs = {};
  for (const ch of CH) {
    const strokes = (pad.draft[ch] || []).filter((s) => s.length);
    if (!strokes.length) continue;
    let minX = Infinity, maxX = -Infinity;
    for (const s of strokes) for (const [x] of s) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    const bearing = 0.05, shift = bearing - minX;
    glyphs[ch] = {
      a: Math.round((maxX - minX + 2 * bearing + HAND_W) * 1000),
      s: strokes.map((s) => {
        const pts = s.length > 2 ? engine.rdp(s.map(([x, y]) => [(x + shift) * 1000, y * 1000]), 3) : s.map(([x, y]) => [(x + shift) * 1000, y * 1000]);
        return pts.flatMap(([x, y]) => [Math.round(x), Math.round(y)]);
      }),
    };
  }
  return { v: 1, glyphs };
}

c.addEventListener("pointerdown", (e) => {
  e.preventDefault(); c.setPointerCapture(e.pointerId);
  const ch = CH[pad.idx];
  pad.drawing = [padPoint(e)];
  (pad.draft[ch] = pad.draft[ch] || []).push(pad.drawing);
  drawPad();
});
c.addEventListener("pointermove", (e) => {
  if (!pad.drawing) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of evs.length ? evs : [e]) {
    const p = padPoint(ev), last = pad.drawing[pad.drawing.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.004) pad.drawing.push(p);
  }
  drawPad();
});
const end = () => { if (pad.drawing) { pad.drawing = null; update(); } };
c.addEventListener("pointerup", end);
c.addEventListener("pointercancel", end);
window.addEventListener("resize", sizePad);

function handle(msg) {
  try {
    if (msg.type === "init") {
      pad.draft = {}; pad.ink = msg.ink || pad.ink;
      const g = (msg.packed && msg.packed.glyphs) || {};
      for (const [ch, gl] of Object.entries(g)) pad.draft[ch] = (gl.s || []).map((flat) => { const pts = []; for (let i = 0; i + 1 < flat.length; i += 2) pts.push([flat[i] / 1000, flat[i + 1] / 1000]); return pts; });
      pad.idx = Math.max(0, CH.findIndex((x) => !pad.draft[x]));
      sizePad(); emitState();
    } else if (msg.type === "goto") { pad.idx = Math.min(CH.length - 1, Math.max(0, msg.idx | 0)); update(); }
    else if (msg.type === "prev") { if (pad.idx > 0) pad.idx--; update(); }
    else if (msg.type === "next") { if (pad.idx < CH.length - 1) pad.idx++; update(); }
    else if (msg.type === "undo") { const s = pad.draft[CH[pad.idx]]; if (s) s.pop(); update(); }
    else if (msg.type === "clear") { delete pad.draft[CH[pad.idx]]; update(); }
    else if (msg.type === "pack") {
      const packed = packHand();
      if (!Object.keys(packed.glyphs).length) post({ type: "pad-error", id: msg.id, message: "Zeichne mindestens ein Zeichen." });
      else post({ type: "packed", id: msg.id, packed });
    }
  } catch (e) { post({ type: "pad-error", id: msg.id || "", message: String((e && e.message) || e) }); }
}
const onMsg = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (_) { return; } handle(m); };
document.addEventListener("message", onMsg); window.addEventListener("message", onMsg);
post({ type: "pad-ready" });
