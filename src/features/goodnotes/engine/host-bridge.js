/* Brücke App ↔ Engine (läuft in der WebView). Nachrichten: siehe ../protocol.ts */
const post = (m) => window.ReactNativeWebView.postMessage(JSON.stringify(m));
const engine = createInkEngine();
let pages = [], inkPages = [];
const toB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
async function handle(msg) {
  try {
    if (msg.type === "render") {
      Object.assign(engine.state, msg.settings || {});
      try { await document.fonts.load('400 40px "' + (engine.state.font === engine.HAND_ID ? "Caveat" : engine.state.font) + '"'); await document.fonts.load(engine.fontSpec(40, true)); } catch (_) {}
      const r = engine.render(msg.text || ""); pages = r.canvases; inkPages = r.inkPages;
      post({ type: "rendered", id: msg.id, pages: pages.map((c) => c.toDataURL("image/png")) });
    } else if (msg.type === "export-pdf") {
      if (!pages.length) throw new Error("Es gibt noch nichts zum Exportieren.");
      post({ type: "exported", id: msg.id, kind: "pdf", files: [await toB64(new Blob([engine.buildPdf(pages)], { type: "application/pdf" }))] });
    } else if (msg.type === "export-goodnotes") {
      if (!pages.length) throw new Error("Es gibt noch nichts zum Exportieren.");
      const t = await engine.activeTemplate(); const files = []; const ink = engine.state.mode === "ink";
      for (let i = 0; i < pages.length; i++) files.push(await toB64(await engine.buildGoodnotes(t, [pages[i]], ink ? inkPages[i] : null)));
      post({ type: "exported", id: msg.id, kind: "goodnotes", files });
    } else if (msg.type === "template") {
      const bytes = Uint8Array.from(atob(msg.base64), (c) => c.charCodeAt(0));
      engine.state.custom = await engine.inspectTemplate(bytes.buffer, msg.name);
      post({ type: "template-ok", id: msg.id, pageSize: engine.state.custom.pageSize, hasInk: !!engine.state.custom.hasInk });
    } else if (msg.type === "set-hand") {
      const hand = msg.packed ? engine.unpackHand(msg.packed) : null;
      engine.state.hand = hand && Object.keys(hand.glyphs).length ? hand : null;
      post({ type: "hand-set", id: msg.id, count: engine.state.hand ? Object.keys(engine.state.hand.glyphs).length : 0 });
    } else if (msg.type === "clear-template") {
      engine.state.custom = null; post({ type: "template-cleared", id: msg.id });
    }
  } catch (e) { post({ type: "error", id: msg.id, message: String((e && e.message) || e) }); }
}
const onMsg = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (_) { return; } handle(m); };
document.addEventListener("message", onMsg); window.addEventListener("message", onMsg);
post({ type: "ready" });
