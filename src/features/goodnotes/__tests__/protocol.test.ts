import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHostMessage, safeName, exportFileNames, pageCountLabel, createIdGenerator, exportHint, DEFAULT_SETTINGS, FONTS } from "../protocol";
import { GOODNOTES_HOST_HTML } from "../host-html.generated";

test("parseHostMessage: gültige Nachrichten", () => {
  assert.deepEqual(parseHostMessage('{"type":"ready"}'), { type: "ready" });
  assert.deepEqual(parseHostMessage('{"type":"rendered","id":"r1","pages":["a","b"]}'), { type: "rendered", id: "r1", pages: ["a", "b"] });
  assert.deepEqual(parseHostMessage('{"type":"exported","id":"r2","kind":"pdf","files":["x"]}'), { type: "exported", id: "r2", kind: "pdf", files: ["x"] });
  assert.deepEqual(parseHostMessage('{"type":"template-ok","id":"r3","pageSize":[595,842],"hasInk":1}'), { type: "template-ok", id: "r3", pageSize: [595, 842], hasInk: true });
  assert.equal(parseHostMessage('{"type":"error","id":"r4"}')!.type, "error");
});

test("parseHostMessage: Kaputtes ergibt null", () => {
  const bad: unknown[] = [null, 5, "kein json", "{}", '{"type":"nix"}', '{"type":"rendered","id":"r","pages":[1]}',
    '{"type":"exported","id":"r","kind":"zip","files":["x"]}', '{"type":"exported","id":"r","kind":"pdf","files":[]}'];
  for (const raw of bad) assert.equal(parseHostMessage(raw), null, String(raw));
});

test("safeName und Dateinamen", () => {
  assert.equal(safeName("  a/b:c*?  "), "a-b-c-");
  assert.equal(safeName(""), "Notiz");
  assert.equal(safeName("x".repeat(200)).length, 80);
  assert.deepEqual(exportFileNames("Bio", "goodnotes", 1), ["Bio.goodnotes"]);
  assert.deepEqual(exportFileNames("Bio", "goodnotes", 2), ["Bio (1).goodnotes", "Bio (2).goodnotes"]);
  assert.deepEqual(exportFileNames("Bio", "pdf", 3), ["Bio.pdf"]);
});

test("Beschriftungen, IDs, Standardwerte", () => {
  assert.equal(pageCountLabel(1), "1 Seite");
  assert.equal(pageCountLabel(3), "3 Seiten");
  const id = createIdGenerator("g");
  assert.deepEqual([id(), id()], ["g1", "g2"]);
  assert.equal(exportHint("goodnotes", 1), "Jetzt in Goodnotes öffnen");
  assert.equal(exportHint("goodnotes", 4), "4 Dateien");
  assert.ok((FONTS as readonly string[]).includes(DEFAULT_SETTINGS.font));
});

test("Host-HTML: komplett lokal, ohne Netz", () => {
  assert.ok(GOODNOTES_HOST_HTML.includes("createInkEngine"));
  assert.ok(GOODNOTES_HOST_HTML.includes("ReactNativeWebView"));
  assert.ok(!GOODNOTES_HOST_HTML.includes("window.GOODI_TEMPLATES ="), "keine Goodnotes-Vorlagen im Release-Bundle");
  // Nur die HTML-Hülle prüfen (Bibliothekscode enthält Zeichenketten wie "<link href=", lädt aber nichts nach).
  const shell = GOODNOTES_HOST_HTML.replace(/<script>[\s\S]*?<\/script>/g, "");
  assert.ok(!/<script|<link|<img|<iframe|https?:\/\/(?!data)/i.test(shell.replace(/url\(data:[^)]*\)/g, "")), "keine externen Ressourcen");
  for (const f of FONTS) assert.ok(GOODNOTES_HOST_HTML.includes(`font-family:"${f}"`), f);
  const scripts = [...GOODNOTES_HOST_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] as string);
  assert.equal(scripts.length, 2);
  for (const s of scripts) assert.doesNotThrow(() => new Function(s));
});

import { base64ToBytes, bytesToBase64 } from "../protocol";

test("Base64: Hin und zurück für alle Restlängen", () => {
  for (const len of [0, 1, 2, 3, 4, 5, 100, 257]) {
    const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37 + 11) & 255);
    const b64 = bytesToBase64(bytes);
    assert.equal(b64, Buffer.from(bytes).toString("base64"));
    assert.deepEqual([...base64ToBytes(b64)], [...bytes]);
  }
  assert.deepEqual([...base64ToBytes("SGk=")], [72, 105]);
});

import { stepValue, rangeLabel, RANGES } from "../protocol";

test("Regler: Schritte runden sauber und bleiben im Bereich", () => {
  assert.equal(stepValue("size", 1, 1), 1.05);
  assert.equal(stepValue("size", 1.05, -1), 1);
  assert.equal(stepValue("size", RANGES.size.max, 1), 1.6);
  assert.equal(stepValue("size", RANGES.size.min, -1), 0.7);
  assert.equal(stepValue("weight", 0.3, -1), 0.3);
  assert.equal(stepValue("weight", 3, 1), 3);
  assert.equal(stepValue("jitter", 0.1 + 0.2, 1), 0.4);
  let v: number = 1;
  for (let i = 0; i < 100; i++) v = stepValue("jitter", v, -1);
  assert.equal(v, 0);
});

test("Regler: Beschriftung", () => {
  assert.equal(rangeLabel("size", 1), "1.0×");
  assert.equal(rangeLabel("weight", 1), "wie die Schrift");
  assert.equal(rangeLabel("weight", 1.5), "1.50×");
  assert.deepEqual([0, 0.5, 1, 1.5].map((v) => rangeLabel("jitter", v)), ["keine", "wenig", "mittel", "stark"]);
});

import { parsePadMessage, padNextLabel, padProgressLabel, handVaryLabel } from "../protocol";
import { GOODNOTES_PAD_HTML } from "../host-html.generated";

test("Pad-Nachrichten", () => {
  const st = '{"type":"pad-state","idx":2,"char":"c","total":60,"done":[true,false],"doneCount":1,"current":false}';
  assert.deepEqual(parsePadMessage(st), { type: "pad-state", idx: 2, char: "c", total: 60, done: [true, false], doneCount: 1, current: false });
  assert.equal(parsePadMessage('{"type":"pad-state","idx":"x"}'), null);
  assert.equal(parsePadMessage('{"type":"packed","id":"a","packed":{"glyphs":{"a":{}}}}')!.type, "packed");
  assert.equal(parsePadMessage('{"type":"packed","id":"a","packed":{}}'), null);
  assert.equal(parsePadMessage("kaputt"), null);
  assert.equal(parsePadMessage('{"type":"pad-error","id":"a"}')!.type, "pad-error");
  assert.deepEqual(parseHostMessage('{"type":"hand-set","id":"h","count":3}'), { type: "hand-set", id: "h", count: 3 });
});

test("Pad-Beschriftungen wie im Web", () => {
  assert.equal(padNextLabel(59, 60, true), "Fertig");
  assert.equal(padNextLabel(3, 60, true), "Weiter");
  assert.equal(padNextLabel(3, 60, false), "Überspringen");
  assert.equal(padProgressLabel({ idx: 0, total: 60, doneCount: 0 }), "Zeichen 1 von 60 · 0 gezeichnet");
  assert.deepEqual([0.3, 1, 1.4, 1.5].map(handVaryLabel), ["leicht", "mittel", "mittel", "stark"]);
});

test("Pad-HTML: lokal, Skripte parsen, Canvas vorhanden", () => {
  assert.ok(GOODNOTES_PAD_HTML.includes('<canvas id="pad">'));
  const scripts = [...GOODNOTES_PAD_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] as string);
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(scripts[0]!));
  const shell = GOODNOTES_PAD_HTML.replace(/<script>[\s\S]*?<\/script>/g, "").replace(/url\(data:[^)]*\)/g, "");
  assert.ok(!/https?:\/\//i.test(shell), "keine externen Ressourcen");
});
