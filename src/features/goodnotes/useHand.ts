/* Goodnotes-Tool – eigene Handschrift: laden, speichern, löschen, Gast → Konto (Hook für screen.tsx).
 * Speicher: hand-store.ts. Die Engine bekommt die Handschrift per „set-hand“. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";

import { useSession } from "../../account/session";
import { tableIds } from "../../backend";
import { useStoreDeps } from "../../storage";
import {
  createCloudHandStore, createGuestHandStore, glyphCount, importGuestHand, importPrompt, markDeclined, shouldOfferHandImport,
  type HandStore, type PackedHand,
} from "./hand-store";
import type { HostMessage, HostRequest } from "./protocol";

type Req = HostRequest extends infer T ? (T extends { id: string } ? Omit<T, "id"> : never) : never;

const confirmAsync = (title: string, text: string, confirm: string, cancel: string, destructive = false) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(title, text, [
      { text: cancel, style: "cancel", onPress: () => resolve(false) },
      { text: confirm, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }));

export function useHand(call: (req: Req) => Promise<HostMessage>, engineReady: boolean, say: { notice: (t: string) => void; error: (t: string) => void }) {
  const { state } = useSession();
  const deps = useStoreDeps();
  const userId = state.status === "account" ? state.user.id : null;
  const [packed, setPacked] = useState<PackedHand | null>(null);
  const [padOpen, setPadOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const token = useRef(0);

  const store: HandStore | null = useMemo(() => {
    if (!deps) return null;
    return userId
      ? createCloudHandStore({ $id: userId }, { kv: deps.kv, rows: deps.rows, tableId: tableIds.handwriting })
      : createGuestHandStore({ kv: deps.kv });
  }, [deps, userId]);

  const apply = useCallback(async (p: PackedHand | null) => {
    setPacked(p);
    if (engineReady) await call({ type: "set-hand", packed: p });
  }, [call, engineReady]);

  // Beim Start und bei Konto-/Gastwechsel laden (veraltete Antworten verwerfen)
  useEffect(() => {
    if (!store) return;
    const mine = ++token.current;
    setLoaded(false);
    (async () => {
      try {
        const p = await store.load();
        if (mine !== token.current) return;
        await apply(p);
        setLoaded(true);
        // Erster Login mit lokaler Handschrift: Übernahme anbieten
        if (userId && deps) {
          const local = await shouldOfferHandImport(deps.kv, userId, p);
          if (!local || mine !== token.current) return;
          const ok = await confirmAsync(importPrompt.title, importPrompt.text, importPrompt.confirm, importPrompt.cancel);
          if (mine !== token.current) return;
          if (!ok) { await markDeclined(deps.kv, userId); return; }
          try { await importGuestHand(deps.kv, store, local); await apply(local); say.notice("Deine Handschrift ist jetzt im Konto gespeichert."); }
          catch (_) { say.error("Die Handschrift konnte nicht ins Konto übernommen werden."); }
        }
      } catch (_) {
        if (mine === token.current) { await apply(null).catch(() => {}); say.error("Deine Handschrift konnte nicht geladen werden."); }
      }
    })();
    return () => { token.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, engineReady]);

  const save = useCallback(async (p: unknown) => {
    if (!store) throw new Error("Speicher noch nicht bereit.");
    const hand = p as PackedHand;
    await store.save(hand);
    await apply(hand);
    say.notice(userId ? "Deine Handschrift ist im Konto gespeichert." : "Deine Handschrift ist auf diesem Gerät gespeichert.");
  }, [store, apply, userId, say]);

  const remove = useCallback(async () => {
    if (!store) return;
    const ok = await confirmAsync("Handschrift löschen?",
      `Deine gezeichnete Handschrift wird ${userId ? "aus deinem Konto" : "von diesem Gerät"} gelöscht. Das lässt sich nicht rückgängig machen.`,
      "Handschrift löschen", "Abbrechen", true);
    if (!ok) return;
    try { await store.remove(); await apply(null); setPadOpen(false); say.notice("Deine Handschrift wurde gelöscht."); }
    catch (_) { say.error("Löschen fehlgeschlagen. Versuch es noch einmal."); }
  }, [store, apply, userId, say]);

  return { packed, count: glyphCount(packed), cloud: !!userId, loaded, padOpen, setPadOpen, save, remove };
}
