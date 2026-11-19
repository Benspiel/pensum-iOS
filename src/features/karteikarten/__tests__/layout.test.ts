import { test } from "node:test";
import assert from "node:assert/strict";
import { detailPlaceholder, isTabletWindow, kkLayout, selectedDeckId, studyCardMinHeight, studyFaceFontSize } from "../layout";
import { initialView, newRound } from "../session-model";
import type { View } from "../session-model";

const round = newRound("d1", "practice", ["c1", "c2"]);
const views: Record<View["name"], View> = {
  boot: initialView,
  list: { name: "list" },
  deck: { name: "deck", id: "d1", tab: "learn" },
  loading: { name: "loading", round, count: 2 },
  study: { name: "study", round },
  result: { name: "result", round },
};

test("schmal: immer eine Spalte, egal in welchem Zustand", () => {
  for (const name of Object.keys(views) as View["name"][]) assert.deepEqual(kkLayout(name, false), { mode: "single" });
});

test("breit: Liste und Stapel nebeneinander, Rest über die ganze Breite", () => {
  assert.deepEqual(kkLayout("list", true), { mode: "split", detail: "empty" });
  assert.deepEqual(kkLayout("deck", true), { mode: "split", detail: "deck" });
  for (const name of ["boot", "loading", "study", "result"] as const) assert.deepEqual(kkLayout(name, true), { mode: "single" });
});

test("Auswahl in der Liste folgt der Stapelansicht", () => {
  assert.equal(selectedDeckId(views.deck), "d1");
  for (const name of ["boot", "list", "loading", "study", "result"] as const) assert.equal(selectedDeckId(views[name]), null);
});

test("Leerzustand rechts: mit und ohne Stapel", () => {
  assert.equal(detailPlaceholder(2).title, "Wähle einen Stapel.");
  assert.match(detailPlaceholder(0).message, /ersten Stapel/);
});

test("Tablet-Fenster: kurze Seite ≥ 600 und Schrift ≤ 1,25", () => {
  assert.equal(isTabletWindow(1366, 1024, 1), true);
  assert.equal(isTabletWindow(820, 1180, 1.25), true);
  assert.equal(isTabletWindow(744, 1133, 1), true);
  assert.equal(isTabletWindow(375, 812, 1), false);
  assert.equal(isTabletWindow(932, 430, 1), false); // Telefon quer
  assert.equal(isTabletWindow(507, 1024, 1), false); // iPad im schmalen Split View
  assert.equal(isTabletWindow(1366, 1024, 1.3), false);
});

test("Lernkarte: Telefon bis 560, Tablet bis 640, nie unter 280", () => {
  assert.equal(studyCardMinHeight(375, 812), 432);
  assert.equal(studyCardMinHeight(430, 1200), 560);
  assert.equal(studyCardMinHeight(820, 1180), 640);
  assert.equal(studyCardMinHeight(1366, 1024), 640);
  assert.equal(studyCardMinHeight(1180, 820), 440);
  assert.equal(studyCardMinHeight(375, 500), 280);
});

test("Schrift auf der Lernkarte wächst mit der Breite", () => {
  assert.equal(studyFaceFontSize(375), 26);
  assert.equal(studyFaceFontSize(640), 34);
  assert.equal(studyFaceFontSize(820), 34);
  assert.equal(studyFaceFontSize(1180), 42);
});
