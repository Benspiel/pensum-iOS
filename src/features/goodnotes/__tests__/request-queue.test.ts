import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createHostSupervisor, createRequestQueue, createRestartPolicy, deleteQuietly, ENGINE_TIMEOUT_MESSAGE, ENGINE_TIMEOUT_MS,
  EXPORT_TIMEOUT_MS, HostRequestError, timeoutForType, type TimerApi,
} from "../request-queue";
import { createIdGenerator } from "../protocol";

/** Gefälschte Uhr: Timer laufen nur, wenn die Zeit vorgestellt wird. */
function fakeClock() {
  let now = 0, n = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const api: TimerApi = {
    set(fn, ms) { const id = ++n; timers.set(id, { at: now + ms, fn }); return id; },
    clear(h) { timers.delete(h as number); },
  };
  return {
    api, get now() { return now; }, get active() { return timers.size; },
    advance(ms: number) {
      now += ms;
      for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); }
    },
  };
}

function setup() {
  const clock = fakeClock();
  const sent: any[] = [];
  const queue = createRequestQueue({ send: (j) => sent.push(JSON.parse(j)), newId: createIdGenerator("t"), timers: clock.api });
  return { clock, sent, queue };
}

test("Zeitlimit: Export 60 s, alles andere 20 s", () => {
  assert.equal(ENGINE_TIMEOUT_MS, 20_000);
  assert.equal(EXPORT_TIMEOUT_MS, 60_000);
  for (const t of ["render", "template", "clear-template", "set-hand", "pack"]) assert.equal(timeoutForType(t), 20_000, t);
  for (const t of ["export-pdf", "export-goodnotes"]) assert.equal(timeoutForType(t), 60_000, t);
});

test("Anfrage bekommt eine ID und wird beantwortet; der Timer ist danach weg", async () => {
  const { clock, sent, queue } = setup();
  const p = queue.request({ type: "render", text: "x" });
  assert.deepEqual(sent, [{ type: "render", text: "x", id: "t1" }]);
  assert.equal(queue.size, 1);
  assert.equal(queue.resolve("t1", { type: "rendered" }), true);
  assert.deepEqual(await p, { type: "rendered" });
  assert.equal(queue.size, 0);
  assert.equal(clock.active, 0);
  assert.equal(queue.resolve("t1", 1), false, "zweite Antwort wird ignoriert");
});

test("Zeitlimit: nach 20 s reject, Anfrage ist aus der Liste, späte Antwort wird verworfen", async () => {
  const { clock, queue } = setup();
  const p = queue.request({ type: "render" });
  clock.advance(19_999);
  assert.equal(queue.size, 1);
  clock.advance(1);
  await assert.rejects(p, (e: unknown) => e instanceof HostRequestError && e.reason === "timeout" && e.message === "Die Engine antwortet nicht.");
  assert.equal(ENGINE_TIMEOUT_MESSAGE, "Die Engine antwortet nicht.");
  assert.equal(queue.size, 0);
  assert.equal(queue.resolve("t1", {}), false);
});

test("Zeitlimit: Export darf bis 60 s dauern", async () => {
  const { clock, queue } = setup();
  const p = queue.request({ type: "export-pdf" });
  clock.advance(59_999);
  assert.equal(queue.size, 1);
  queue.resolve("t1", "ok");
  assert.equal(await p, "ok");
  const q = queue.request({ type: "export-goodnotes" });
  clock.advance(60_000);
  await assert.rejects(q, /antwortet nicht/);
  assert.equal(queue.size, 0);
});

test("Fehlerantwort lehnt ab und räumt auf", async () => {
  const { clock, queue } = setup();
  const p = queue.request({ type: "export-pdf" });
  queue.reject("t1", new Error("Es gibt noch nichts zum Exportieren."));
  await assert.rejects(p, /nichts zum Exportieren/);
  assert.equal(clock.active, 0);
});

test("abortAll beendet alle offenen Anfragen, neue sind danach wieder möglich", async () => {
  const { clock, queue } = setup();
  const a = queue.request({ type: "render" }), b = queue.request({ type: "export-pdf" });
  const caught = [a, b].map((p) => p.catch((e) => e));
  queue.abortAll(new HostRequestError("weg", "aborted"));
  for (const e of await Promise.all(caught)) assert.ok(e instanceof HostRequestError && e.reason === "aborted");
  assert.equal(queue.size, 0);
  assert.equal(clock.active, 0, "keine Timer übrig");
  const c = queue.request({ type: "render" });
  queue.resolve("t3", "neu");
  assert.equal(await c, "neu");
});

test("dispose (Unmount): offene Anfragen abbrechen, Timer löschen, danach sofort ablehnen", async () => {
  const { clock, sent, queue } = setup();
  const a = queue.request({ type: "render" });
  const caught = a.catch((e) => e);
  queue.dispose();
  const e = await caught;
  assert.ok(e instanceof HostRequestError && e.reason === "closed");
  assert.equal(clock.active, 0);
  await assert.rejects(queue.request({ type: "render" }), (x: unknown) => x instanceof HostRequestError && x.reason === "closed");
  assert.equal(sent.length, 1, "nach dispose wird nichts mehr gesendet");
});

test("Senden schlägt fehl: reject, nichts bleibt hängen", async () => {
  const clock = fakeClock();
  const queue = createRequestQueue({ send: () => { throw new Error("WebView weg"); }, newId: createIdGenerator("t"), timers: clock.api });
  await assert.rejects(queue.request({ type: "render" }), /WebView weg/);
  assert.equal(queue.size, 0);
  assert.equal(clock.active, 0);
  assert.doesNotThrow(() => queue.notify({ type: "next" }));
});

test("notify sendet ohne ID und ohne Timer", () => {
  const { clock, sent, queue } = setup();
  queue.notify({ type: "next" });
  assert.deepEqual(sent, [{ type: "next" }]);
  assert.equal(clock.active, 0);
});

test("Neustart-Regel: höchstens 3 je Minute", () => {
  let t = 0;
  const policy = createRestartPolicy({ now: () => t });
  assert.deepEqual([policy.allow(), policy.allow(), policy.allow(), policy.allow()], [true, true, true, false]);
  t = 59_000; assert.equal(policy.allow(), false);
  t = 60_001; assert.equal(policy.allow(), true, "nach Ablauf des Fensters wieder erlaubt");
});

test("Absturz: Anfragen abbrechen, ready zurücksetzen, neu laden; nach zu vielen Abstürzen aufgeben", async () => {
  const { queue } = setup();
  const log: string[] = [];
  const sup = createHostSupervisor({
    queue: () => queue, policy: createRestartPolicy({ max: 2 }),
    restart: () => log.push("restart"), onDown: () => log.push("down"), onGiveUp: () => log.push("giveup"),
  });
  const p = queue.request({ type: "render" });
  const caught = p.catch((e) => e);
  assert.equal(sup.handleTerminated(), true);
  const e = await caught;
  assert.ok(e instanceof HostRequestError && e.reason === "aborted" && /neu gestartet/.test(e.message));
  assert.deepEqual(log, ["down", "restart"]);
  assert.equal(sup.handleTerminated(), true);
  assert.equal(sup.handleTerminated(), false);
  assert.deepEqual(log, ["down", "restart", "down", "restart", "down", "giveup"]);
});

test("deleteQuietly: löscht vorhandene Dateien, schluckt Fehler, mag fehlende Dateien", () => {
  let deleted = 0;
  assert.equal(deleteQuietly({ exists: true, delete: () => { deleted++; } }), true);
  assert.equal(deleted, 1);
  assert.equal(deleteQuietly({ exists: false, delete: () => { deleted++; } }), true);
  assert.equal(deleted, 1);
  assert.equal(deleteQuietly({ exists: true, delete: () => { throw new Error("gesperrt"); } }), false);
  assert.equal(deleteQuietly(null), true);
});
