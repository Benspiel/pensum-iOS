import { test } from "node:test";
import assert from "node:assert/strict";
import { makeHandoff, readHandoff, putHandoff, takeHandoff, HANDOFF_MAX_AGE } from "../handoff";

test("Übergabe: Hin und zurück", () => {
  const now = 1_000_000;
  assert.deepEqual(readHandoff(makeHandoff("Hallo Welt", "Bio", now), now + 1000), { text: "Hallo Welt", name: "Bio" });
});

test("Übergabe: leer, kaputt, zu alt, aus der Zukunft → null", () => {
  const now = 1_000_000;
  assert.equal(readHandoff(null, now), null);
  assert.equal(readHandoff("kein json", now), null);
  assert.equal(readHandoff(makeHandoff("   ", "x", now), now), null);
  assert.equal(readHandoff(makeHandoff("a", "x", now), now + HANDOFF_MAX_AGE + 1), null);
  assert.equal(readHandoff(makeHandoff("a", "x", now + 120_000), now), null);
});

test("Übergabe: Name-Fallback und Kürzung", () => {
  const now = 5;
  assert.equal(readHandoff(JSON.stringify({ text: "a", name: "  ", at: now }), now)!.name, "Tafelbild");
  assert.equal(readHandoff(JSON.stringify({ text: "a", name: "x".repeat(200), at: now }), now)!.name.length, 80);
});

test("Übergabe: Slot wird nur einmal gelesen", () => {
  putHandoff("Text", "Mathe");
  assert.deepEqual(takeHandoff(), { text: "Text", name: "Mathe" });
  assert.equal(takeHandoff(), null);
});
