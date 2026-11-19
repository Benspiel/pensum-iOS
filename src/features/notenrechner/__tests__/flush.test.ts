/* Tests für flushOrThrow (Abmelden): wartet auf alles Ausstehende und lehnt bei gescheitertem Schreibvorgang ab. */
import test from "node:test";
import assert from "node:assert/strict";
import { createCloudStore, createGuestStore, GUEST_KEY } from "../store";
import { memoryKv, memoryRows, testTableIds } from "../../shared/testing";
import type { StoreDeps } from "../../shared/ports";

const setup = () => {
  const rows = memoryRows();
  const kv = memoryKv();
  const deps: StoreDeps = { kv, rows, tableIds: testTableIds };
  return { rows, kv, deps, cloud: createCloudStore(deps, { $id: "u1" }) };
};
const subject = (id: string, name = "Mathe") => ({ id, name, schoolYear: "2026/27" });

test("flushOrThrow: schreibt gesammelte 600-ms-Änderungen sofort und löst bei Erfolg auf", async () => {
  const { cloud, rows } = setup();
  await cloud.addSubject(subject("s1"));
  await cloud.updateSubject("s1", { name: "Mathematik" });
  await cloud.updateSubject("s1", { schoolYear: "2025/26" });
  assert.equal(cloud.isIdle(), false);
  assert.equal(rows.tables.get("subjects")?.get("s1")?.name, "Mathe", "noch nicht geschrieben");
  await cloud.flushOrThrow();
  assert.equal(rows.tables.get("subjects")?.get("s1")?.name, "Mathematik");
  assert.equal(rows.tables.get("subjects")?.get("s1")?.schoolYear, "2025/26");
  assert.equal(cloud.isIdle(), true);
  await cloud.flushOrThrow(); // nichts offen → ebenfalls ok
});

test("flushOrThrow: wartet auf noch laufende Schreibvorgänge", async () => {
  const { cloud, rows } = setup();
  const slow = rows.createRow;
  rows.createRow = async (a) => { await new Promise((r) => setTimeout(r, 40)); return slow(a); };
  const adding = cloud.addSubject(subject("s1"));
  await cloud.flushOrThrow();
  assert.equal(rows.tables.get("subjects")?.has("s1"), true);
  await adding;
});

test("flushOrThrow: lehnt ab, wenn eine gesammelte Änderung scheitert (failNext); flush() schluckt den Fehler", async () => {
  const { cloud, rows } = setup();
  await cloud.addSubject(subject("s1"));
  await cloud.updateSubject("s1", { name: "Neu" });
  rows.failNext("updateRow", { code: 400, message: "ungültig" });
  await assert.rejects(() => cloud.flushOrThrow(), { code: 400 });
  assert.equal(rows.tables.get("subjects")?.get("s1")?.name, "Mathe");

  const b = setup();
  await b.cloud.addSubject(subject("s1"));
  await b.cloud.updateSubject("s1", { name: "Neu" });
  b.rows.failNext("updateRow", { code: 400 });
  await b.cloud.flush(); // wirft nicht
});

test("flushOrThrow: lehnt ab, wenn das Anlegen gescheitert ist", async () => {
  const { cloud, rows } = setup();
  rows.failNext("createRow", { code: 400 });
  await assert.rejects(() => cloud.addSubject(subject("s1")), { code: 400 });
  await assert.rejects(() => cloud.flushOrThrow(), { code: 400 });
});

test("flushOrThrow: ein späterer erfolgreicher Schreibvorgang derselben Zeile hebt den Fehler auf", async () => {
  const { cloud, rows } = setup();
  await cloud.addSubject(subject("s1"));
  await cloud.updateSubject("s1", { name: "A" });
  rows.failNext("updateRow", { code: 400 });
  await assert.rejects(() => cloud.flushOrThrow());
  await cloud.updateSubject("s1", { name: "B" });
  await cloud.flushOrThrow();
  assert.equal(rows.tables.get("subjects")?.get("s1")?.name, "B");
});

test("forgetFailures vergisst Fehler gezielt je Zeile", async () => {
  const { cloud, rows } = setup();
  rows.failNext("createRow", { code: 400 });
  await assert.rejects(() => cloud.addSubject(subject("s1")));
  cloud.forgetFailures(["anderer"]);
  await assert.rejects(() => cloud.flushOrThrow());
  cloud.forgetFailures(["s1"]);
  await cloud.flushOrThrow();
});

test("flushOrThrow am Gast-Store: wartet nur auf laufende Schreibzugriffe", async () => {
  const kv = memoryKv();
  const guest = createGuestStore({ kv });
  void guest.addSubject(subject("s1"));
  await guest.flushOrThrow();
  assert.equal(JSON.parse((await kv.getItem(GUEST_KEY)) as string).subjects.length, 1);
});
