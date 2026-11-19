/* Mindmap – Hook für den .goodnotes-Export: startet bei Bedarf die lokale Engine-WebView des Goodnotes-Tools (unsichtbar, offline),
 * spielt die Mindmap-Brücke ein (goodnotes-bridge.ts) und gibt die fertige Datei als Base64 zurück. Die WebView lebt nur während des Exports. */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { GOODNOTES_HOST_HTML } from '../goodnotes/host-html.generated';
import { createRequestQueue, type RequestQueue } from '../goodnotes/request-queue';
import { MINDMAP_BRIDGE_JS, parseMindmapMessage, type MindmapGoodnotesRequest } from './goodnotes-bridge';

const START_TIMEOUT_MS = 30_000;
const EXPORT_TIMEOUT_MS = 60_000;
const RESTART_MESSAGE = 'Die Engine wurde beendet. Versuch es noch einmal.';

export type ExportPayload = Omit<MindmapGoodnotesRequest, 'type' | 'id'>;

export function useGoodnotesExporter(): { element: ReactNode; run(payload: ExportPayload): Promise<string> } {
  const web = useRef<WebView<unknown>>(null);
  const [active, setActive] = useState(false);
  const [instance, setInstance] = useState(0);
  const ready = useRef(false);
  const waiters = useRef<{ resolve(): void; reject(e: Error): void }[]>([]);
  const queueRef = useRef<RequestQueue | null>(null);
  const counter = useRef(0);

  const queue = useCallback((): RequestQueue => (queueRef.current ??= createRequestQueue({
    send: (json) => { const w = web.current; if (!w) throw new Error('Die Engine ist nicht bereit.'); w.postMessage(json); },
    newId: () => `mm${++counter.current}`,
    timeoutMs: () => EXPORT_TIMEOUT_MS,
  })), []);

  useEffect(() => () => {
    queueRef.current?.dispose();
    queueRef.current = null;
    for (const w of waiters.current.splice(0)) w.reject(new Error('Abgebrochen.'));
  }, []);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    const m = parseMindmapMessage(event.nativeEvent.data);
    if (!m) return;
    if (m.type === 'mm-ready') { ready.current = true; for (const w of waiters.current.splice(0)) w.resolve(); return; }
    if (m.type === 'mm-exported') queue().resolve(m.id, m.file);
    else queue().reject(m.id, new Error(m.message));
  }, [queue]);

  const failAll = useCallback((message: string) => {
    ready.current = false;
    for (const w of waiters.current.splice(0)) w.reject(new Error(message));
    queueRef.current?.abortAll(new Error(message));
  }, []);

  const waitReady = useCallback(() => new Promise<void>((resolve, reject) => {
    if (ready.current) { resolve(); return; }
    const timer = setTimeout(() => reject(new Error('Die Engine konnte nicht gestartet werden.')), START_TIMEOUT_MS);
    waiters.current.push({ resolve: () => { clearTimeout(timer); resolve(); }, reject: (e) => { clearTimeout(timer); reject(e); } });
  }), []);

  const run = useCallback(async (payload: ExportPayload): Promise<string> => {
    ready.current = false;
    setInstance((n) => n + 1);
    setActive(true);
    try {
      await waitReady();
      const file = await queue().request({ type: 'mm-goodnotes', ...payload });
      if (typeof file !== 'string') throw new Error('Unerwartete Antwort der Engine.');
      return file;
    } finally {
      ready.current = false;
      setActive(false);
    }
  }, [queue, waitReady]);

  const element = useMemo(() => active ? (
    <View style={styles.hidden} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <WebView<unknown>
        key={instance}
        ref={web}
        originWhitelist={['about:*', 'data:*']}
        source={{ html: GOODNOTES_HOST_HTML, baseUrl: 'about:blank' }}
        injectedJavaScript={MINDMAP_BRIDGE_JS}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        setSupportMultipleWindows={false}
        onContentProcessDidTerminate={() => failAll(RESTART_MESSAGE)}
        onRenderProcessGone={() => failAll(RESTART_MESSAGE)}
        onError={() => failAll('Die Engine konnte nicht gestartet werden.')}
      />
    </View>
  ) : null, [active, failAll, instance, onMessage]);

  return { element, run };
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' },
});
