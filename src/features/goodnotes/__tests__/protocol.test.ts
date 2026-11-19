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
  assert.ok(GOODNOTES_HOST_HTML.includes("GOODI_TEMPLATES"));
  // Nur die HTML-Hülle prüfen (Bibliothekscode enthält Zeichenketten wie "<link href=", lädt aber nichts nach).
  const shell = GOODNOTES_HOST_HTML.replace(/<script>[\s\S]*?<\/script>/g, "");
  assert.ok(!/<script|<link|<img|<iframe|https?:\/\/(?!data)/i.test(shell.replace(/url\(data:[^)]*\)/g, "")), "keine externen Ressourcen");
  for (const f of FONTS) assert.ok(GOODNOTES_HOST_HTML.includes(`font-family:"${f}"`), f);
  const scripts = [...GOODNOTES_HOST_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] as string);
  assert.equal(scripts.length, 4);
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
