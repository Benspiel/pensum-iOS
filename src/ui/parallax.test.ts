import { test } from "node:test";
import assert from "node:assert/strict";
import { BLOBS, blobSize, dotsSize, heroOpacity, motionFactor, parallaxOffset, ringSize } from "./parallax";

test("Parallax: schmale Geräte bewegen sich halb so stark", () => {
  assert.equal(motionFactor(375), 0.5);
  assert.equal(motionFactor(767), 0.5);
  assert.equal(motionFactor(768), 1);
});

test("Parallax: Versatz = Scroll × Faktor, nie bei Überscrollen, gegenläufig bei negativer Geschwindigkeit", () => {
  assert.equal(parallaxOffset(100, 0.16, 1), 16);
  assert.equal(parallaxOffset(100, 0.16, 0.5), 8);
  assert.equal(parallaxOffset(100, -0.12, 1), -12);
  assert.equal(parallaxOffset(-50, 0.3, 1), 0);
});

test("Hero blendet über 85 % der Fensterhöhe aus", () => {
  assert.equal(heroOpacity(0, 800), 1);
  assert.equal(heroOpacity(680, 800), 0);
  assert.equal(heroOpacity(2000, 800), 0);
  assert.ok(Math.abs(heroOpacity(340, 800) - 0.5) < 1e-9);
  assert.equal(heroOpacity(-20, 800), 1);
  assert.equal(heroOpacity(100, 0), 1);
});

test("Größen wie im Web (clamp-Regeln)", () => {
  assert.equal(blobSize(375), 337.5);
  assert.equal(blobSize(1400), 640);
  assert.equal(ringSize(375), 120);
  assert.equal(ringSize(2000), 240);
  assert.equal(dotsSize(375), 120);
  assert.equal(dotsSize(2000), 220);
});

test("Farbflächen sind dezent: Deckkraft ≤ 0,2, im Dunkeln stärker als im Hellen", () => {
  for (const b of BLOBS) {
    assert.ok(b.alpha.light > 0 && b.alpha.light <= 0.2);
    assert.ok(b.alpha.dark >= b.alpha.light && b.alpha.dark <= 0.2);
  }
});
