/* Goodnotes-Tool – gemeinsamer Hook für beide WebViews (Engine und Zeichenfeld):
 * Anfragen mit Zeitlimit, Neustart nach Absturz (onContentProcessDidTerminate / onRenderProcessGone), Aufräumen beim Unmount. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WebView } from "react-native-webview";

import { createIdGenerator } from "./protocol";
import { createHostSupervisor, createRequestQueue, createRestartPolicy, ENGINE_TIMEOUT_MESSAGE, type RequestQueue } from "./request-queue";

export function useWebViewChannel(o: { idPrefix: string; onDown?: () => void; onGiveUp?: () => void }) {
  const web = useRef<WebView<unknown>>(null);
  const [ready, setReady] = useState(false);
  /** Als key der WebView: neuer Wert = frisch geladene WebView (nach Absturz). */
  const [instance, setInstance] = useState(0);
  const queueRef = useRef<RequestQueue | null>(null);
  const nextId = useRef(createIdGenerator(o.idPrefix));
  const cb = useRef(o);
  cb.current = o;

  // Lazy, damit der Strict-Mode-Neuaufbau (Cleanup, dann erneuter Effekt) keine „geschlossene“ Queue zurücklässt.
  const getQueue = useCallback((): RequestQueue => (queueRef.current ??= createRequestQueue({
    send: (json) => { const w = web.current; if (!w) throw new Error(ENGINE_TIMEOUT_MESSAGE); w.postMessage(json); },
    newId: () => nextId.current(),
  })), []);

  const supervisor = useMemo(() => createHostSupervisor({
    queue: getQueue,
    policy: createRestartPolicy(),
    restart: () => setInstance((i) => i + 1),
    onDown: () => { setReady(false); cb.current.onDown?.(); },
    onGiveUp: () => cb.current.onGiveUp?.(),
  }), [getQueue]);

  useEffect(() => () => { queueRef.current?.dispose(); queueRef.current = null; }, []);

  const request = useCallback((req: { type: string } & Record<string, unknown>) => getQueue().request(req), [getQueue]);
  const handleTerminated = useCallback(() => { supervisor.handleTerminated(); }, [supervisor]);

  return { web, ready, setReady, instance, getQueue, request, handleTerminated };
}
