import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { GOODNOTES_HOST_HTML } from "../host-html.generated";

// Läuft über `npm test` im Projektwurzelverzeichnis.
const file = path.join(process.cwd(), "src/features/goodnotes/engine/jspdf.umd.min.js");
const MIN = [4, 2, 1]; // erste Version ohne die bekannten jsPDF-Sicherheitslücken (GHSA bis März 2026)

test("jsPDF: gebündelte Version ist nicht älter als 4.2.1", () => {
  const src = fs.readFileSync(file, "utf8");
  const m = src.slice(0, 400).match(/Version (\d+)\.(\d+)\.(\d+)/);
  assert.ok(m, "Versionskopf fehlt");
  const v = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ok = v[0]! > MIN[0]! || (v[0] === MIN[0] && (v[1]! > MIN[1]! || (v[1] === MIN[1] && v[2]! >= MIN[2]!)));
  assert.ok(ok, `jsPDF ${v.join(".")} ist zu alt`);
});

test("jsPDF: Prüfsumme in docs/THIRD-PARTY.md passt zur Datei", () => {
  const sha = createHash("sha256").update(new Uint8Array(fs.readFileSync(file))).digest("hex");
  const doc = fs.readFileSync(path.join(process.cwd(), "docs/THIRD-PARTY.md"), "utf8");
  assert.ok(doc.includes(sha), "SHA-256 von jspdf.umd.min.js fehlt oder ist veraltet in docs/THIRD-PARTY.md");
});

test("jsPDF: Host-HTML enthält die aktuelle Datei und lädt als UMD ohne Fehler", () => {
  const src = fs.readFileSync(file, "utf8");
  assert.ok(GOODNOTES_HOST_HTML.includes(src.slice(0, 200).replace(/<\/script/gi, "<\/script")), "Host-HTML ist veraltet: node scripts/build-goodnotes-host.mjs");
  // UMD ohne define/module: hängt jspdf an das globale Objekt (wie in der WebView).
  const sandbox: any = { console, navigator: { userAgent: "node-test" }, atob, btoa, TextEncoder, TextDecoder };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  assert.equal(typeof sandbox.jspdf?.jsPDF, "function");
});
