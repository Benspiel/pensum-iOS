/* Tests für die Zustandslogik der Planer-Oberfläche (model.ts) und die Einstellung „Übernahme abgelehnt“ (prefs.ts).
 * Web-Quelle der Logik: tools/planer/planer.js (Web-Commit 770dbe4). Das Datumsfeld als Text ist neu für die App. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDateInput, formatDateInput, validateForm, validateQuick, emptyForm, formFromItem, newItem, subjectSuggestions,
  toggleDone, removeItem, clearDone, updateItem, headerStats, tabTitles, saveNote, taskRowModel, taskEmpty, examCardModel,
  dialogTitle, dialogLabels, newButtonLabel, openNewDialog, openEditDialog, importPrompt, importDoneMessage, dayChanged, msUntilNextDay,
  deckOptions, groupHeading, isFull, TEXT,
} from "../model";
import { isDeclined, markDeclined, DECLINED_KEY } from "../prefs";
import { MAX_ITEMS, type PlanItem } from "../core";
import { memoryKv } from "../../shared/testing";

const TODAY = "2026-11-19";
const task = (id: string, extra: Partial<PlanItem> = {}): PlanItem => newItem(id, "task", { title: "Aufgabe " + id, ...extra });
const exam = (id: string, extra: Partial<PlanItem> = {}): PlanItem => newItem(id, "exam", { title: "Klausur " + id, ...extra });

/* ---------- Datumsfeld ---------- */

test("parseDateInput: gültige Formen", () => {
  assert.equal(parseDateInput("24.12.2026"), "2026-12-24");
  assert.equal(parseDateInput("5.3.2026"), "2026-03-05");
  assert.equal(parseDateInput("05.03.2026"), "2026-03-05");
  assert.equal(parseDateInput("  5. 3. 2026 "), "2026-03-05");
  assert.equal(parseDateInput("2026-03-05"), "2026-03-05");
  assert.equal(parseDateInput("29.02.2028"), "2028-02-29"); // Schaltjahr
});

test("parseDateInput: ungültig → null", () => {
  for (const bad of ["", "   ", "31.02.2026", "29.02.2027", "0.1.2026", "32.01.2026", "1.13.2026", "1.1.26", "morgen", "24.12.", "2026", "24.12.2026 x", "2026-3-5", "2026-02-31", "5-3-2026", "0050-01-01"]) {
    assert.equal(parseDateInput(bad), null, JSON.stringify(bad));
  }
});

test("formatDateInput: ISO → TT.MM.JJJJ und zurück", () => {
  assert.equal(formatDateInput("2026-12-24"), "24.12.2026");
  assert.equal(formatDateInput("2026-03-05"), "05.03.2026");
  assert.equal(formatDateInput(""), "");
  assert.equal(formatDateInput("2026-02-31"), "");
  assert.equal(parseDateInput(formatDateInput("2026-03-29")), "2026-03-29");
});

/* ---------- Dialog ---------- */

test("Dialogtitel, Beschriftungen, Buttons", () => {
  assert.equal(dialogTitle("task", true), "Neue Hausaufgabe.");
  assert.equal(dialogTitle("task", false), "Hausaufgabe bearbeiten.");
  assert.equal(dialogTitle("exam", true), "Neue Klausur.");
  assert.equal(dialogTitle("exam", false), "Klausur bearbeiten.");
  assert.equal(newButtonLabel("task"), "+ Neue Hausaufgabe");
  assert.equal(newButtonLabel("exam"), "+ Neue Klausur");
  assert.equal(dialogLabels("task").date, "Fällig am");
  assert.equal(dialogLabels("exam").date, "Datum");
  assert.equal(dialogLabels("task").note, "Notiz (optional)");
  assert.equal(dialogLabels("exam").note, "Themen (optional)");
  assert.equal(dialogLabels("task").submit(true), "Eintragen");
  assert.equal(dialogLabels("exam").submit(false), "Speichern");
  assert.deepEqual(openNewDialog("exam"), { kind: "exam", itemId: null });
  assert.deepEqual(openEditDialog({ kind: "task", id: "a" }), { kind: "task", itemId: "a" });
});

test("validateForm: Pflichttitel, Datum, Grenze, Stapel nur bei Klausuren", () => {
  const f = { ...emptyForm(), title: "  Klassenarbeit 2 ", subject: " Mathe ", date: "24.12.2026", note: " Brüche ", deckId: "d1" };
  assert.deepEqual(validateForm(f, "exam", true, 0), { ok: true, fields: { title: "Klassenarbeit 2", subject: "Mathe", date: "2026-12-24", note: "Brüche", deckId: "d1" } });
  const t = validateForm(f, "task", true, 0);
  assert.equal(t.ok && t.fields.deckId, "");
  assert.deepEqual(validateForm({ ...f, title: " " }, "task", true, 0), { ok: false, errors: { title: "Gib einen Titel ein." } });
  assert.deepEqual(validateForm(f, "task", true, MAX_ITEMS), { ok: false, errors: { form: "Du hast die maximale Anzahl an Einträgen erreicht. Lösche alte Einträge." } });
  assert.equal(validateForm(f, "task", false, MAX_ITEMS).ok, true); // Bearbeiten geht auch bei vollem Speicher
  assert.deepEqual(validateForm({ ...f, date: "31.02.2026" }, "task", true, 0), { ok: false, errors: { date: "Gib das Datum so ein: TT.MM.JJJJ." } });
  const empty = validateForm({ ...f, date: "  " }, "task", true, 0);
  assert.equal(empty.ok && empty.fields.date, ""); // Datum ist optional
  const many = validateForm({ ...emptyForm(), date: "x" }, "task", true, MAX_ITEMS);
  assert.equal(many.ok, false);
  assert.deepEqual(!many.ok && Object.keys(many.errors).sort(), ["date", "form", "title"]);
});

test("validateForm: kürzt auf die Höchstlängen", () => {
  const r = validateForm({ title: "t".repeat(200), subject: "s".repeat(90), date: "", note: "n".repeat(700), deckId: "d".repeat(50) }, "exam", true, 0);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.fields.title.length, 120);
    assert.equal(r.fields.subject.length, 60);
    assert.equal(r.fields.note.length, 500);
    assert.equal(r.fields.deckId.length, 36);
  }
});

test("formFromItem zeigt das Datum als TT.MM.JJJJ", () => {
  const form = formFromItem(exam("b", { date: "2026-12-01", subject: "Mathe", note: "Brüche", deckId: "d1" }));
  assert.deepEqual(form, { title: "Klausur b", subject: "Mathe", date: "01.12.2026", note: "Brüche", deckId: "d1" });
  assert.equal(formFromItem(task("a")).date, "");
});

test("subjectSuggestions: benutzte Fächer, gefiltert nach Eingabe", () => {
  const items = [task("1", { subject: "Mathe" }), task("2", { subject: "Deutsch" }), task("3", { subject: "Mathe" }), task("4", { subject: "Englisch" }), task("5")];
  assert.deepEqual(subjectSuggestions(items, ""), ["Deutsch", "Englisch", "Mathe"]);
  assert.deepEqual(subjectSuggestions(items, "en"), ["Englisch"]);
  assert.deepEqual(subjectSuggestions(items, "mathe"), []); // schon vollständig eingegeben
  assert.deepEqual(subjectSuggestions(items, "", 2), ["Deutsch", "Englisch"]);
});

test("deckOptions: „Keiner“ zuerst", () => {
  assert.deepEqual(deckOptions([{ id: "d1", name: "Vokabeln", cardCount: 3 }]), [{ id: "", name: "Keiner" }, { id: "d1", name: "Vokabeln" }]);
  assert.deepEqual(deckOptions([]), [{ id: "", name: "Keiner" }]);
  assert.ok(TEXT.noDecks.startsWith("Du hast noch keine Karteikarten-Stapel."));
});

/* ---------- Schnellerfassung und Listenänderungen ---------- */

test("validateQuick: leer ignorieren, Grenze, Kürzung", () => {
  assert.deepEqual(validateQuick("  Mathe lernen ", 3), { ok: true, title: "Mathe lernen" });
  assert.deepEqual(validateQuick("   ", 3), { ok: false, reason: "empty" });
  assert.deepEqual(validateQuick("x", MAX_ITEMS), { ok: false, reason: "full", message: "Du hast die maximale Anzahl an Einträgen erreicht." });
  assert.deepEqual(validateQuick("   ", MAX_ITEMS), { ok: false, reason: "empty" });
  const long = validateQuick("a".repeat(150), 0);
  assert.equal(long.ok && long.title.length, 120);
  assert.equal(isFull(new Array(MAX_ITEMS)), true);
  assert.equal(isFull([]), false);
});

test("Listenänderungen sind rein", () => {
  const a = task("a"), b = exam("b", { date: "2026-12-01" }), c = { ...task("c"), done: true };
  const list = [a, b, c];
  assert.equal(toggleDone(list, "a")[0]?.done, true);
  assert.equal(toggleDone(list, "c")[2]?.done, false);
  assert.equal(list[0]?.done, false);
  assert.equal(toggleDone(list, "b")[1]?.done, false); // Klausuren sind nie erledigt
  assert.deepEqual(removeItem(list, "b").map((i) => i.id), ["a", "c"]);
  assert.deepEqual(clearDone(list).map((i) => i.id), ["a", "b"]);
  assert.equal(clearDone([{ ...b, done: true }]).length, 1); // nur Hausaufgaben
  assert.equal(updateItem(list, "a", { title: "Neu" })[0]?.title, "Neu");
  assert.equal(list[0]?.title, "Aufgabe a");
});

/* ---------- Kopf ---------- */

test("headerStats: offen, überfällig/heute fällig, nächste Klausur", () => {
  const none = headerStats([], TODAY);
  assert.deepEqual(none, { open: 0, alertCount: 0, alertLabel: "heute fällig", alert: false, nextText: "–", nextLabel: "nächste Klausur", nextAlert: false });

  const items = [
    task("a", { date: "2026-11-17" }), task("b", { date: "2026-11-19" }), task("c", { date: "2026-12-01" }), { ...task("d", { date: "2026-11-01" }), done: true },
    exam("e", { date: "2026-11-24", subject: "Mathe" }), exam("f", { date: "2026-11-30", subject: "Bio" }), exam("g", { date: "2026-11-01", subject: "Alt" }),
  ];
  const s = headerStats(items, TODAY);
  assert.equal(s.open, 3);
  assert.equal(s.alertCount, 2);
  assert.equal(s.alertLabel, "überfällig");
  assert.equal(s.alert, true);
  assert.equal(s.nextText, "5 Tage");
  assert.equal(s.nextLabel, "bis Mathe");
  assert.equal(s.nextAlert, false);
});

test("headerStats: nur heute fällig; Klausur heute/morgen/in 3 Tagen", () => {
  const today = headerStats([task("b", { date: TODAY })], TODAY);
  assert.equal(today.alertLabel, "heute fällig");
  assert.equal(today.alert, true);
  const h = headerStats([exam("x", { date: TODAY, subject: "Mathe" })], TODAY);
  assert.deepEqual([h.nextText, h.nextAlert, h.nextLabel], ["Heute", true, "bis Mathe"]);
  const m = headerStats([exam("x", { date: "2026-11-20" })], TODAY);
  assert.deepEqual([m.nextText, m.nextAlert, m.nextLabel], ["Morgen", true, "bis Klausur"]); // ohne Fach
  assert.equal(headerStats([exam("x", { date: "2026-11-22" })], TODAY).nextAlert, true); // 3 Tage
  assert.equal(headerStats([exam("x", { date: "2026-11-23" })], TODAY).nextAlert, false); // 4 Tage
  assert.equal(headerStats([exam("x")], TODAY).nextText, "–"); // Klausur ohne Datum zählt nicht als nächste
});

test("headerStats hängt nur von „heute“ ab (Zeitzonenfest)", () => {
  const items = [task("a", { date: "2026-11-19" })];
  assert.equal(headerStats(items, "2026-11-19").alertLabel, "heute fällig");
  assert.equal(headerStats(items, "2026-11-20").alertLabel, "überfällig");
  assert.equal(headerStats(items, "2026-11-18").alert, false);
});

test("tabTitles zählt offene Hausaufgaben und kommende Klausuren", () => {
  const items = [task("a"), { ...task("b"), done: true }, exam("c", { date: "2026-11-19" }), exam("d", { date: "2026-11-18" }), exam("e")];
  assert.deepEqual(tabTitles(items, TODAY), { task: "Hausaufgaben (1)", exam: "Klausuren (2)" }); // heute und ohne Datum zählen mit
});

test("saveNote: Gast und Konto", () => {
  assert.equal(saveNote(false, "saved").text, "Nur auf diesem Gerät gespeichert. Anmelden, um alles in deinem Konto zu sichern.");
  assert.equal(saveNote(false, "error").filled, false);
  assert.deepEqual(saveNote(true, "saving"), { text: "Speichert …", filled: false });
  assert.deepEqual(saveNote(true, "error"), { text: "Speichern fehlgeschlagen. Es wird erneut versucht, sobald du wieder online bist.", filled: false });
  assert.deepEqual(saveNote(true, "saved"), { text: "In deinem Konto gespeichert, auf allen deinen Geräten.", filled: true });
});

/* ---------- Anzeige ---------- */

test("taskRowModel: Fälligkeit und Ton", () => {
  assert.deepEqual(taskRowModel(task("a", { date: "2026-11-17" }), TODAY), { dueText: "2 Tage überfällig", tone: "late" });
  assert.deepEqual(taskRowModel(task("a", { date: "2026-11-19" }), TODAY), { dueText: "Heute", tone: "today" });
  assert.deepEqual(taskRowModel(task("a", { date: "2026-11-20" }), TODAY), { dueText: "Morgen", tone: "normal" });
  assert.deepEqual(taskRowModel(task("a"), TODAY), { dueText: "Ohne Datum", tone: "normal" });
});

test("taskEmpty: noch keine vs. alles erledigt", () => {
  assert.equal(taskEmpty([]).title, "Noch keine Hausaufgaben.");
  assert.equal(taskEmpty([exam("x")]).title, "Noch keine Hausaufgaben.");
  assert.equal(taskEmpty([{ ...task("a"), done: true }]).title, "Alles erledigt.");
});

test("examCardModel: Countdown und Datum", () => {
  const a = examCardModel(exam("a", { date: "2026-11-19" }), TODAY);
  assert.deepEqual([a.big, a.small, a.state, a.longBig, a.dateText], ["Heute", "schreibst du", "today", true, "Do. 19.11."]);
  const b = examCardModel(exam("b", { date: "2026-12-24" }), TODAY);
  assert.deepEqual([b.big, b.small, b.state, b.longBig], ["35", "Tage noch", "later", false]);
  assert.equal(examCardModel(exam("c"), TODAY).dateText, "Ohne Datum");
  assert.equal(examCardModel(exam("c"), TODAY).state, "none");
  assert.equal(examCardModel(exam("d", { date: "2027-01-05" }), TODAY).dateText, "Di. 05.01.2027");
  assert.equal(groupHeading("Überfällig", 3), "Überfällig · 3");
});

/* ---------- Gast → Konto ---------- */

test("importPrompt und Meldung", () => {
  assert.equal(importPrompt(1).title, "Lokale Einträge übernehmen?");
  assert.match(importPrompt(1).message, /^Auf diesem Gerät liegt 1 Eintrag aus dem Gast-Modus\./);
  assert.match(importPrompt(4).message, /^Auf diesem Gerät liegen 4 Einträge aus dem Gast-Modus\./);
  assert.equal(importPrompt(2).confirm, "Ins Konto übernehmen");
  assert.equal(importPrompt(2).cancel, "Nicht übernehmen");
  assert.equal(importDoneMessage(1), "1 Eintrag in dein Konto übernommen.");
  assert.equal(importDoneMessage(5), "5 Einträge in dein Konto übernommen.");
});

test("prefs: abgelehnte Übernahme je Konto", async () => {
  const kv = memoryKv();
  assert.equal(DECLINED_KEY, "pensum.planer.declined.v1");
  assert.equal(await isDeclined(kv, "u1"), false);
  await markDeclined(kv, "u1"); await markDeclined(kv, "u1");
  assert.equal(await isDeclined(kv, "u1"), true);
  assert.equal(await isDeclined(kv, "u2"), false);
  assert.deepEqual(JSON.parse(kv.dump()[DECLINED_KEY] as string), ["u1"]);
  assert.equal(await isDeclined(memoryKv({ [DECLINED_KEY]: "kaputt" }), "u1"), false);
});

/* ---------- Neuer Tag ---------- */

test("dayChanged und msUntilNextDay", () => {
  assert.equal(dayChanged("2026-11-19", "2026-11-19"), false);
  assert.equal(dayChanged("2026-11-19", "2026-11-20"), true);
  assert.equal(dayChanged("2026-11-19", "kaputt"), false);
  assert.equal(msUntilNextDay(new Date(2026, 10, 19, 23, 59, 0)), 60000);
  assert.equal(msUntilNextDay(new Date(2026, 10, 19, 0, 0, 0)), 24 * 3600 * 1000);
  assert.equal(msUntilNextDay(new Date(2026, 10, 19, 23, 59, 59, 999)), 1000); // Untergrenze
});
