/* Karteikarten – Zustand und Aktionen der Oberfläche (React-Hook). Die Logik steckt in session-model.ts, ops.ts, core.ts und store.ts.
 * Web-Quelle: tools/karteikarten/karteikarten.js (Pensum, Web-Commit 770dbe4): persist, onAuthChange, offerImport/runImport, Klick- und Submit-Handler.
 * Unterschiede: Datenobjekt wird wie im Web an Ort und Stelle verändert und danach gespeichert; Dialoge über Alert; Haptik über components/haptic.ts; vor dem Abmelden flushOrThrow (registerBeforeLogout). */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AccessibilityInfo, Alert, AppState } from "react-native";
import { useSession } from "../../account/session";
import { haptic } from "./components/haptic";
import { useStoreDeps } from "../../storage";
import type { DeckMode, StudyType } from "./core";
import { resolveDeckParam } from "./index";
import { addCard as addCardTo, checkCardText, checkDeckEdit, checkNewDeck, importIntoAccount, importPrompt, markDeclined, readDeclined, shouldOfferImport } from "./ops";
import {
  checkRound, currentCard, flipRound, gradeRound, initialView, loadingDelay, nextRound, overrideRound, restartDeck, startRound, viewReducer,
} from "./session-model";
import type { DeckTab, SaveStatus, View } from "./session-model";
import { createCloudStore, createGuestStore } from "./store";
import type { KarteikartenData, KarteikartenStore } from "./store";

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

export interface Notice { text: string; error: boolean; id: number }
export type ActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });
const OK: ActionResult = { ok: true };

export function useKarteikarten(deckParam?: string | string[]) {
  const { state, registerBeforeLogout } = useSession();
  const userId = state.status === "account" ? state.user.id : null;
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const statusRef = useRef<SaveStatus>("saved");
  const onStatus = useCallback((s: SaveStatus) => { statusRef.current = s; setSaveStatus(s); }, []);
  const deps = useStoreDeps(onStatus);

  const [view, dispatch] = useReducer(viewReducer, initialView);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const dataRef = useRef<KarteikartenData>({ decks: [] });
  const storeRef = useRef<KarteikartenStore | null>(null);
  const warnedRef = useRef(false);
  const paramRef = useRef<Record<string, string | string[] | undefined>>({});
  paramRef.current = { deck: deckParam };
  const appliedParam = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  const say = useCallback((text: string, error = false) => setNotice({ text, error, id: Date.now() + Math.random() }), []);
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice((n) => (n && n.id === notice.id ? null : n)), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  /* Speichern und Laden */

  const persist = useCallback(() => {
    const store = storeRef.current;
    if (!store) return;
    void store.save(dataRef.current).then((ok) => {
      if (ok === false && !warnedRef.current) {
        warnedRef.current = true;
        say("Das Gerät verweigert das Speichern. Deine Karten gehen beim Schließen verloren.", true);
      }
    });
  }, [say]);

  useEffect(() => {
    if (!deps) return undefined;
    let cancelled = false;
    const store: KarteikartenStore = userId ? createCloudStore({ $id: userId }, deps) : createGuestStore(deps);
    storeRef.current = null;
    setReady(false);
    setLoadError(null);
    setSaveStatus("saved");
    dispatch({ type: "boot" });
    (async () => {
      let loaded: KarteikartenData;
      try {
        loaded = await store.load();
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        dataRef.current = { decks: [] };
        setLoadError("Deine Karten konnten nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.");
        return; // storeRef bleibt leer: nichts Falsches ins Konto schreiben
      }
      if (cancelled) return;
      dataRef.current = loaded;
      storeRef.current = store;
      const wanted = resolveDeckParam(loaded, paramRef.current);
      appliedParam.current = typeof paramRef.current.deck === "string" ? paramRef.current.deck : null;
      dispatch({ type: "loaded", deckId: wanted });
      setReady(true);
      bump();
      if (!userId) return;
      // Gast-Daten ins Konto übernehmen?
      const guest = createGuestStore(deps);
      const local = await guest.peek();
      const declined = await readDeclined(deps.kv);
      if (cancelled || !shouldOfferImport(local, declined, userId)) return;
      const p = importPrompt(local);
      const ok = await confirmAsync({ title: p.title, text: p.text, confirm: p.confirm, cancel: p.cancel });
      if (cancelled) return;
      if (!ok) { await markDeclined(deps.kv, userId); return; }
      if (store.kind !== "cloud") return;
      const out = await importIntoAccount({
        local,
        getData: () => dataRef.current,
        setData: (d) => { dataRef.current = d; bump(); },
        store,
        guest,
      });
      if (cancelled) return;
      if (out.result.noRoom) say(out.result.message, true);
      else if (!out.saved) say("Die Karten konnten noch nicht im Konto gespeichert werden. Deine lokalen Karten bleiben erhalten, die Übernahme klappt beim nächsten Öffnen.", true);
      else say(out.result.message);
    })();
    return () => {
      cancelled = true;
      void store.flush().catch(() => undefined); // vor Kontowechsel, Abmelden und Verlassen des Screens
    };
  }, [deps, userId, reloadKey, persist, say]);

  // Link aus dem Planer, während der Screen schon offen ist
  const paramKey = typeof deckParam === "string" ? deckParam : Array.isArray(deckParam) ? (deckParam[0] ?? null) : null;
  useEffect(() => {
    if (!ready || paramKey === appliedParam.current) return;
    appliedParam.current = paramKey;
    const id = resolveDeckParam(dataRef.current, { deck: paramKey ?? undefined });
    if (id) dispatch({ type: "openDeck", id });
  }, [ready, paramKey]);

  // Vor dem Abmelden: alles Ausstehende sicher speichern (lehnt ab, wenn das nicht gelingt, dann bricht das Abmelden ab)
  useEffect(() => {
    if (!userId) return undefined;
    return registerBeforeLogout(async () => {
      const store = storeRef.current;
      if (store) await store.flushOrThrow();
    });
  }, [userId, registerBeforeLogout]);

  // Alles Ausstehende speichern, wenn die App in den Hintergrund geht
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") void storeRef.current?.flush().catch(() => undefined);
    });
    return () => sub.remove();
  }, []);

  // Ladeschritt vor der Runde
  useEffect(() => {
    if (view.name !== "loading") return undefined;
    const t = setTimeout(() => dispatch({ type: "roundReady" }), loadingDelay(reduceMotion));
    return () => clearTimeout(t);
  }, [view, reduceMotion]);

  /* Aktionen */

  const data = dataRef.current;
  const deckById = (id: string) => dataRef.current.decks.find((d) => d.id === id);
  const changed = () => { persist(); bump(); };

  const actions = {
    retryLoad: () => setReloadKey((k) => k + 1),
    openDeck: (id: string, tab?: DeckTab) => dispatch({ type: "openDeck", id, tab }),
    showList: () => dispatch({ type: "list" }),
    setTab: (tab: DeckTab) => dispatch({ type: "setTab", tab }),
    toDeck: () => dispatch({ type: "toDeck" }),

    createDeck(name: string, mode: DeckMode): ActionResult {
      const r = checkNewDeck(dataRef.current, { name, mode }, () => storeRef.current?.newId() ?? String(Date.now()));
      if (!r.ok) return fail(r.error);
      dataRef.current.decks.push(r.value);
      changed();
      dispatch({ type: "openDeck", id: r.value.id, tab: "add" });
      return OK;
    },
    editDeck(id: string, name: string, mode: DeckMode): ActionResult {
      const deck = deckById(id);
      const r = checkDeckEdit({ name, mode });
      if (!r.ok) return fail(r.error);
      if (!deck) return fail("Stapel nicht gefunden.");
      deck.name = r.value.name;
      deck.mode = r.value.mode;
      changed();
      return OK;
    },
    deleteDeck(id: string) {
      dataRef.current = { ...dataRef.current, decks: dataRef.current.decks.filter((d) => d.id !== id) };
      changed();
      dispatch({ type: "list" });
      say("Stapel gelöscht.");
    },
    addCard(deckId: string, front: string, back: string): ActionResult {
      const deck = deckById(deckId);
      const r = checkCardText({ front, back }, "add");
      if (!r.ok) return fail(r.error);
      if (!deck) return fail("Stapel nicht gefunden.");
      addCardTo(deck, r.value.front, r.value.back, () => storeRef.current?.newId() ?? String(Date.now()));
      changed();
      return OK;
    },
    editCard(deckId: string, cardId: string, front: string, back: string): ActionResult {
      const card = deckById(deckId)?.cards.find((c) => c.id === cardId);
      const r = checkCardText({ front, back }, "edit");
      if (!r.ok) return fail(r.error);
      if (!card) return fail("Karte nicht gefunden.");
      card.front = r.value.front;
      card.back = r.value.back;
      changed();
      return OK;
    },
    deleteCard(deckId: string, cardId: string) {
      const deck = deckById(deckId);
      if (!deck) return;
      deck.cards = deck.cards.filter((c) => c.id !== cardId);
      changed();
    },

    /** Lernrunde starten; `queueOverride` für „Falsche nochmal“. */
    async start(deckId: string, type: StudyType, queueOverride?: string[]) {
      const deck = deckById(deckId);
      if (!deck) return;
      let r = startRound(deck, type, { queueOverride });
      if (r.kind === "empty") { say(r.message); return; }
      if (r.kind === "needsReset") {
        const again = await confirmAsync({ title: "Alles gelernt.", text: "Alle Karten sind in Level 5. Soll der Stapel von vorn beginnen (alle Karten zurück auf Level 1)?", confirm: "Von vorn beginnen" });
        if (!again) return;
        restartDeck(deck);
        changed();
        r = startRound(deck, type);
        if (r.kind !== "ready") return;
      }
      haptic("start");
      dispatch({ type: "beginRound", round: r.round });
    },
    flip() {
      if (view.name !== "study" || view.round.flipped) return;
      haptic("flip");
      dispatch({ type: "updateRound", round: flipRound(view.round) });
    },
    check(given: string) {
      if (view.name !== "study") return;
      const deck = deckById(view.round.deckId);
      if (!deck) return;
      const round = checkRound(view.round, currentCard(deck, view.round), given);
      if (round.feedback) haptic(round.feedback.ok ? "right" : "wrong");
      dispatch({ type: "updateRound", round });
    },
    override() {
      if (view.name !== "study") return;
      haptic("right");
      dispatch({ type: "updateRound", round: overrideRound(view.round) });
    },
    grade(ok: boolean) {
      if (view.name !== "study") return;
      const deck = deckById(view.round.deckId);
      if (!deck) return;
      const round = gradeRound(deck, view.round, ok);
      if (round.queue.length === 0) haptic("done"); else haptic(ok ? "right" : "wrong");
      changed();
      dispatch({ type: "updateRound", round });
    },
    next() {
      if (view.name !== "study") return;
      const deck = deckById(view.round.deckId);
      if (!deck) return;
      const round = nextRound(deck, view.round);
      if (round.queue.length === 0) haptic("done");
      changed();
      dispatch({ type: "updateRound", round });
    },
    async quit() {
      const ok = await confirmAsync({ title: "Runde wirklich beenden?", text: "Dein Fortschritt (auch die Level) bleibt gespeichert, aber die Runde endet hier.", confirm: "Beenden", cancel: "Weiterlernen" });
      if (ok) dispatch({ type: "toDeck" });
    },
  };

  return { view: view as View, data, deckById, signedIn: userId !== null, saveStatus, reduceMotion, loadError, notice, dismissNotice: () => setNotice(null), actions };
}
