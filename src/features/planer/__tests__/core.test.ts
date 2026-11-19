/* Tests für die Planer-Logik.
 * Web-Quelle: tests/planer.test.mjs (Pensum, Web-Commit 770dbe4) – Fälle und erwartete Werte 1:1 übernommen,
 * dazu neue Tests: Zeitzonen/Sommerzeit, injizierbares „heute“, Wochentage vor 1970, Übernahme von Gast-Einträgen. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDay, todayISO, daysUntil, dueLabel, formatDate, examCountdown, groupTasks, splitExams, stats, usedSubjects,
  mergeGuestItems, MAX_ITEMS, type PlanItem,
} from "../core";

const TODAY = "2026-11-18"; // ein Mittwoch

test("parseDay prüft echte Kalendertage", () => {
  assert.notEqual(parseDay("2026-11-18"), null);
  assert.equal(parseDay("2026-02-31"), null);
  assert.equal(parseDay("18.11.2026"), null);
  assert.equal(parseDay(""), null);
});

test("todayISO und daysUntil", () => {
  assert.equal(todayISO(new Date(2026, 10, 5)), "2026-11-05");
  assert.equal(daysUntil("2026-11-20", TODAY), 2);
  assert.equal(daysUntil("2026-11-17", TODAY), -1);
  assert.equal(daysUntil("", TODAY), null);
  assert.equal(daysUntil("2026-12-01", "2026-11-30"), 1); // Monatswechsel
});

test("dueLabel", () => {
  assert.equal(dueLabel("", TODAY), "Ohne Datum");
  assert.equal(dueLabel("2026-11-10", TODAY), "8 Tage überfällig");
  assert.equal(dueLabel("2026-11-17", TODAY), "Gestern fällig");
  assert.equal(dueLabel("2026-11-18", TODAY), "Heute");
  assert.equal(dueLabel("2026-11-19", TODAY), "Morgen");
  assert.equal(dueLabel("2026-11-20", TODAY), "Übermorgen");
  assert.equal(dueLabel("2026-11-23", TODAY), "Montag");
  assert.equal(dueLabel("2026-11-30", TODAY), "Mo. 30.11.");
  assert.equal(dueLabel("2027-01-04", TODAY), "Mo. 04.01.2027");
});

test("formatDate Wochentag stimmt", () => {
  assert.equal(formatDate("2026-11-18", TODAY), "Mi. 18.11.");
});

test("examCountdown", () => {
  assert.deepEqual(examCountdown("2026-11-18", TODAY), { big: "Heute", small: "schreibst du", state: "today" });
  assert.equal(examCountdown("2026-11-25", TODAY).big, "7");
  assert.equal(examCountdown("2026-11-25", TODAY).state, "soon");
  assert.equal(examCountdown("2026-12-25", TODAY).state, "later");
  assert.equal(examCountdown("2026-11-01", TODAY).state, "past");
});

const T = (id: string, date: string, done = false, subject = ""): PlanItem => ({ id, kind: "task", title: id, subject, date, note: "", done, deckId: "" });
const E = (id: string, date: string, deckId = ""): PlanItem => ({ id, kind: "exam", title: id, subject: "", date, note: "", done: false, deckId });

test("groupTasks sortiert nach Dringlichkeit und blendet Erledigtes aus", () => {
  const g = groupTasks([T("a", "2026-12-24"), T("b", ""), T("c", "2026-11-10"), T("d", "2026-11-18"), T("e", "2026-11-20"), T("f", "2026-11-19"), T("x", "2026-11-18", true)], TODAY);
  assert.deepEqual(g.map((x) => x.key), ["overdue", "today", "week", "later", "none"]);
  assert.deepEqual(g.find((x) => x.key === "week")!.items.map((i) => i.id), ["f", "e"]);
  assert.equal(g.find((x) => x.key === "today")!.items.length, 1);
});

test("splitExams und stats", () => {
  const { upcoming, past } = splitExams([E("späte", "2026-12-01"), E("alt", "2026-10-01"), E("frühe", "2026-11-20")], TODAY);
  assert.deepEqual(upcoming.map((e) => e.id), ["frühe", "späte"]);
  assert.deepEqual(past.map((e) => e.id), ["alt"]);
  const s = stats([T("a", "2026-11-10"), T("b", "2026-11-18"), T("c", "", true), E("frühe", "2026-11-20")], TODAY);
  assert.equal(s.open, 2);
  assert.equal(s.overdue, 1);
  assert.equal(s.dueToday, 1);
  assert.equal(s.nextExamDays, 2);
});

test("usedSubjects", () => {
  assert.deepEqual(usedSubjects([T("a", "", false, "Mathe"), T("b", "", false, "Deutsch"), T("c", "", false, "Mathe"), T("d", "", false, "")]), ["Deutsch", "Mathe"]);
});

/* ---------- neu ---------- */

test("Datumsrechnung ist von der Zeitzone unabhängig (Sommerzeit-Wechsel, Jahreswechsel, Schaltjahr)", () => {
  // Die Funktionen rechnen mit Kalendertagen als Text (UTC-Tage), nie mit lokalen Stunden.
  assert.equal(daysUntil("2026-03-30", "2026-03-29"), 1); // EU-Sommerzeit beginnt am 29.3.2026 (23-h-Tag)
  assert.equal(daysUntil("2026-10-26", "2026-10-25"), 1); // und endet am 25.10.2026 (25-h-Tag)
  assert.equal(daysUntil("2026-03-08", "2026-03-07"), 1); // US-Sommerzeit
  assert.equal(daysUntil("2027-01-01", "2026-12-31"), 1);
  assert.equal(daysUntil("2028-03-01", "2028-02-28"), 2); // 2028 ist ein Schaltjahr
  assert.equal(daysUntil("2027-03-01", "2027-02-28"), 1);
  assert.equal(daysUntil("2026-12-31", "2026-01-01"), 364);
  assert.equal(parseDay("2028-02-29") !== null, true);
  assert.equal(parseDay("2027-02-29"), null);
  assert.equal(dueLabel("2026-03-30", "2026-03-29"), "Morgen");
});

test("todayISO nimmt den lokalen Kalendertag des übergebenen Datums, auch kurz nach Mitternacht und kurz davor", () => {
  assert.equal(todayISO(new Date(2026, 2, 29, 0, 30)), "2026-03-29");
  assert.equal(todayISO(new Date(2026, 2, 29, 23, 59, 59)), "2026-03-29");
  assert.equal(todayISO(new Date(2026, 11, 31, 23, 59)), "2026-12-31");
  assert.equal(todayISO(new Date(2027, 0, 1, 0, 0)), "2027-01-01");
  assert.equal(todayISO(new Date(2024, 1, 29, 12)), "2024-02-29");
  // „Neuer Tag“-Erkennung der Oberfläche: todayISO(now) ≠ gemerktes heute
  assert.notEqual(todayISO(new Date(2026, 10, 18, 23, 59)), todayISO(new Date(2026, 10, 19, 0, 1)));
});

test("„heute“ ist injizierbar: dieselben Daten ergeben je nach heute andere Beschriftungen", () => {
  const items = [T("a", "2026-11-18"), E("k", "2026-11-25")];
  assert.equal(stats(items, "2026-11-18").dueToday, 1);
  assert.equal(stats(items, "2026-11-19").overdue, 1);
  assert.equal(stats(items, "2026-11-19").dueToday, 0);
  assert.equal(stats(items, "2026-11-18").nextExamDays, 7);
  assert.equal(stats(items, "2026-11-26").nextExam, null);
  assert.equal(stats(items, "2026-11-26").nextExamDays, null);
  assert.equal(examCountdown("2026-11-25", "2026-11-24").big, "Morgen");
});

test("Wochentage stimmen auch vor 1970 und weit in der Zukunft", () => {
  assert.equal(formatDate("1969-12-31", ""), "Mi. 31.12.1969");
  assert.equal(formatDate("1970-01-01", ""), "Do. 01.01.1970");
  assert.equal(formatDate("1999-12-31", ""), "Fr. 31.12.1999");
  assert.equal(formatDate("2100-01-01", ""), "Fr. 01.01.2100");
  assert.equal(dueLabel("1969-12-31", "1969-12-20"), "Mi. 31.12.");
  assert.equal(dueLabel("1969-12-31", "1969-12-28"), "Mittwoch");
});

test("formatDate: gleiches Jahr ohne Jahreszahl, ungültig → leer", () => {
  assert.equal(formatDate("2026-11-30", TODAY), "Mo. 30.11.");
  assert.equal(formatDate("2027-01-04", TODAY), "Mo. 04.01.2027");
  assert.equal(formatDate("", TODAY), "");
  assert.equal(formatDate("2026-02-30", TODAY), "");
});

test("splitExams: Klausuren ohne Datum zählen als kommende und stehen hinten", () => {
  const { upcoming, past } = splitExams([E("ohne", ""), E("spät", "2026-12-01"), E("heute", TODAY)], TODAY);
  assert.deepEqual(upcoming.map((e) => e.id), ["heute", "spät", "ohne"]);
  assert.deepEqual(past, []);
  assert.equal(stats([E("ohne", "")], TODAY).nextExam, null);
});

test("groupTasks: Grenze der Woche bei 7 Tagen, leere Gruppen fallen weg", () => {
  const g = groupTasks([T("a", "2026-11-25"), T("b", "2026-11-26")], TODAY);
  assert.deepEqual(g.map((x) => [x.key, x.items.map((i) => i.id)]), [["week", ["a"]], ["later", ["b"]]]);
  assert.deepEqual(groupTasks([], TODAY), []);
  assert.deepEqual(groupTasks([T("x", "", true)], TODAY), []);
});

test("usedSubjects sortiert deutsch (Umlaute), ohne Duplikate", () => {
  assert.deepEqual(usedSubjects([T("a", "", false, "Zeichnen"), T("b", "", false, "Ökologie"), T("c", "", false, "Musik"), T("d", "", false, "Ökologie")]), ["Musik", "Ökologie", "Zeichnen"]);
});

test("mergeGuestItems: neue IDs, Stapel-Verknüpfung entfällt, Obergrenze MAX_ITEMS", () => {
  let n = 0;
  const newId = () => "neu" + ++n;
  const guest = [T("g1", "2026-11-20"), E("g2", "2026-12-01", "stapel-1")];
  const r = mergeGuestItems([T("k1", "")], guest, newId);
  assert.equal(r.taken, 2);
  assert.deepEqual(r.items.map((i) => i.id), ["k1", "neu1", "neu2"]);
  assert.equal(r.items[2]?.deckId, "");
  assert.equal(r.items[2]?.title, "g2");
  assert.equal(guest[1]?.deckId, "stapel-1", "Eingabe bleibt unverändert");

  const almostFull = Array.from({ length: MAX_ITEMS - 1 }, (_, i) => T("k" + i, ""));
  const r2 = mergeGuestItems(almostFull, guest, newId);
  assert.equal(r2.taken, 1);
  assert.equal(r2.items.length, MAX_ITEMS);
  const full = Array.from({ length: MAX_ITEMS }, (_, i) => T("k" + i, ""));
  assert.equal(mergeGuestItems(full, guest, newId).taken, 0);
  assert.equal(mergeGuestItems(full, guest, newId).items.length, MAX_ITEMS);
});
