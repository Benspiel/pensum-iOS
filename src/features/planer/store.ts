/* Planer – Speicher. Gast: Key-Value-Speicher des Geräts (AsyncStorage über deps.kv) · Konto: Appwrite-Tabelle „planner“
 * über deps.rows (nur für den Besitzer lesbar).
 * Web-Quelle: tools/planer/store.js (Pensum, Web-Commit 770dbe4).
 *
 * Die Oberfläche arbeitet mit einer Liste { items: [...] } und ruft nach jeder Änderung save(data) auf.
 * Der Konto-Speicher vergleicht mit dem zuletzt gespeicherten Stand und schreibt nur die Unterschiede.
 * Gast- und Konto-Daten werden nie vermischt: Gast-Daten kommen nur auf ausdrücklichen Wunsch ins Konto.
 *
 * Abweichungen vom Web (Plattform-bedingt): Gast-Zugriffe sind async (AsyncStorage), `peek()` entfällt,
 * `save()` und `clear()` geben ein Promise zurück (save → false, wenn das Gerät das Schreiben verweigert),
 * Gast-Schreibzugriffe laufen nacheinander. Neu: newId() am Store, dispose() am Cloud-Store (Timer stoppen). */
import { createLimiter } from "../shared/limiter";
import type { KeyValueStore, StoreDeps } from "../shared/ports";
import { MAX_ITEMS, parseDay, type PlanData, type PlanItem } from "./core";

export const GUEST_KEY = "pensum.planer.v1";

const text = (v: unknown, n: number) => String(v ?? "").slice(0, n);

/** Neue ID für Gast-Einträge (nur lokal). Höchstens 36 Zeichen. */
export function newGuestId(): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch (_) { /* weiter mit Fallback */ }
  return Date.now().toString(36) + Math.random().toString(16).slice(2, 18);
}

/** Einen Eintrag auf gültige Werte bringen (Längen, Art, Datum, Erledigt-Flag). `makeId` füllt eine fehlende ID. */
export function cleanItem(i: Partial<Record<keyof PlanItem, unknown>>, makeId: () => string = newGuestId): PlanItem {
  return {
    id: text(i.id, 36) || makeId(),
    kind: i.kind === "exam" ? "exam" : "task",
    title: text(i.title, 120).trim() || "Ohne Titel",
    subject: text(i.subject, 60).trim(),
    date: parseDay(i.date) == null ? "" : String(i.date),
    note: text(i.note, 500),
    done: i.kind === "exam" ? false : !!i.done,
    deckId: text(i.deckId, 36),
  };
}

/** Beliebige (auch kaputte) Daten in { items } mit höchstens MAX_ITEMS gültigen Einträgen verwandeln. */
export function clean(data: unknown, makeId: () => string = newGuestId): PlanData {
  const raw = data && typeof data === "object" ? (data as { items?: unknown }).items : undefined;
  const items = Array.isArray(raw) ? raw.slice(0, MAX_ITEMS) : [];
  return { items: items.map((i) => cleanItem(i && typeof i === "object" ? i : {}, makeId)) };
}

/* ---------- Gast ---------- */

export interface GuestPlanStore {
  kind: "guest";
  newId(): string;
  load(): Promise<PlanData>;
  /** true = geschrieben, false = das Gerät hat das Schreiben verweigert */
  save(data: PlanData): Promise<boolean>;
  flush(): Promise<void>;
  /** Gast: wie flush() (es gibt nichts, das ein Konto verfehlen könnte). */
  flushOrThrow(): Promise<void>;
  clear(): Promise<void>;
}

export function createGuestStore(deps: Pick<StoreDeps, "kv" | "onStatus">): GuestPlanStore {
  const { kv, onStatus } = deps;
  const read = async (store: KeyValueStore): Promise<PlanData> => {
    try { return clean(JSON.parse((await store.getItem(GUEST_KEY)) || "null")); } catch (_) { return { items: [] }; }
  };
  // Zugriffe laufen nacheinander, damit die zuletzt gespeicherte Liste auch zuletzt ankommt
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(op: () => Promise<T>): Promise<T> => {
    const run = queue.then(op, op);
    queue = run.then(() => undefined, () => undefined);
    return run;
  };
  return {
    kind: "guest",
    newId: newGuestId,
    load: () => serial(() => read(kv)),
    save(data) {
      let json: string;
      try { json = JSON.stringify(data); } catch (_) { return Promise.resolve(false); } // Stand jetzt festhalten: die Oberfläche ändert die Liste weiter
      return serial(async () => {
        try { await kv.setItem(GUEST_KEY, json); return true; } catch (e) { onStatus?.("error", e); return false; }
      });
    },
    async flush() { await queue; },
    async flushOrThrow() { await queue; },
    clear() {
      return serial(async () => { try { await kv.removeItem(GUEST_KEY); } catch (_) { /* egal */ } });
    },
  };
}

/* ---------- Konto ---------- */

/** Höchstens 3 Schreibzugriffe gleichzeitig und Wiederholung bei Serverfehlern (ein Limiter für dieses Modul). */
const limited = createLimiter();

type RowFields = { kind: string; title: string; subject: string | null; date: string | null; note: string | null; deckId: string | null; done: boolean };

/** Zeile in der Tabelle: leere Texte werden als null gespeichert. */
const toRow = (i: PlanItem): RowFields => ({ kind: i.kind, title: i.title, subject: i.subject || null, date: i.date || null, note: i.note || null, deckId: i.deckId || null, done: !!i.done });
const same = (a: RowFields, b: RowFields) => (Object.keys(a) as Array<keyof RowFields>).every((k) => a[k] === b[k]);

export interface CloudPlanStore {
  kind: "cloud";
  userId: string;
  newId(): string;
  load(): Promise<PlanData>;
  /** Merkt den Stand vor und speichert nach 600 ms nur die Unterschiede. Gibt sofort true zurück. */
  save(data: PlanData): Promise<boolean>;
  /** Alles Ausstehende sofort speichern (vor dem Abmelden und beim Verlassen der App). */
  flush(): Promise<void>;
  /**
   * Wie flush(), aber streng (vor dem Abmelden, vor dem Löschen von Gast-Daten): wartet auf alle Schreibvorgänge und
   * lehnt ab, wenn ein Versuch gescheitert ist oder noch Änderungen ungespeichert sind. Ein früherer Fehler wird dabei einmal neu versucht.
   */
  flushOrThrow(): Promise<void>;
  /** Timer stoppen (Abmelden, Kontowechsel). Ausstehendes vorher mit flush() speichern. */
  dispose(): void;
}

export function createCloudStore(deps: StoreDeps, user: { $id: string }): CloudPlanStore {
  const { rows, tableIds } = deps;
  const onStatus: NonNullable<StoreDeps["onStatus"]> = deps.onStatus || (() => {});
  const userId = user.$id;
  const permissions = rows.ownerPermissions(userId);
  const tableId = tableIds.planner;
  const synced = new Map<string, RowFields>(); // id → zuletzt gespeicherte Zeile
  let latest: PlanData | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  let again = false;
  let failure: { error: unknown } | null = null; // letzter Versuch gescheitert (bis ein Durchlauf gelingt)

  /** Gibt es Einträge, die das Konto (laut letztem bekannten Stand) noch nicht hat? */
  function unsaved(): boolean {
    if (!latest) return false;
    const want = new Set(latest.items.map((i) => i.id));
    for (const i of latest.items) { const old = synced.get(i.id); if (!old || !same(toRow(i), old)) return true; }
    for (const id of synced.keys()) if (!want.has(id)) return true;
    return false;
  }

  async function push(snap: PlanData) {
    const want = new Map(snap.items.map((i) => [i.id, i]));
    const ops: Array<Promise<unknown>> = [];
    for (const i of snap.items) {
      const row = toRow(i), old = synced.get(i.id);
      if (!old) ops.push(limited(() => rows.createRow({ tableId, rowId: i.id, data: { userId, ...row }, permissions }), { okOn409: true }).then(() => synced.set(i.id, row)));
      else if (!same(row, old)) ops.push(limited(() => rows.updateRow({ tableId, rowId: i.id, data: row })).then(() => synced.set(i.id, row)));
    }
    for (const id of [...synced.keys()]) {
      if (!want.has(id)) ops.push(limited(() => rows.deleteRow({ tableId, rowId: id }), { okOn404: true }).then(() => synced.delete(id)));
    }
    // alle Schreibvorgänge abwarten, auch wenn einer scheitert (sonst laufen die übrigen unbemerkt weiter)
    const results = await Promise.allSettled(ops);
    const bad = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (bad) throw bad.reason;
  }

  function sync(): Promise<void> {
    if (running) { again = true; return running; }
    running = (async () => {
      do {
        again = false;
        if (!latest) break;
        onStatus("saving");
        try {
          await push(latest);
          failure = null;
          if (!again && !timer) onStatus("saved");
        } catch (e) {
          failure = { error: e };
          onStatus("error", e);
          if (retry) clearTimeout(retry);
          retry = setTimeout(() => { void sync(); }, 8000); // später erneut versuchen
          break;
        }
      } while (again);
    })().finally(() => { running = null; });
    return running;
  }

  return {
    kind: "cloud",
    userId,
    newId: () => rows.newId(),
    async load() {
      const list = await rows.listAllRows(tableId, { userId });
      synced.clear();
      const items = list.map((r) => {
        const item: PlanItem = { id: r.$id, kind: r.kind, title: r.title, subject: r.subject || "", date: r.date || "", note: r.note || "", deckId: r.deckId || "", done: !!r.done };
        synced.set(r.$id, toRow(cleanItem(item, () => r.$id)));
        return item;
      });
      latest = null;
      failure = null;
      return clean({ items }, () => rows.newId());
    },
    save(data) {
      latest = { items: data.items.map((i) => ({ ...i })) }; // Kopie: die Oberfläche ändert ihre Liste weiter
      if (timer) clearTimeout(timer);
      onStatus("saving");
      timer = setTimeout(() => { timer = null; void sync(); }, 600);
      return Promise.resolve(true);
    },
    async flush() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (retry) { clearTimeout(retry); retry = null; }
      if (latest) await sync(); else if (running) await running;
    },
    async flushOrThrow() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (retry) { clearTimeout(retry); retry = null; }
      if (latest) await sync();
      while (running) await running;
      if (failure) throw failure.error ?? new Error("Speichern fehlgeschlagen");
      if (timer || unsaved()) throw new Error("Änderungen sind noch nicht gespeichert");
    },
    dispose() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (retry) { clearTimeout(retry); retry = null; }
    },
  };
}
