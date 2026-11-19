/* Brücke zwischen Expo und der lokal gebündelten Tinten-Engine. */
const post = (message) => window.ReactNativeWebView.postMessage(JSON.stringify(message));
const engine = createInkEngine();

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function renderDocument({ text, settings }) {
  Object.assign(engine.state, settings);
  const font = engine.state.font === engine.HAND_ID ? "Caveat" : engine.state.font;
  try {
    await document.fonts.load('400 40px "' + font + '"');
    await document.fonts.load(engine.fontSpec(40, true));
  } catch {
    // Canvas can use the default font if the bundled font failed to load.
  }
  return engine.render(text || "");
}

async function handle(message) {
  const { id, type } = message;
  try {
    if (type === "render") {
      const { canvases } = await renderDocument(message);
      post({ type: "rendered", id, pages: canvases.map((canvas) => canvas.toDataURL("image/png")) });
    } else if (type === "export-pdf" || type === "export-goodnotes") {
      const { canvases, inkPages } = await renderDocument(message);
      if (!canvases.length) throw new Error("Es gibt noch nichts zum Exportieren.");
      if (type === "export-pdf") {
        const pdf = new Blob([engine.buildPdf(canvases)], { type: "application/pdf" });
        post({ type: "exported", id, kind: "pdf", files: [await toBase64(pdf)] });
      } else {
        const template = await engine.activeTemplate();
        const ink = engine.state.mode === "ink";
        const files = [];
        for (const [index, canvas] of canvases.entries()) {
          files.push(await toBase64(await engine.buildGoodnotes(template, [canvas], ink ? inkPages[index] : null)));
        }
        post({ type: "exported", id, kind: "goodnotes", files });
      }
    } else if (type === "template") {
      const bytes = Uint8Array.from(atob(message.base64), (character) => character.charCodeAt(0));
      const template = await engine.inspectTemplate(bytes.buffer, message.name);
      engine.state.custom = template;
      post({ type: "template-ok", id, pageSize: template.pageSize, hasInk: !!template.hasInk });
    } else if (type === "set-hand") {
      const hand = message.packed ? engine.unpackHand(message.packed) : null;
      engine.state.hand = hand && Object.keys(hand.glyphs).length ? hand : null;
      post({ type: "hand-set", id, count: engine.state.hand ? Object.keys(engine.state.hand.glyphs).length : 0 });
    } else if (type === "clear-template") {
      engine.state.custom = null;
      post({ type: "template-cleared", id });
    }
  } catch (error) {
    post({ type: "error", id, message: String(error?.message || error) });
  }
}

let queue = Promise.resolve();
function onMessage(event) {
  let message;
  try { message = JSON.parse(event.data); } catch { return; }
  if (!message || typeof message.id !== "string") return;
  // Every command shares the same engine state, including its template and handwriting.
  queue = queue.then(() => handle(message), () => handle(message));
}

document.addEventListener("message", onMessage);
window.addEventListener("message", onMessage);
post({ type: "ready" });
