import { test } from "node:test";
import assert from "node:assert/strict";
import { createLimiter } from "../limiter";
import { memoryRows, memoryKv } from "../testing";

test("Limiter: höchstens 3 gleichzeitig", async () => {
  const limited = createLimiter(3, 1);
  let active = 0, peak = 0;
  await Promise.all(Array.from({ length: 10 }, () => limited(async () => { active++; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 5)); active--; })));
  assert.equal(peak, 3);
});

test("Limiter: wiederholt Serverfehler, 409 gilt als Erfolg", async () => {
  const limited = createLimiter(3, 1);
  let n = 0;
  assert.equal(await limited(async () => { if (++n < 3) throw { code: 500 }; return "ok"; }), "ok");
  assert.equal(await limited(async () => { throw { code: 409 }; }, { okOn409: true }), undefined);
  await assert.rejects(() => limited(async () => { throw { code: 400 }; }));
});

test("Testadapter: Zeilen nur für den Besitzer, 409 bei Doppel", async () => {
  const rows = memoryRows();
  await rows.createRow({ tableId: "t", rowId: "a", data: { userId: "u1" }, permissions: [] });
  await rows.createRow({ tableId: "t", rowId: "b", data: { userId: "u2" }, permissions: [] });
  assert.deepEqual((await rows.listAllRows("t", { userId: "u1" })).map((r) => r.$id), ["a"]);
  await assert.rejects(() => rows.createRow({ tableId: "t", rowId: "a", data: { userId: "u1" }, permissions: [] }), { code: 409 });
  const kv = memoryKv();
  await kv.setItem("k", "v");
  assert.equal(await kv.getItem("k"), "v");
  await kv.removeItem("k");
  assert.equal(await kv.getItem("k"), null);
});
