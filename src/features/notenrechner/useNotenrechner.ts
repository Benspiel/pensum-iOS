/* Notenrechner – Zustand und Aktionen der Oberfläche (React-Hook). Die Logik steckt in model.ts, ui-model.ts, core.ts und store.ts.
 * Web-Quelle: tools/notenrechner/notenrechner.js (Pensum, Web-Commit 770dbe4): onAuthChange, applyData, setSubjectGrade, addSubjectNamed,
 * seedDefaults/ensureDefaults, offerImport/runImport, Visibility-Handler.
 * Unterschiede: Dialoge über Alert, Zustand in React statt DOM-Aktualisierung, Ansicht im Konto über useSession().updatePrefs. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { useSession } from "../../account/session";
import { useStoreDeps } from "../../storage";
import type { SaveStatus } from "../shared/ports";
import { formatInput, type Subject } from "./core";
import { checkNewSubjectName, gradeValue, missingSuggestions, planSeed, planSetGrade, visibleSubjects } from "./model";
import type { GradeRec, View } from "./model";
import { defaultView } from "./model";
import { isDeclined, isSeeded, loadView, markDeclined, markSeeded, saveView, seedKey } from "./prefs";
import { haptic } from "./haptics";
import { importGuestSafe } from "./import";
import { createCloudStore, createGuestStore } from "./store";
import type { CloudStore, GuestStore, NotenData } from "./store";
import {
  cleanSubjectName, importPending, importResultText, importPromptText, interpretGradeInput, markUnsaved, planRemoveSubject,
  prefsFromView, removeSubjectPrompt, shouldSeedDefaults, summarize, viewFromPrefs,
} from "./ui-model";
import { useToast } from "./components/Toast";

export interface ConfirmOptions { title: string; text: string; confirm: string; cancel?: string; destructive?: boolean }

/** Rückfrage als Alert; Ergebnis true bei Bestätigung. */
export function confirmAsync({ title, text, confirm, cancel = "Abbrechen", destructive = false }: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, text, [
      { text: cancel, style: "cancel", onPress: () => resolve(false) },
      { text: confirm, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

/** Gemeinsame Schnittstelle von Gast- und Konto-Speicher, soweit die Oberfläche sie braucht. */
interface Store {
  newId(): string;
  load(): Promise<NotenData>;
  addSubject(s: Subject): Promise<unknown>;
  updateSubject(id: string, changes: { name: string }): Promise<unknown>;
  removeSubject(id: string, gradeIds?: string[]): Promise<unknown>;
  addGrade(g: Omit<GradeRec, "saved">): Promise<unknown>;
  updateGrade(id: string, changes: Partial<Omit<GradeRec, "id" | "saved">>): Promise<unknown>;
  removeGrade(id: string): Promise<unknown>;
  flush(): Promise<void>;
  flushOrThrow(): Promise<void>;
  isIdle?: () => boolean;
}

interface Data { subjects: Subject[]; grades: GradeRec[] }
const EMPTY: Data = { subjects: [], grades: [] };
const noop = () => {};
const toData = (d: NotenData): Data => ({ subjects: d.subjects, grades: d.grades.map((g) => ({ ...g, saved: true })) });
const stripSaved = ({ saved: _saved, ...g }: GradeRec) => g;

export function useNotenrechner() {
  const { state, updatePrefs, refresh, registerBeforeLogout } = useSession();
  const userId = state.status === "account" ? state.user.id : null;
  const accountName = state.status === "account" ? (state.user.name || state.user.email || "Konto") : null;
  const prefs = state.status === "account" ? state.user.prefs : null;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const toastApi = useToast();
  const showRef = useRef(toastApi.show);
  showRef.current = toastApi.show;

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const lastStatus = useRef<SaveStatus>("saved");
  const onStatus = useCallback((status: SaveStatus, error?: unknown) => {
    const was = lastStatus.current;
    lastStatus.current = status;
    setSaveStatus(status);
    if (status === "error" && was !== "error") {
      console.error(error);
      showRef.current(userIdRef.current
        ? "Speichern fehlgeschlagen. Prüfe deine Verbindung, die Änderung ist noch nicht im Konto."
        : "Das Gerät verweigert das Speichern. Deine Änderung geht beim Schließen der App eventuell verloren.", true);
    }
  }, []);
  const deps = useStoreDeps(onStatus);

  const [data, setDataState] = useState<Data>(EMPTY);
  const dataRef = useRef<Data>(EMPTY);
  const update = useCallback((fn: (d: Data) => Data) => {
    const next = fn(dataRef.current);
    dataRef.current = next;
    setDataState(next);
  }, []);
  const [view, setViewState] = useState<View>(() => defaultView());
  const viewRef = useRef(view);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [version, setVersion] = useState(0);       // neue Felder-Schlüssel nach Laden/Import
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [guestLocal, setGuestLocal] = useState({ subjects: 0, grades: 0 });
  const [declined, setDeclined] = useState(false);

  const tokenRef = useRef(0);
  const storeRef = useRef<Store | null>(null);
  const cloudRef = useRef<CloudStore | null>(null);
  const guestRef = useRef<GuestStore | null>(null);
  const editingRef = useRef(false);
  const seededMemory = useRef(new Set<string>());

  const setView = useCallback((next: View) => { viewRef.current = next; setViewState(next); }, []);

  /* ---------- Laden (je Sitzung: Gast oder Konto) ---------- */

  const runImport = useCallback(async (local: NotenData, cloud: CloudStore, guest: GuestStore, token: number) => {
    try {
      // Gastdaten werden erst gelöscht, wenn alles im Konto bestätigt ist (flushOrThrow in importGuestSafe)
      const n = await importGuestSafe(cloud, local);
      await guest.clear();
      const fresh = await cloud.load();
      if (token !== tokenRef.current) return;
      update(() => toData(fresh));
      setVersion((v) => v + 1);
      setGuestLocal({ subjects: 0, grades: 0 });
      showRef.current(importResultText(n));
    } catch (e) {
      console.error(e);
      if (token !== tokenRef.current) return;
      showRef.current("Die Übernahme ist nicht vollständig durchgelaufen. Deine lokalen Daten bleiben erhalten. Versuch es noch einmal.", true);
      try { // Anzeige auf den tatsächlichen Stand im Konto bringen
        const fresh = await cloud.load();
        if (token === tokenRef.current) { update(() => toData(fresh)); setVersion((v) => v + 1); }
      } catch (_) { /* offline */ }
    }
  }, [update]);

  useEffect(() => {
    if (!deps) return undefined;
    const token = ++tokenRef.current;
    const guest = createGuestStore(deps);
    const cloud = userId ? createCloudStore(deps, { $id: userId }) : null;
    const store: Store = cloud ?? guest;
    guestRef.current = guest;
    cloudRef.current = cloud;
    storeRef.current = store;
    lastStatus.current = "saved";
    setSaveStatus("saved");
    setLoading(true);
    setLoadError(null);
    setErrors({});
    update(() => EMPTY);

    (async () => {
      try {
        const [loadedView, loaded, local, wasDeclined] = await Promise.all([
          (async () => (userId ? viewFromPrefs(prefsRef.current) : null) ?? (await loadView(deps.kv)))(),
          store.load(),
          userId ? guest.load() : Promise.resolve<NotenData | null>(null),
          userId ? isDeclined(deps.kv, userId) : Promise.resolve(false),
        ]);
        if (token !== tokenRef.current) return;
        setView(loadedView);
        update(() => toData(loaded));
        setVersion((v) => v + 1);
        setGuestLocal({ subjects: local?.subjects.length ?? 0, grades: local?.grades.length ?? 0 });
        setDeclined(wasDeclined);
        setLoading(false);
        // Beim ersten Login mit lokalen Daten: Übernahme anbieten (einmal je Konto und Gerät)
        if (cloud && local && importPending(userId, local.subjects.length, wasDeclined ? [userId as string] : [])) {
          const ok = await confirmAsync({
            title: "Lokale Daten übernehmen?",
            text: importPromptText(local.subjects.length, local.grades.length),
            confirm: "Ins Konto übernehmen",
            cancel: "Nicht übernehmen",
          });
          if (token !== tokenRef.current) return;
          if (!ok) { await markDeclined(deps.kv, userId as string); if (token === tokenRef.current) setDeclined(true); return; }
          await runImport(local, cloud, guest, token);
        }
      } catch (e) {
        if (token !== tokenRef.current) return;
        console.error(e);
        setLoadError("Deine Noten konnten nicht geladen werden. Prüfe deine Verbindung und versuche es noch einmal.");
        setLoading(false);
      }
    })();

    return () => {
      tokenRef.current++;
      void store.flush().catch(noop); // ausstehende Änderungen speichern (Sitzungswechsel, Verlassen des Bildschirms)
    };
  }, [deps, userId, reloadKey, update, setView, runImport]);

  /* ---------- Ableitungen ---------- */

  const subjects = useMemo(() => visibleSubjects(data.subjects, view), [data.subjects, view]);
  const summary = useMemo(() => summarize(data.subjects, data.grades, view), [data.subjects, data.grades, view]);
  const suggestions = useMemo(() => missingSuggestions(data.subjects, view), [data.subjects, view]);
  const subjectYears = useMemo(() => data.subjects.map((s) => s.schoolYear), [data.subjects]);
  const fieldValue = useCallback((subjectId: string) => {
    return formatInput(gradeValue(data.grades, subjectId, view));
  }, [data.grades, view]);

  /* ---------- Aktionen ---------- */

  const changeView = useCallback((patch: Partial<View>) => {
    const next = { ...viewRef.current, ...patch };
    setView(next);
    setErrors({});
    if (userIdRef.current) updatePrefs(prefsFromView(next)).catch(noop); // nächster Wechsel versucht es erneut
    else if (deps) void saveView(deps.kv, next);
  }, [deps, setView, updatePrefs]);

  const applyGrade = useCallback((subjectId: string, value: number | null) => {
    const store = storeRef.current;
    if (!store) return;
    const prev = dataRef.current;
    const plan = planSetGrade(prev.grades, subjectId, value, viewRef.current, store.newId);
    update((d) => ({ ...d, grades: plan.grades }));
    for (const e of plan.effects) {
      if (e.kind === "remove") { if (e.grade.saved) store.removeGrade(e.grade.id).catch(noop); }
      else if (e.kind === "update") { if (prev.grades.find((g) => g.id === e.id)?.saved) store.updateGrade(e.id, e.data).catch(noop); }
      else store.addGrade(stripSaved(e.grade)).catch(() => update((d) => ({ ...d, grades: markUnsaved(d.grades, e.grade.id) })));
    }
  }, [update]);

  const setGradeText = useCallback((subjectId: string, text: string) => {
    const r = interpretGradeInput(text, viewRef.current.system);
    if (r.kind === "error") { setErrors((e) => ({ ...e, [subjectId]: r.error })); return; }
    setErrors((e) => { if (!(subjectId in e)) return e; const { [subjectId]: _gone, ...rest } = e; return rest; });
    applyGrade(subjectId, r.kind === "set" ? r.value : null);
  }, [applyGrade]);

  const addSubjectNamed = useCallback((name: string): Subject | null => {
    const store = storeRef.current;
    if (!store) return null;
    const s: Subject = { id: store.newId(), name, schoolYear: viewRef.current.schoolYear };
    update((d) => ({ ...d, subjects: [...d.subjects, s] }));
    store.addSubject(s).catch(noop);
    return s;
  }, [update]);

  /** Neues Fach aus dem Formular; gibt den Fehlertext zurück oder null bei Erfolg. */
  const addSubject = useCallback((input: string): string | null => {
    if (loading) return "Die Noten werden noch geladen.";
    const check = checkNewSubjectName(input, dataRef.current.subjects, viewRef.current);
    if (!check.ok) return check.error;
    addSubjectNamed(check.name);
    haptic("light");
    return null;
  }, [loading, addSubjectNamed]);

  const addSuggestion = useCallback((name: string) => {
    if (loading) return;
    if (visibleSubjects(dataRef.current.subjects, viewRef.current).some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
    addSubjectNamed(name);
    haptic("light");
  }, [loading, addSubjectNamed]);

  const renameSubject = useCallback((id: string, text: string) => {
    const name = cleanSubjectName(text);
    const store = storeRef.current;
    if (!name || !store) return;
    update((d) => ({ ...d, subjects: d.subjects.map((s) => (s.id === id ? { ...s, name } : s)) }));
    store.updateSubject(id, { name }).catch(noop);
  }, [update]);

  const removeSubject = useCallback(async (id: string) => {
    const store = storeRef.current;
    const subject = dataRef.current.subjects.find((s) => s.id === id);
    if (!store || !subject) return;
    const first = planRemoveSubject(dataRef.current.subjects, dataRef.current.grades, id);
    if (first.gradeCount > 0) {
      const ok = await confirmAsync({ ...removeSubjectPrompt(subject.name, first.gradeCount), destructive: true });
      if (!ok) return;
    }
    const plan = planRemoveSubject(dataRef.current.subjects, dataRef.current.grades, id); // Stand nach der Rückfrage
    update(() => ({ subjects: plan.subjects, grades: plan.grades }));
    setErrors((e) => { const { [id]: _gone, ...rest } = e; return rest; });
    store.removeSubject(id, plan.savedGradeIds).catch(noop);
    haptic("warning");
  }, [update]);

  const seedDefaults = useCallback(() => {
    const store = storeRef.current;
    if (!store || !deps) return;
    const key = seedKey(userIdRef.current, viewRef.current.schoolYear);
    for (const s of planSeed(dataRef.current.subjects, viewRef.current, store.newId)) {
      update((d) => ({ ...d, subjects: [...d.subjects, s] }));
      store.addSubject(s).catch(noop);
    }
    seededMemory.current.add(key);
    void markSeeded(deps.kv, key);
  }, [deps, update]);

  const importLocal = useCallback(async () => {
    const cloud = cloudRef.current, guest = guestRef.current;
    if (!cloud || !guest) return;
    await runImport(await guest.load(), cloud, guest, tokenRef.current);
  }, [runImport]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Ein Schuljahr ohne Fächer bekommt einmal die Standardfächer (erst nach geklärter Übernahme)
  const visibleCount = subjects.length;
  useEffect(() => {
    if (!deps || loading || loadError) return;
    const key = seedKey(userId, view.schoolYear);
    if (visibleCount > 0 || seededMemory.current.has(key)) return;
    const pending = importPending(userId, guestLocal.subjects, declined && userId ? [userId] : []);
    let cancelled = false;
    void (async () => {
      const seeded = (await isSeeded(deps.kv, key)) ? [key] : [];
      if (cancelled || seededMemory.current.has(key) || seedKey(userIdRef.current, viewRef.current.schoolYear) !== key) return;
      if (shouldSeedDefaults({ loading, visibleCount, seeded, key, importPending: pending })) seedDefaults();
      else if (seeded.length) seededMemory.current.add(key);
    })();
    return () => { cancelled = true; };
  }, [deps, loading, loadError, userId, view.schoolYear, visibleCount, guestLocal.subjects, declined, seedDefaults]);

  // App im Hintergrund: Ausstehendes speichern. Zurück im Vordergrund: Stand vom Server holen, aber nie mitten im Tippen
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const store = storeRef.current;
      if (!store) return;
      if (next !== "active") { void store.flush().catch(noop); return; }
      if (!userIdRef.current || !store.isIdle?.() || editingRef.current) return;
      if (dataRef.current.grades.some((g) => !g.saved)) return;
      const token = tokenRef.current;
      void store.load().then((fresh) => {
        if (token !== tokenRef.current || !store.isIdle?.() || editingRef.current) return;
        update(() => toData(fresh));
        setVersion((v) => v + 1);
      }).catch(noop); // offline: beim nächsten Mal
    });
    return () => sub.remove();
  }, [update]);

  // Vor dem Abmelden alles Ausstehende sicher ins Konto schreiben; scheitert das, bricht A das Abmelden ab
  useEffect(() => registerBeforeLogout(async () => { await storeRef.current?.flushOrThrow(); }), [registerBeforeLogout]);

  const setEditing = useCallback((editing: boolean) => { editingRef.current = editing; }, []);

  return {
    status: state.status,
    sessionError: state.status === "error" ? state.error.message : null,
    retrySession: refresh,
    ready: deps !== null,
    accountName,
    loading, loadError, reload,
    view, changeView,
    subjects, subjectYears, suggestions, summary, errors, version,
    fieldValue,
    saveStatus,
    guestSubjects: userId ? guestLocal.subjects : 0,
    toast: toastApi.toast, hideToast: toastApi.hide,
    addSubject, addSuggestion, renameSubject, removeSubject, setGradeText, seedDefaults, importLocal, setEditing,
  };
}
