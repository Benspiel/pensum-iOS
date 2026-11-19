/* Notenrechner – Speicher.
 * Web-Quelle: tools/notenrechner/store.js (Pensum, Web-Commit 770dbe4).
 *
 * Zwei getrennte Speicher mit derselben Schnittstelle:
 *   Gast   → Key-Value-Speicher des Geräts (AsyncStorage über den Port deps.kv; nichts verlässt das Gerät)
 *   Konto  → Appwrite-Tabellen „subjects“ und „grades“ über den Port deps.rows (nur für den eigenen Benutzer lesbar)
 *
 * Die beiden werden nie vermischt: Konto-Daten landen nicht im Gastspeicher, Gast-Daten nur
 * auf ausdrücklichen Wunsch (importGuestData) im Konto.
 *
 * Fach:  { id, name, schoolYear }
 * Note:  { id, subjectId, label, value, system: "note" | "punkte", weight, half: 1 | 2 }
 *
 * Abweichungen vom Web (Plattform-bedingt): Gast-Zugriffe sind async (AsyncStorage), `peek()` entfällt,
 * Schreibzugriffe laufen nacheinander (eine Warteschlange), `clear()` ist async.
 */
import { createLimiter } from "../shared/limiter";
import type { KeyValueStore, StoreDeps } from "../shared/ports";
import type { Grade, Half, Subject, System } from "./core";

export const GUEST_KEY = "pensum.notenrechner.guest.v1";

export interface NotenData {
  subjects: Subject[];
  grades: Grade[];
}

type SubjectInput = Pick<Subject, "id" | "name" | "schoolYear">;
type GradeInput = Pick<Grade, "id" | "subjectId" | "value" | "weight"> & Partial<Pick<Grade, "label" | "system" | "half">>;

const cleanSubject = (s: SubjectInput): Subject => ({ id: s.id, name: String(s.name || "").slice(0, 120), schoolYear: s.schoolYear });
const cleanGrade = (g: GradeInput): Grade => ({
  id: g.id,
  subjectId: g.subjectId,
  label: String(g.label || "").slice(0, 120),
  value: g.value,
  system: (g.system === "punkte" ? "punkte" : "note") as System,
  weight: g.weight,
  half: (g.half === 2 ? 2 : 1) as Half,
});

/** Zeilendaten ohne `id` (die Zeilen-ID steckt in $id). */
const rowData = <T extends { id: string }>({ id: _id, ...rest }: T): Omit<T, "id"> => rest;

/** Neue ID für Gast-Einträge (nur lokal; beim Import ins Konto werden sie durch ID.unique() ersetzt). Höchstens 36 Zeichen. */
export function newGuestId(): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch (_) { /* weiter mit Fallback */ }
  return Date.now().toString(36) + Math.random().toString(16).slice(2, 18);
}

/* ---------- Gast: Key-Value-Speicher ---------- */

export interface GuestStore {
  kind: "guest";
  newId(): string;
  load(): Promise<NotenData>;
  addSubject(s: SubjectInput): Promise<void>;
  updateSubject(id: string, changes: Partial<Omit<Subject, "id">>): Promise<void>;
  removeSubject(id: string): Promise<void>;
  addGrade(g: GradeInput): Promise<void>;
  updateGrade(id: string, changes: Partial<Omit<Grade, "id">>): Promise<void>;
  removeGrade(id: string): Promise<void>;
  flush(): Promise<void>;
  /** Wie flush(); für den Gast-Store ohne Wirkung außer dem Warten auf laufende Schreibzugriffe (vor dem Abmelden). */
  flushOrThrow(): Promise<void>;
  clear(): Promise<void>;
}

const empty = (): NotenData => ({ subjects: [], grades: [] });

async function readGuest(kv: KeyValueStore): Promise<NotenData> {
  try {
    const data = JSON.parse((await kv.getItem(GUEST_KEY)) || "null");
    if (data && Array.isArray(data.subjects) && Array.isArray(data.grades)) return data as NotenData;
  } catch (_) { /* kaputte oder gesperrte Daten: leer starten */ }
  return empty();
}

export function createGuestStore(deps: Pick<StoreDeps, "kv" | "onStatus">): GuestStore {
  const { kv, onStatus } = deps;
  // Alle Zugriffe laufen nacheinander: jede Änderung liest den aktuellen Stand, ändert und schreibt zurück,
  // erst danach kommt die nächste dran. So geht bei schnell aufeinanderfolgenden Aufrufen nichts verloren.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(op: () => Promise<T>): Promise<T> => {
    const run = queue.then(op, op);
    queue = run.then(() => undefined, () => undefined);
    return run;
  };
  const mutate = (change: (data: NotenData) => void): Promise<void> =>
    serial(async () => {
      const data = await readGuest(kv);
      change(data);
      try {
        await kv.setItem(GUEST_KEY, JSON.stringify(data));
      } catch (e) {
        onStatus?.("error", e); // wie im Web nicht abbrechen, aber den Fehler melden
      }
    });
  const patch = <T extends { id: string }>(list: T[], id: string, changes: Partial<T>) => {
    const item = list.find((x) => x.id === id);
    if (item) Object.assign(item, changes);
  };

  return {
    kind: "guest",
    newId: newGuestId,
    load: () => serial(() => readGuest(kv)),
    addSubject(s) { const v = cleanSubject(s); return mutate((d) => { d.subjects.push(v); }); },
    updateSubject(id, changes) { const c = { ...changes }; return mutate((d) => patch(d.subjects, id, c)); },
    removeSubject(id) {
      return mutate((d) => {
        d.subjects = d.subjects.filter((s) => s.id !== id);
        d.grades = d.grades.filter((g) => g.subjectId !== id);
      });
    },
    addGrade(g) { const v = cleanGrade(g); return mutate((d) => { d.grades.push(v); }); },
    updateGrade(id, changes) { const c = { ...changes }; return mutate((d) => patch(d.grades, id, c)); },
    removeGrade(id) { return mutate((d) => { d.grades = d.grades.filter((g) => g.id !== id); }); },
    async flush() { await queue; },
    async flushOrThrow() { await queue; },
    clear() {
      return serial(async () => {
        try { await kv.removeItem(GUEST_KEY); } catch (_) { /* egal */ }
      });
    },
  };
}

/* ---------- Konto: Appwrite ---------- */

/** Höchstens 3 Schreibzugriffe gleichzeitig und Wiederholung bei Serverfehlern (ein Limiter für dieses Modul). */
const limited = createLimiter();

export interface CloudStore {
  kind: "cloud";
  userId: string;
  newId(): string;
  isIdle(): boolean;
  load(): Promise<NotenData>;
  addSubject(s: SubjectInput): Promise<unknown>;
  updateSubject(id: string, changes: Partial<Omit<Subject, "id">>): Promise<void>;
  /** gradeIds: Noten des Fachs, die mit gelöscht werden (Tabellen kennen keine Kaskade). */
  removeSubject(id: string, gradeIds?: string[]): Promise<unknown>;
  addGrade(g: GradeInput): Promise<unknown>;
  updateGrade(id: string, changes: Partial<Omit<Grade, "id">>): Promise<void>;
  removeGrade(id: string): Promise<unknown>;
  /** Alles Ausstehende sofort speichern (beim Verlassen der App). Fehler werden verschluckt, siehe flushOrThrow. */
  flush(): Promise<void>;
  /**
   * Wie flush(), wartet aber auf alle ausstehenden Schreibvorgänge (auch die gesammelten 600-ms-Änderungen) und lehnt ab,
   * wenn ein Schreibvorgang gescheitert ist und seine Zeile seither nicht erfolgreich geschrieben wurde (z. B. vor dem Abmelden).
   */
  flushOrThrow(): Promise<void>;
  /** Gescheiterte Schreibvorgänge für diese Zeilen vergessen (die Daten wurden unter neuen IDs neu geschrieben, z. B. Wiederholung der Gast-Übernahme). */
  forgetFailures(rowIds: readonly string[]): void;
}

export function createCloudStore(deps: StoreDeps, user: { $id: string }): CloudStore {
  const { rows, tableIds } = deps;
  const onStatus: NonNullable<StoreDeps["onStatus"]> = deps.onStatus || (() => {});
  const userId = user.$id;
  const permissions = rows.ownerPermissions(userId);
  const chains = new Map<string, Promise<void>>();  // Zeilen-ID → letzte laufende Operation (hält die Reihenfolge je Zeile ein)
  const pending = new Map<string, { tableId: string; data: Record<string, unknown>; timer: ReturnType<typeof setTimeout> | null }>(); // gesammelte Änderungen
  let busy = 0, failed = false;
  const failedRows = new Map<string, unknown>(); // Zeilen-ID → Fehler des letzten gescheiterten Schreibvorgangs

  const settle = (rowId: string, error?: unknown) => {
    busy--;
    if (error) { failed = true; failedRows.set(rowId, error); onStatus("error", error); }
    else if (busy === 0 && pending.size === 0) { if (!failed) onStatus("saved"); }
  };

  // Operation für eine Zeile hinten an deren Kette hängen
  function enqueue<T>(rowId: string, op: () => Promise<T>): Promise<T> {
    busy++;
    failed = false;
    onStatus("saving");
    const run = (chains.get(rowId) || Promise.resolve()).then(op);
    const tail: Promise<void> = run.then(() => { failedRows.delete(rowId); settle(rowId); }, (e) => settle(rowId, e));
    chains.set(rowId, tail);
    tail.then(() => { if (chains.get(rowId) === tail) chains.delete(rowId); });
    return run;
  }

  // Änderungen beim Tippen sammeln und nach kurzer Pause (600 ms) in einem Rutsch speichern
  function schedule(tableId: string, rowId: string, data: Record<string, unknown>) {
    const entry = pending.get(rowId) || { tableId, data: {}, timer: null };
    Object.assign(entry.data, data);
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => { void flushRow(rowId); }, 600);
    pending.set(rowId, entry);
    onStatus("saving");
  }

  function flushRow(rowId: string): Promise<unknown> {
    const entry = pending.get(rowId);
    if (!entry) return Promise.resolve();
    if (entry.timer) clearTimeout(entry.timer);
    pending.delete(rowId);
    return enqueue(rowId, () => limited(() => rows.updateRow({ tableId: entry.tableId, rowId, data: entry.data }))).catch(() => {});
  }

  const dropPending = (rowId: string) => {
    const entry = pending.get(rowId);
    if (entry) { if (entry.timer) clearTimeout(entry.timer); pending.delete(rowId); }
  };

  const create = (tableId: string, rowId: string, data: Record<string, unknown>) =>
    enqueue(rowId, () => limited(() => rows.createRow({ tableId, rowId, data: { userId, ...data }, permissions }), { okOn409: true }));

  const remove = (tableId: string, rowId: string) => {
    dropPending(rowId);
    return enqueue(rowId, () => limited(() => rows.deleteRow({ tableId, rowId }), { okOn404: true }));
  };

  return {
    kind: "cloud",
    userId,
    newId: () => rows.newId(),
    isIdle: () => busy === 0 && pending.size === 0,

    async load() {
      const [subjects, grades] = await Promise.all([
        rows.listAllRows(tableIds.subjects, { userId }),
        rows.listAllRows(tableIds.grades, { userId }),
      ]);
      return {
        subjects: subjects.map((r) => ({ id: r.$id, name: r.name, schoolYear: r.schoolYear })),
        grades: grades.map((r) => ({ id: r.$id, subjectId: r.subjectId, label: r.label || "", value: r.value, system: r.system, weight: r.weight, half: r.half })),
      };
    },

    addSubject: (s) => create(tableIds.subjects, s.id, rowData(cleanSubject(s))),
    async updateSubject(id, changes) { schedule(tableIds.subjects, id, { ...changes }); },
    async removeSubject(id, gradeIds = []) {
      await Promise.allSettled(gradeIds.map((gid) => remove(tableIds.grades, gid)));
      return remove(tableIds.subjects, id);
    },
    addGrade: (g) => create(tableIds.grades, g.id, rowData(cleanGrade(g))),
    async updateGrade(id, changes) { schedule(tableIds.grades, id, { ...changes }); },
    removeGrade: (id) => remove(tableIds.grades, id),

    async flush() {
      await Promise.allSettled([...pending.keys()].map(flushRow));
      await Promise.allSettled([...chains.values()]);
    },

    forgetFailures(rowIds) { for (const id of rowIds) failedRows.delete(id); },

    async flushOrThrow() {
      // Gesammelte Änderungen sofort losschicken und warten, bis nichts mehr läuft (Operationen können weitere nach sich ziehen)
      for (let round = 0; round < 10 && (pending.size > 0 || chains.size > 0); round++) {
        await Promise.allSettled([...pending.keys()].map(flushRow));
        await Promise.allSettled([...chains.values()]);
      }
      if (failedRows.size > 0) throw failedRows.values().next().value;
      if (pending.size > 0 || chains.size > 0) throw new Error("Schreibvorgänge laufen noch.");
    },
  };
}

/** Gast-Daten ins Konto übernehmen (neue IDs, Zuordnung Fach → Noten bleibt erhalten). */
export async function importGuestData(cloud: CloudStore, data: NotenData): Promise<{ subjects: number; grades: number }> {
  const idMap = new Map<string, string>();
  for (const s of data.subjects) {
    const id = cloud.newId();
    idMap.set(s.id, id);
    await cloud.addSubject({ ...s, id });
  }
  const grades = data.grades.filter((g) => idMap.has(g.subjectId) && Number.isFinite(g.value) && Number.isFinite(g.weight));
  for (let i = 0; i < grades.length; i += 5) {
    await Promise.all(grades.slice(i, i + 5).map((g) => cloud.addGrade({ ...g, id: cloud.newId(), subjectId: idMap.get(g.subjectId) as string })));
  }
  return { subjects: idMap.size, grades: grades.length };
}
