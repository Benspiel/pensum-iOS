/* Karteikarten – Speicher.
 * Web-Quelle: tools/karteikarten/store.js (Pensum, Web-Commit 770dbe4).
 *
 * Zwei getrennte Speicher mit derselben Schnittstelle:
 *   Gast   → Schlüssel-Wert-Speicher dieses Geräts (deps.kv, auf iOS AsyncStorage; nichts verlässt das Gerät)
 *   Konto  → Appwrite-Tabellen „decks“ und „cards“ (deps.rows; Zeilen nur für den eigenen Benutzer lesbar)
 *
 * Die Oberfläche arbeitet mit einem einzigen Datenobjekt { decks: [{ id, name, mode, cards: [{ id, front, back, level }] }] }
 * und ruft nach jeder Änderung save(data) auf. Der Konto-Speicher vergleicht mit dem zuletzt gespeicherten Stand
 * und schreibt nur, was sich geändert hat (anlegen, ändern, löschen).
 *
 * Gast- und Konto-Daten werden nie vermischt: Gast-Daten landen nur auf ausdrücklichen Wunsch im Konto (siehe ops.ts).
 *
 * Unterschiede zum Web:
 *   - Gast lesen/schreiben ist async (AsyncStorage); Schreibzugriffe laufen nacheinander, save() liefert ein Promise<boolean>.
 *     Das synchrone peek() des Webs heißt hier async peek().
 *   - kein structuredClone: Momentaufnahmen entstehen per JSON (die Daten sind reines JSON).
 *   - kein ID.unique() aus dem SDK: IDs kommen aus deps.rows.newId() (Gast ohne rows: eigener Notbehelf).
 *   - Zeiten (Sammelpause, Wiederholpause) und Limiter sind als Optionen austauschbar (Standard = Web), damit Tests schnell laufen.
 *   - Cloud load() speichert zuvor Ausstehendes, statt es zu verwerfen (wichtig, falls Planer und Karteikarten einen Store teilen).
 */
import { MAX_DECKS, LEVELS } from "./core";
import type { Card, Deck, DeckMode, Level } from "./core";
import { createLimiter } from "../shared/limiter";
import type { StoreDeps, KeyValueStore, RowsApi, Row } from "../shared/ports";

export const GUEST_KEY = "pensum.karteikarten.v1";

export interface KarteikartenData {
  decks: Deck[];
}

const text = (v: unknown, n: number): string => String(v ?? "").slice(0, n);

/** Notbehelf für IDs, falls kein RowsApi.newId vorliegt (Appwrite-IDs: bis 36 Zeichen aus [A-Za-z0-9_.-], nicht mit Sonderzeichen beginnend). */
export function fallbackId(): string {
  return "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

const cleanCard = (c: any, newId: () => string): Card => ({
  id: text(c && c.id, 36) || newId(),
  front: text(c && c.front, 1000),
  back: text(c && c.back, 1000),
  level: Math.min(LEVELS, Math.max(1, Math.round(Number(c && c.level)) || 1)) as Level,
});
const cleanDeck = (d: any, newId: () => string): Deck => ({
  id: text(d && d.id, 36) || newId(),
  name: text(d && d.name, 80) || "Stapel",
  mode: d && d.mode === "level" ? "level" : "all",
  cards: (Array.isArray(d && d.cards) ? d.cards : []).slice(0, 2000).map((c: any) => cleanCard(c, newId)),
});

/** Macht aus beliebigen (auch kaputten) Daten ein gültiges Datenobjekt: höchstens 5 Stapel, 2000 Karten je Stapel, Längen und Level begrenzt. */
export function clean(data: unknown, newId: () => string = fallbackId): KarteikartenData {
  const raw = data && (data as { decks?: unknown }).decks;
  const decks: unknown[] = Array.isArray(raw) ? raw.slice(0, MAX_DECKS) : [];
  return { decks: decks.map((d) => cleanDeck(d, newId)) };
}

/** Tiefe Kopie über JSON (statt structuredClone, das in React Native nicht überall vorhanden ist). */
const snapshot = (data: KarteikartenData): KarteikartenData => JSON.parse(JSON.stringify(data));

/* ---------- Schnittstelle ---------- */

export interface GuestStore {
  kind: "guest";
  load(): Promise<KarteikartenData>;
  /** Wie load(); im Web synchron (peek), hier async. */
  peek(): Promise<KarteikartenData>;
  /** Liefert false, wenn der Speicher das Schreiben verweigert. Schreibzugriffe laufen nacheinander. */
  save(data: KarteikartenData): Promise<boolean>;
  /** Wartet, bis alle begonnenen Schreibzugriffe durch sind. */
  flush(): Promise<void>;
  clear(): Promise<void>;
  newId(): string;
}

export interface CloudStore {
  kind: "cloud";
  userId: string;
  load(): Promise<KarteikartenData>;
  /** Sammelt Änderungen und schreibt sie nach kurzer Pause in einem Rutsch. Liefert sofort true. */
  save(data: KarteikartenData): Promise<boolean>;
  /** Alles Ausstehende sofort speichern (vor dem Abmelden und beim Verlassen der App). */
  flush(): Promise<void>;
  newId(): string;
}

export type KarteikartenStore = GuestStore | CloudStore;

/* ---------- Gast: Schlüssel-Wert-Speicher ---------- */

export function createGuestStore(deps: { kv: KeyValueStore; rows?: Pick<RowsApi, "newId"> }): GuestStore {
  const { kv } = deps;
  const newId = () => (deps.rows ? deps.rows.newId() : fallbackId());
  const read = async (): Promise<KarteikartenData> => {
    try { return clean(JSON.parse((await kv.getItem(GUEST_KEY)) || "null"), newId); } catch (_) { return { decks: [] }; }
  };
  let chain: Promise<unknown> = Promise.resolve(); // Schreibzugriffe nacheinander; die Kette bricht nie ab
  const enqueue = <T>(op: () => Promise<T>): Promise<T> => {
    const p = chain.then(op);
    chain = p.then(() => undefined, () => undefined);
    return p;
  };
  return {
    kind: "guest",
    load: read,
    peek: read,
    save(data) {
      let json: string;
      try { json = JSON.stringify(data); } catch (_) { return Promise.resolve(false); } // Momentaufnahme jetzt, nicht erst beim Schreiben
      return enqueue(async () => {
        try { await kv.setItem(GUEST_KEY, json); return true; } catch (_) { return false; }
      });
    },
    async flush() { await chain; },
    clear() {
      return enqueue(async () => { try { await kv.removeItem(GUEST_KEY); } catch (_) { /* egal */ } });
    },
    newId,
  };
}

/* ---------- Konto: Appwrite ---------- */

export interface CloudOptions {
  /** Schreib-Limiter (Standard: ein gemeinsamer für alle Stores, höchstens 3 gleichzeitig, wie im Web). */
  limiter?: ReturnType<typeof createLimiter>;
  /** Pause nach der letzten Änderung, bevor gespeichert wird (Web: 600 ms). */
  syncDelayMs?: number;
  /** Pause bis zum nächsten Versuch nach einem Fehler (Web: 8000 ms). */
  retryDelayMs?: number;
}

/** Wie im Web ein Limiter für alle Konto-Stores zusammen. */
const sharedLimiter = createLimiter(3, 1500);

type DeckRow = { name: string; mode: DeckMode };
type CardRow = { deckId: string; front: string; back: string; level: Level };

/** Zeilen-Inhalt vergleichen: gleich, wenn alle Felder von a in b dieselben Werte haben. */
const same = (a: Record<string, unknown>, b: Record<string, unknown>) => Object.keys(a).every((k) => a[k] === b[k]);

export function createCloudStore(user: { $id: string }, deps: StoreDeps, options: CloudOptions = {}): CloudStore {
  const userId = user.$id;
  const { rows, tableIds } = deps;
  const onStatus = deps.onStatus ?? (() => {});
  const limited = options.limiter ?? sharedLimiter;
  const syncDelayMs = options.syncDelayMs ?? 600;
  const retryDelayMs = options.retryDelayMs ?? 8000;
  const permissions = rows.ownerPermissions(userId);
  // Zuletzt gespeicherter Stand: id → Zeilen-Inhalt (zum Vergleichen)
  const syncedDecks = new Map<string, DeckRow>();
  const syncedCards = new Map<string, CardRow>();
  let latest: KarteikartenData | null = null; // jüngster Stand der Oberfläche
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null; // laufende Synchronisation
  let again = false;
  let retry: ReturnType<typeof setTimeout> | null = null;

  const deckRow = (d: Deck): DeckRow => ({ name: d.name, mode: d.mode });
  const cardRow = (c: Card, deckId: string): CardRow => ({ deckId, front: c.front, back: c.back, level: c.level });

  async function sync(): Promise<void> {
    if (running) { again = true; return running; }
    running = (async () => {
      do {
        again = false;
        const snap = latest;
        if (!snap) break;
        onStatus("saving");
        try {
          await push(snap);
          if (!again && !timer) onStatus("saved");
        } catch (e) {
          onStatus("error", e);
          if (retry) clearTimeout(retry);
          retry = setTimeout(() => { void sync(); }, retryDelayMs); // später nochmal versuchen
          break;
        }
      } while (again);
    })().finally(() => { running = null; });
    return running;
  }

  /** Schreibt die Unterschiede zwischen snap und dem zuletzt gespeicherten Stand. */
  async function push(snap: KarteikartenData): Promise<void> {
    const wantDecks = new Map(snap.decks.map((d) => [d.id, d] as const));
    const wantCards = new Map<string, { card: Card; deckId: string }>();
    for (const d of snap.decks) for (const c of d.cards) wantCards.set(c.id, { card: c, deckId: d.id });
    const ops: Promise<unknown>[] = [];

    // 1) Stapel anlegen/ändern (vor den Karten)
    const deckOps: Promise<unknown>[] = [];
    for (const d of snap.decks) {
      const row = deckRow(d);
      const old = syncedDecks.get(d.id);
      if (!old) deckOps.push(limited(() => rows.createRow({ tableId: tableIds.decks, rowId: d.id, data: { userId, ...row }, permissions }), { okOn409: true }).then(() => syncedDecks.set(d.id, row)));
      else if (!same(row, old)) deckOps.push(limited(() => rows.updateRow({ tableId: tableIds.decks, rowId: d.id, data: row })).then(() => syncedDecks.set(d.id, row)));
    }
    await Promise.all(deckOps);

    // 2) Karten anlegen/ändern
    for (const [id, { card, deckId }] of wantCards) {
      const row = cardRow(card, deckId);
      const old = syncedCards.get(id);
      if (!old) ops.push(limited(() => rows.createRow({ tableId: tableIds.cards, rowId: id, data: { userId, ...row }, permissions }), { okOn409: true }).then(() => syncedCards.set(id, row)));
      else if (!same(row, old)) ops.push(limited(() => rows.updateRow({ tableId: tableIds.cards, rowId: id, data: row })).then(() => syncedCards.set(id, row)));
    }
    // 3) Gelöschte Karten und Stapel entfernen
    for (const id of [...syncedCards.keys()]) {
      if (!wantCards.has(id)) ops.push(limited(() => rows.deleteRow({ tableId: tableIds.cards, rowId: id }), { okOn404: true }).then(() => syncedCards.delete(id)));
    }
    await Promise.all(ops);
    const gone: Promise<unknown>[] = [];
    for (const id of [...syncedDecks.keys()]) {
      if (!wantDecks.has(id)) gone.push(limited(() => rows.deleteRow({ tableId: tableIds.decks, rowId: id }), { okOn404: true }).then(() => syncedDecks.delete(id)));
    }
    await Promise.all(gone);
  }

  /** Alles Ausstehende sofort speichern. */
  async function flush(): Promise<void> {
    if (timer) { clearTimeout(timer); timer = null; }
    if (retry) { clearTimeout(retry); retry = null; }
    if (latest) await sync();
    else if (running) await running;
  }

  return {
    kind: "cloud",
    userId,
    newId: () => rows.newId(),

    async load() {
      if (timer || running || retry) await flush(); // Ausstehendes nicht verwerfen
      const [decks, cards]: [Row[], Row[]] = await Promise.all([
        rows.listAllRows(tableIds.decks, { userId }),
        rows.listAllRows(tableIds.cards, { userId }),
      ]);
      syncedDecks.clear();
      syncedCards.clear();
      const byDeck = new Map<string, Array<Omit<Card, "level"> & { level: unknown }>>(decks.map((r) => [r.$id, []]));
      for (const r of cards) {
        syncedCards.set(r.$id, { deckId: r.deckId, front: r.front, back: r.back, level: r.level });
        const list = byDeck.get(r.deckId);
        if (list) list.push({ id: r.$id, front: r.front, back: r.back, level: r.level });
      }
      for (const r of decks) syncedDecks.set(r.$id, { name: r.name, mode: r.mode });
      latest = null;
      return clean({ decks: decks.map((r) => ({ id: r.$id, name: r.name, mode: r.mode, cards: byDeck.get(r.$id) })) }, () => rows.newId());
    },

    /** Änderungen sammeln und nach kurzer Pause in einem Rutsch speichern. */
    save(data) {
      latest = snapshot(data);
      if (timer) clearTimeout(timer);
      onStatus("saving");
      timer = setTimeout(() => { timer = null; void sync(); }, syncDelayMs);
      return Promise.resolve(true);
    },

    flush,
  };
}
