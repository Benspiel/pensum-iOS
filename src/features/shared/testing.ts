/* Testadapter für die Ports: reiner Speicher im RAM, ohne AsyncStorage und ohne Appwrite. Nur für Tests. */
import type { KeyValueStore, RowsApi, Row, TableIds } from "./ports";

export function memoryKv(initial: Record<string, string> = {}): KeyValueStore & { dump(): Record<string, string> } {
  const m = new Map(Object.entries(initial));
  return {
    async getItem(k) { return m.has(k) ? (m.get(k) as string) : null; },
    async setItem(k, v) { m.set(k, v); },
    async removeItem(k) { m.delete(k); },
    dump: () => Object.fromEntries(m),
  };
}

export const testTableIds: TableIds = { subjects: "subjects", grades: "grades", planner: "planner", decks: "decks", cards: "cards" };

export interface MemoryRows extends RowsApi {
  /** Rohzugriff für Assertions: tableId → Zeilen */
  tables: Map<string, Map<string, Row>>;
  /** Aufrufprotokoll, z. B. "create:planner:abc" */
  log: string[];
  /** Fehler für den nächsten passenden Aufruf einplanen, z. B. failNext("createRow", { code: 500 }) */
  failNext(method: "createRow" | "updateRow" | "deleteRow" | "listAllRows", error: unknown, times?: number): void;
}

export function memoryRows(): MemoryRows {
  const tables = new Map<string, Map<string, Row>>();
  const log: string[] = [];
  const failures = new Map<string, { error: unknown; times: number }>();
  let counter = 0, clock = 0;
  const table = (id: string) => { let t = tables.get(id); if (!t) tables.set(id, (t = new Map())); return t; };
  const maybeFail = (method: string) => {
    const f = failures.get(method);
    if (f && f.times > 0) { f.times--; throw f.error; }
  };
  return {
    tables, log,
    failNext(method, error, times = 1) { failures.set(method, { error, times }); },
    newId: () => "id" + (++counter).toString(36).padStart(6, "0"),
    ownerPermissions: (userId) => [`read("user:${userId}")`, `update("user:${userId}")`, `delete("user:${userId}")`],
    async createRow({ tableId, rowId, data, permissions }) {
      maybeFail("createRow");
      const t = table(tableId);
      if (t.has(rowId)) throw Object.assign(new Error("exists"), { code: 409 });
      t.set(rowId, { $id: rowId, $createdAt: String(++clock).padStart(10, "0"), $permissions: permissions, ...data });
      log.push(`create:${tableId}:${rowId}`);
    },
    async updateRow({ tableId, rowId, data }) {
      maybeFail("updateRow");
      const row = table(tableId).get(rowId);
      if (!row) throw Object.assign(new Error("not found"), { code: 404 });
      Object.assign(row, data);
      log.push(`update:${tableId}:${rowId}`);
    },
    async deleteRow({ tableId, rowId }) {
      maybeFail("deleteRow");
      if (!table(tableId).delete(rowId)) throw Object.assign(new Error("not found"), { code: 404 });
      log.push(`delete:${tableId}:${rowId}`);
    },
    async listAllRows(tableId, { userId }) {
      maybeFail("listAllRows");
      return [...table(tableId).values()].filter((r) => r.userId === userId).sort((a, b) => String(a.$createdAt).localeCompare(String(b.$createdAt)));
    },
  };
}
