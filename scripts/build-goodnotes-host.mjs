// Erzeugt src/features/goodnotes/host-html.generated.ts aus den lokal eingecheckten Engine-Dateien
// (src/features/goodnotes/engine/**). Kein Netz, kein Zugriff auf das Web-Projekt.
// Aufruf: node scripts/build-goodnotes-host.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "src/features/goodnotes");
const E = path.join(dir, "engine");
const read = (p) => fs.readFileSync(path.join(E, p), "utf8");
const b64 = (p) => fs.readFileSync(path.join(E, p)).toString("base64");

const fonts = [
  ["Caveat", 400, "caveat-latin-400-normal"], ["Caveat", 600, "caveat-latin-600-normal"],
  ["Kalam", 400, "kalam-latin-400-normal"], ["Kalam", 700, "kalam-latin-700-normal"],
  ["Patrick Hand", 400, "patrick-hand-latin-400-normal"], ["Indie Flower", 400, "indie-flower-latin-400-normal"],
  ["Shadows Into Light", 400, "shadows-into-light-latin-400-normal"], ["Gochi Hand", 400, "gochi-hand-latin-400-normal"],
];
const css = fonts.map(([f, w, p]) => `@font-face{font-family:"${f}";font-weight:${w};src:url(data:font/woff2;base64,${b64(`fonts/${p}.woff2`)}) format("woff2")}`).join("\n");
const engine = read("ink-engine.js").replace(/^export function createInkEngine/m, "function createInkEngine");
const bridge = read("host-bridge.js");
// </script> in eingebettetem Code würde den Block schließen
const safe = (s) => s.replace(/<\/script/gi, "<\/script");
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style>
<script>${safe(read("jszip.min.js"))}</script><script>${safe(read("jspdf.umd.min.js"))}</script><script>${safe(read("templates.js"))}</script>
<script>${safe(engine)}\n${bridge}</script>`;
const out = `/* GENERIERT von scripts/build-goodnotes-host.mjs – nicht von Hand ändern. */\nexport const GOODNOTES_HOST_HTML: string = ${JSON.stringify(html)};\n`;
fs.writeFileSync(path.join(dir, "host-html.generated.ts"), out);
console.log("host-html.generated.ts", (out.length / 1e6).toFixed(2), "MB");
