/* Goodnotes-Tool – eigene Handschrift speichern und laden.
 * Web-Quelle: tools/goodnotes/goodnotes.js (Abschnitt „Eigene Handschrift: speichern und laden“, offerHandImport), Web-Commit 770dbe4.
 * Gast: KeyValueStore (Schlüssel wie im Web) · Konto: Tabelle „handwriting“, eine Zeile je Benutzer (Zeilen-ID = Benutzer-ID),
 * Feld `glyphs` = JSON der gepackten Handschrift, lesbar/änderbar nur für den Besitzer.
 * Die gepackte Form (`packed`) erzeugt und liest die Engine (unpackHand); hier wird sie nur durchgereicht. */
import type { KeyValueStore, RowsApi } from "../shared/ports";

export const GUEST_HAND_KEY = "pensum.goodnotes.hand.guest.v1";
export const HAND_DECLINED_KEY = "pensum.goodnotes.handImportDeclined.v1";

export interface PackedHand { glyphs: Record<string, unknown>; [k: string]: unknown; }
export interface HandDeps { kv: KeyValueStore; rows: RowsApi; tableId: string; }

/** Nur Handschriften mit mindestens einem Zeichen zählen (Web: `Object.keys(hand.glyphs).length`). */
export function isUsableHand(p: unknown): p is PackedHand {
  return !!p && typeof p === "object" && !!(p as PackedHand).glyphs && typeof (p as PackedHand).glyphs === "object"
    && Object.keys((p as PackedHand).glyphs).length > 0;
}

export const glyphCount = (p: PackedHand | null): number => (p ? Object.keys(p.glyphs).length : 0);

const parse = (raw: string | null): unknown => { if (!raw) return null; try { return JSON.parse(raw); } catch (_) { return null; } };

export interface HandStore {
  kind: "guest" | "cloud";
  load(): Promise<PackedHand | null>;
  save(packed: PackedHand): Promise<void>;
  remove(): Promise<void>;
}

export function createGuestHandStore(deps: Pick<HandDeps, "kv">): HandStore {
  return {
    kind: "guest",
    async load() { const p = parse(await deps.kv.getItem(GUEST_HAND_KEY)); return isUsableHand(p) ? p : null; },
    async save(packed) { await deps.kv.setItem(GUEST_HAND_KEY, JSON.stringify(packed)); },
    async remove() { await deps.kv.removeItem(GUEST_HAND_KEY); },
  };
}

const isCode = (e: unknown, code: number) => !!e && (e as { code?: number }).code === code;

export function createCloudHandStore(user: { $id: string }, deps: HandDeps): HandStore {
  const rowId = user.$id;
  return {
    kind: "cloud",
    async load() {
      const rows = await deps.rows.listAllRows(deps.tableId, { userId: user.$id });
      const row = rows.find((r) => r.$id === rowId);
      const p = parse(row && typeof row.glyphs === "string" ? row.glyphs : null);
      return isUsableHand(p) ? p : null;
    },
    /** Upsert: erst ändern, gibt es die Zeile nicht (404), anlegen; 409 beim Anlegen heißt, sie ist inzwischen da → ändern. */
    async save(packed) {
      const data = { userId: user.$id, glyphs: JSON.stringify(packed) };
      const update = () => deps.rows.updateRow({ tableId: deps.tableId, rowId, data: { glyphs: data.glyphs } });
      try { await update(); return; } catch (e) { if (!isCode(e, 404)) throw e; }
      try {
        await deps.rows.createRow({ tableId: deps.tableId, rowId, data, permissions: deps.rows.ownerPermissions(user.$id) });
      } catch (e) { if (isCode(e, 409)) { await update(); return; } throw e; }
    },
    async remove() {
      try { await deps.rows.deleteRow({ tableId: deps.tableId, rowId }); } catch (e) { if (!isCode(e, 404)) throw e; }
    },
  };
}

/* ---------- Gast → Konto ---------- */

export async function readDeclined(kv: KeyValueStore): Promise<string[]> {
  const v = parse(await kv.getItem(HAND_DECLINED_KEY));
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
export async function markDeclined(kv: KeyValueStore, userId: string): Promise<void> {
  await kv.setItem(HAND_DECLINED_KEY, JSON.stringify([...new Set([...(await readDeclined(kv)), userId])]));
}

export const importPrompt = {
  title: "Lokale Handschrift übernehmen?",
  text: "Auf diesem Gerät liegt eine Handschrift aus dem Gast-Modus. Soll sie in dein Konto übernommen werden? Sonst bleibt sie getrennt auf diesem Gerät.",
  confirm: "Ins Konto übernehmen",
  cancel: "Nicht übernehmen",
};

/** Soll beim Login die Übernahme angeboten werden? (Web: offerHandImport – nur mit lokaler Handschrift, ohne Konto-Handschrift, nicht abgelehnt.) */
export async function shouldOfferHandImport(kv: KeyValueStore, userId: string, accountHand: PackedHand | null): Promise<PackedHand | null> {
  if (accountHand) return null;
  const local = await createGuestHandStore({ kv }).load();
  if (!local) return null;
  return (await readDeclined(kv)).includes(userId) ? null : local;
}

/** Übernimmt die Gast-Handschrift ins Konto; der Gast-Eintrag wird erst nach erfolgreichem Speichern gelöscht. */
export async function importGuestHand(kv: KeyValueStore, cloud: HandStore, local: PackedHand): Promise<void> {
  await cloud.save(local);
  await createGuestHandStore({ kv }).remove();
}

export const handInfo = (n: number, total: number, cloud: boolean): string =>
  n ? `${n} von ${total} Zeichen gezeichnet · ${cloud ? "im Konto gespeichert" : "auf diesem Gerät gespeichert"}` : "Jedes Zeichen einmal selbst schreiben.";
