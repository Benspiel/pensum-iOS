/* Planer – Zustand, Laden, Speichern und Gast-Übernahme der Oberfläche (ein Hook, nicht unit-getestet: die Regeln stehen in
 * model.ts, core.ts und store.ts). Web-Quelle: tools/planer/planer.js (persist, onAuthChange, loadDecks, offerImport), Web-Commit 770dbe4.
 *
 * Ablauf: Pro Sitzung (Gast / Konto-ID) wird genau ein Speicher angelegt und geladen. Wechselt die Sitzung oder wird der Bildschirm
 * verlassen, wird der alte Speicher geleert (flush) und beendet (dispose); verspätete Antworten verwirft ein Token. Schlägt das Laden
 * fehl, sind alle Aktionen gesperrt, damit nichts Falsches ins Konto geschrieben wird. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { useSession } from "../../account/session";
import { useStoreDeps } from "../../storage";
import {
  createCloudStore as createDeckCloudStore,
  createGuestStore as createDeckGuestStore,
  listDeckSummaries,
} from "../karteikarten";
import type { SaveStatus, StoreDeps } from "../shared/ports";
import { todayISO, type ItemKind, type PlanItem } from "./core";
import { haptic } from "./haptics";
import { importGuestItems } from "./import";
import type { DeckSummary } from "./links";
import {
  TEXT, clearDone, dayChanged, freshGuestItems, importDoneMessage, importPrompt, msUntilNextDay, newItem, removeItem, toggleDone, updateItem,
  validateQuick, type FormFields,
} from "./model";
import { isDeclined, markDeclined } from "./prefs";
import { createCloudStore, createGuestStore, type CloudPlanStore, type GuestPlanStore } from "./store";
import type { ShowToast } from "./components/Toast";

export type LoadPhase = "loading" | "ready" | "error";
type Store = GuestPlanStore | CloudPlanStore;
const quiet = () => { /* egal */ };

/** Stapelliste für die Klausur-Verknüpfung: Gast aus dem Karteikarten-Gast-Speicher, Konto aus dem Karteikarten-Konto-Speicher. */
async function loadDecks(deps: StoreDeps, accountId: string | null): Promise<DeckSummary[]> {
  try {
    const quietDeps: StoreDeps = { ...deps, onStatus: undefined };
    const store = accountId ? createDeckCloudStore({ $id: accountId }, quietDeps) : createDeckGuestStore({ kv: deps.kv, rows: deps.rows });
    return await listDeckSummaries(store);
  } catch (_) {
    return []; // ohne Stapelliste gibt es nur keine Links
  }
}

function askImport(count: number): Promise<boolean> {
  const p = importPrompt(count);
  return new Promise((resolve) => {
    Alert.alert(p.title, p.message, [
      { text: p.cancel, style: "cancel", onPress: () => resolve(false) },
      { text: p.confirm, onPress: () => resolve(true) },
    ], { cancelable: false });
  });
}

export function usePlanerController(toast: ShowToast) {
  const { state: session, refresh, registerBeforeLogout } = useSession();
  const accountId = session.status === "account" ? session.user.id : null;
  const deps = useStoreDeps();

  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [items, setItemsState] = useState<PlanItem[]>([]);
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [today, setToday] = useState(() => todayISO());
  const [reloadTick, setReloadTick] = useState(0);

  const itemsRef = useRef<PlanItem[]>([]);
  const storeRef = useRef<Store | null>(null);
  const phaseRef = useRef<LoadPhase>("loading");
  const tokenRef = useRef(0);
  const warnedDevice = useRef(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;
  phaseRef.current = phase;

  const setItems = useCallback((next: PlanItem[]) => { itemsRef.current = next; setItemsState(next); }, []);

  /** Neuen Stand merken und speichern (wie persist() im Web). */
  const commit = useCallback((next: PlanItem[]) => {
    setItems(next);
    const store = storeRef.current;
    if (!store) return;
    store.save({ items: next }).then((ok) => {
      if (ok === false && !warnedDevice.current) {
        warnedDevice.current = true;
        toastRef.current(TEXT.deviceRefusedToast, { error: true });
      }
    }).catch(quiet);
  }, [setItems]);

  /* ---------- Speicher je Sitzung ---------- */

  useEffect(() => {
    if (!deps) return;
    const token = ++tokenRef.current;
    const current = () => tokenRef.current === token;
    let lastStatus: SaveStatus = "saved";

    const guest = createGuestStore({ kv: deps.kv }); // im Gast-Modus der Speicher selbst, im Konto nur zum Lesen der lokalen Einträge
    const onStatus = (status: SaveStatus, error?: unknown) => {
      if (!current()) return;
      setSaveStatus(status);
      if (status === "error" && lastStatus !== "error") {
        console.error(error);
        toastRef.current(TEXT.saveFailedToast, { error: true });
      }
      lastStatus = status;
    };
    const store: Store = accountId ? createCloudStore({ ...deps, onStatus }, { $id: accountId }) : guest;
    storeRef.current = store;
    warnedDevice.current = false;
    setPhase("loading"); setSaveStatus("saved"); setItems([]); setDecks([]);

    async function offerImport(id: string, cloud: CloudPlanStore) {
      const local = (await guest.load()).items;
      if (!local.length || !current()) return;
      const fresh = freshGuestItems(itemsRef.current, local);
      if (!fresh.length) { await guest.clear(); return; } // alles liegt schon im Konto (z. B. nach einer unterbrochenen Übernahme)
      if (await isDeclined(deps!.kv, id) || !current()) return;
      const ok = await askImport(fresh.length);
      if (!current()) return;
      if (!ok) { await markDeclined(deps!.kv, id); return; }
      const result = await importGuestItems({ cloud, guest, current: itemsRef.current, local, commit });
      if (!current()) return;
      if (result.status === "done") toastRef.current(importDoneMessage(result.taken));
      else if (result.status === "no-room") toastRef.current(TEXT.maxDialog, { error: true });
      // "failed": onStatus hat den Fehler gemeldet; die Gast-Einträge bleiben lokal und werden beim nächsten Mal nicht doppelt übernommen
    }

    void (async () => {
      try {
        const loaded = await store.load();
        if (!current()) return;
        setItems(loaded.items);
        setToday(todayISO());
        setPhase("ready");
        void loadDecks(deps, accountId).then((list) => { if (current()) setDecks(list); });
        if (store.kind === "cloud" && accountId) await offerImport(accountId, store);
      } catch (error) {
        if (!current()) return;
        console.error(error);
        setPhase("error"); // nichts Falsches ins Konto schreiben: Aktionen bleiben gesperrt
      }
    })();

    return () => {
      tokenRef.current++;
      if (storeRef.current === store) storeRef.current = null;
      void store.flush().catch(quiet);
      if (store.kind === "cloud") store.dispose();
    };
  }, [deps, accountId, reloadTick, commit, setItems]);

  /* ---------- Vor dem Abmelden: alles sicher ins Konto (lehnt ab, wenn etwas nicht gespeichert werden konnte) ---------- */

  useEffect(() => registerBeforeLogout(async () => { await storeRef.current?.flushOrThrow(); }), [registerBeforeLogout]);

  /* ---------- App-Zustand: speichern im Hintergrund, neuer Tag ---------- */

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setToday((old) => { const t = todayISO(); return dayChanged(old, t) ? t : old; });
      else void storeRef.current?.flush().catch(quiet);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => { // Mitternacht bei geöffneter App
    const id = setTimeout(() => setToday((old) => { const t = todayISO(); return dayChanged(old, t) ? t : old; }), msUntilNextDay(new Date()));
    return () => clearTimeout(id);
  }, [today]);

  /* ---------- Aktionen (nur wenn geladen) ---------- */

  const ready = () => phaseRef.current === "ready" && storeRef.current !== null;

  /** Schnellerfassung. true = hinzugefügt (Feld leeren). */
  const addQuick = useCallback((title: string): boolean => {
    if (!ready()) return false;
    const r = validateQuick(title, itemsRef.current.length);
    if (!r.ok) {
      if (r.reason === "full") toastRef.current(r.message, { error: true });
      return false;
    }
    commit([...itemsRef.current, newItem((storeRef.current as Store).newId(), "task", { title: r.title })]);
    haptic("light");
    return true;
  }, [commit]);

  const saveItem = useCallback((kind: ItemKind, id: string | null, fields: FormFields) => {
    if (!ready()) return;
    if (id) { commit(updateItem(itemsRef.current, id, fields)); return; }
    commit([...itemsRef.current, newItem((storeRef.current as Store).newId(), kind, fields)]);
    toastRef.current(kind === "exam" ? TEXT.examCreated : TEXT.taskCreated);
  }, [commit]);

  const toggle = useCallback((id: string) => {
    if (!ready()) return;
    const was = itemsRef.current.find((i) => i.id === id)?.done;
    haptic(was ? "light" : "success");
    commit(toggleDone(itemsRef.current, id));
  }, [commit]);

  const remove = useCallback((id: string) => {
    if (!ready()) return;
    commit(removeItem(itemsRef.current, id));
    toastRef.current(TEXT.deleted);
  }, [commit]);

  const clearDoneTasks = useCallback(() => { if (ready()) commit(clearDone(itemsRef.current)); }, [commit]);
  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  return {
    session, refreshSession: refresh, account: accountId !== null,
    phase, items, decks, today, saveStatus,
    addQuick, saveItem, toggle, remove, clearDoneTasks, reload,
  };
}
