/* Schmale Ports, über die die Lernwerkzeuge (Notenrechner, Planer, Karteikarten) Daten lesen und schreiben.
 * Die Features kennen weder AsyncStorage noch das Appwrite-SDK: A hängt dort die echten Adapter ein
 * (siehe PENSUM-IOS-STATUS.md → Verträge). Dadurch laufen Kern und Speicher ohne Gerät unter Tests.
 * Eigentümer: Rolle B (src/features/shared/**). Wandert bei Bedarf nach src/contracts, wenn A2 ihn dort bündelt. */

/** Gastdaten. Auf iOS: AsyncStorage. Schlüssel bleiben identisch zum Web (z. B. "pensum.planer.v1"). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type Row = { $id: string } & Record<string, any>;

/** Kontodaten. Dahinter: Appwrite TablesDB mit Zeilenrechten nur für den Besitzer. */
export interface RowsApi {
  /** = ID.unique() */
  newId(): string;
  /** read/update/delete nur für den Besitzer (Permission.read(Role.user(id)) usw.) */
  ownerPermissions(userId: string): string[];
  createRow(a: { tableId: string; rowId: string; data: Record<string, unknown>; permissions: string[] }): Promise<unknown>;
  updateRow(a: { tableId: string; rowId: string; data: Record<string, unknown> }): Promise<unknown>;
  deleteRow(a: { tableId: string; rowId: string }): Promise<unknown>;
  /** Alle Zeilen des Benutzers, nach $createdAt aufsteigend (seitenweise Abfrage macht der Adapter). */
  listAllRows(tableId: string, filter: { userId: string }): Promise<Row[]>;
}

/** Tabellen-IDs wie in js/config.js → config.tables. */
export interface TableIds {
  subjects: string;
  grades: string;
  planner: string;
  decks: string;
  cards: string;
}

export type SaveStatus = "saving" | "saved" | "error";

export interface StoreDeps {
  kv: KeyValueStore;
  rows: RowsApi;
  tableIds: TableIds;
  onStatus?: (status: SaveStatus, error?: unknown) => void;
}

export type StoreKind = "guest" | "cloud";
