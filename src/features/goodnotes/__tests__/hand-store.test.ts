import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryKv, memoryRows } from "../../shared/testing";
import {
  GUEST_HAND_KEY, createCloudHandStore, createGuestHandStore, glyphCount, handInfo, importGuestHand, isUsableHand,
  markDeclined, readDeclined, shouldOfferHandImport, type PackedHand,
} from "../hand-store";

const hand = (n = 2): PackedHand => ({ glyphs: Object.fromEntries(Array.from({ length: n }, (_, i) => [String.fromCharCode(97 + i), [[0, 0, 1, 1]]])) });
const T = "handwriting";

test("isUsableHand: nur mit mindestens einem Zeichen", () => {
  assert.equal(isUsableHand(hand(1)), true);
  for (const bad of [null, undefined, 5, {}, { glyphs: {} }, { glyphs: null }]) assert.equal(isUsableHand(bad), false);
  assert.equal(glyphCount(hand(3)), 3);
  assert.equal(glyphCount(null), 0);
});

test("Gast: speichern, laden, löschen, kaputte Daten", async () => {
  const kv = memoryKv();
  const s = createGuestHandStore({ kv });
  assert.equal(await s.load(), null);
  await s.save(hand());
  assert.deepEqual(await s.load(), hand());
  assert.ok(await kv.getItem(GUEST_HAND_KEY));
  await s.remove();
  assert.equal(await s.load(), null);
  await kv.setItem(GUEST_HAND_KEY, "{kaputt");
  assert.equal(await s.load(), null);
  await kv.setItem(GUEST_HAND_KEY, JSON.stringify({ glyphs: {} }));
  assert.equal(await s.load(), null);
});

test("Konto: Upsert legt an, ändert, löscht (404 ist ok); Zeilen-ID = Benutzer-ID, Rechte nur Besitzer", async () => {
  const rows = memoryRows();
  const s = createCloudHandStore({ $id: "u1" }, { kv: memoryKv(), rows, tableId: T });
  assert.equal(await s.load(), null);
  await s.save(hand(1));
  assert.deepEqual(rows.log, ["create:handwriting:u1"]);
  const row = rows.tables.get(T)!.get("u1")!;
  assert.equal(row.userId, "u1");
  assert.deepEqual(row.$permissions, rows.ownerPermissions("u1"));
  await s.save(hand(3));
  assert.deepEqual(rows.log.slice(1), ["update:handwriting:u1"]);
  assert.equal(glyphCount(await s.load()), 3);
  await s.remove();
  await s.remove(); // zweites Löschen: 404 wird geschluckt
  assert.equal(await s.load(), null);
});

test("Konto: 409 beim Anlegen führt zum Ändern; andere Fehler werden geworfen", async () => {
  const rows = memoryRows();
  const s = createCloudHandStore({ $id: "u1" }, { kv: memoryKv(), rows, tableId: T });
  // update → 404, create → 409 (inzwischen angelegt), dann update ok
  let first = true;
  const origUpdate = rows.updateRow.bind(rows);
  rows.updateRow = async (a) => {
    if (first) { first = false; await rows.createRow({ tableId: T, rowId: "u1", data: { userId: "u1", glyphs: "{}" }, permissions: [] }); throw Object.assign(new Error("nf"), { code: 404 }); }
    return origUpdate(a);
  };
  await s.save(hand(2));
  assert.equal(glyphCount(await s.load()), 2);
  rows.failNext("updateRow", { code: 500 });
  await assert.rejects(() => s.save(hand(1)), { code: 500 });
});

test("Zwei Konten sehen nur die eigene Handschrift", async () => {
  const rows = memoryRows();
  const a = createCloudHandStore({ $id: "u1" }, { kv: memoryKv(), rows, tableId: T });
  const b = createCloudHandStore({ $id: "u2" }, { kv: memoryKv(), rows, tableId: T });
  await a.save(hand(4));
  assert.equal(await b.load(), null);
  await b.save(hand(1));
  assert.equal(glyphCount(await a.load()), 4);
  assert.equal(glyphCount(await b.load()), 1);
});

test("Gast → Konto: Angebot, Ablehnen merken, Import löscht Gast erst nach Erfolg", async () => {
  const kv = memoryKv();
  const rows = memoryRows();
  const cloud = createCloudHandStore({ $id: "u1" }, { kv, rows, tableId: T });
  assert.equal(await shouldOfferHandImport(kv, "u1", null), null, "nichts lokal");
  await createGuestHandStore({ kv }).save(hand(2));
  assert.deepEqual(await shouldOfferHandImport(kv, "u1", null), hand(2));
  assert.equal(await shouldOfferHandImport(kv, "u1", hand(1)), null, "Konto hat schon eine");

  // Teilfehler: Speichern scheitert → Gast bleibt erhalten
  rows.failNext("updateRow", { code: 500 }, 1);
  await assert.rejects(() => importGuestHand(kv, cloud, hand(2)));
  assert.ok(await kv.getItem(GUEST_HAND_KEY));

  await importGuestHand(kv, cloud, hand(2));
  assert.equal(await kv.getItem(GUEST_HAND_KEY), null);
  assert.equal(glyphCount(await cloud.load()), 2);

  await createGuestHandStore({ kv }).save(hand(1));
  await markDeclined(kv, "u1");
  await markDeclined(kv, "u1");
  assert.deepEqual(await readDeclined(kv), ["u1"]);
  assert.equal(await shouldOfferHandImport(kv, "u1", null), null, "abgelehnt");
  assert.notEqual(await shouldOfferHandImport(kv, "u2", null), null, "anderes Konto");
});

test("Beschriftung", () => {
  assert.equal(handInfo(0, 60, false), "Jedes Zeichen einmal selbst schreiben.");
  assert.equal(handInfo(12, 60, true), "12 von 60 Zeichen gezeichnet · im Konto gespeichert");
  assert.equal(handInfo(3, 60, false), "3 von 60 Zeichen gezeichnet · auf diesem Gerät gespeichert");
});
