/* Zeichenfeld für die eigene Handschrift als Vollbild-Blatt. Das Feld selbst ist eine lokale WebView (engine/pad-bridge.js),
 * Bedienung und Texte sind nativ. Vorlage Web: tools/goodnotes/index.html (Handschrift-Dialog) + goodnotes.js (Web-Commit 770dbe4). */
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { radius, spacing, usePensumTheme } from "../../theme";
import { AppText, Button } from "../../ui";
import { GOODNOTES_PAD_HTML } from "./host-html.generated";
import { padNextLabel, padProgressLabel, parsePadMessage, type PadRequest, type PadState } from "./protocol";
import { HostRequestError } from "./request-queue";
import { useWebViewChannel } from "./useWebViewChannel";

const PAD_RESTARTED = "Das Zeichenfeld wurde neu gestartet. Nicht gespeicherte Striche sind verloren.";

type Props = {
  visible: boolean;
  packed: unknown | null;
  ink: string;
  cloud: boolean;
  /** Gepackte Handschrift speichern; wirft bei Fehler (Meldung wird angezeigt). */
  onSave: (packed: unknown) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
};

export function HandPad({ visible, packed, ink, cloud, onSave, onDelete, onClose }: Props) {
  const { colors } = usePensumTheme();
  const [state, setState] = useState<PadState | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const onDown = useCallback(() => { setState(null); setInfo(PAD_RESTARTED); setBusy(false); }, []);
  const onGiveUp = useCallback(() => setInfo("Das Zeichenfeld ist mehrfach abgestürzt. Schließ das Blatt und öffne es neu."), []);
  const { web, ready, setReady, instance, getQueue, request, handleTerminated } = useWebViewChannel({ idPrefix: "pad", onDown, onGiveUp });

  const send = useCallback((m: PadRequest) => getQueue().notify(m), [getQueue]);

  useEffect(() => { if (visible && ready) send({ type: "init", packed, ink }); }, [visible, ready, packed, ink, send]);
  // Beim Schließen verschwindet die WebView (Modal): „bereit“ zurücksetzen, sonst geht das init beim nächsten Öffnen ins Leere
  useEffect(() => {
    if (visible) return;
    setInfo(null); setBusy(false); setReady(false); setState(null);
    getQueue().abortAll(new HostRequestError("Das Zeichenfeld wurde geschlossen.", "aborted"));
  }, [visible, setReady, getQueue]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    const m = parsePadMessage(e.nativeEvent.data);
    if (!m) return;
    if (m.type === "pad-ready") setReady(true);
    else if (m.type === "pad-state") setState(m);
    else if (m.type === "packed") getQueue().resolve(m.id, m.packed);
    else if (m.type === "pad-error") { if (m.id) getQueue().reject(m.id, new Error(m.message)); else setInfo(m.message); }
  }, [getQueue, setReady]);

  // Zeitlimit (20 s) und Abbruch bei Absturz/Schließen über die Queue
  const pack = () => request({ type: "pack" });

  async function save() {
    setBusy(true); setInfo("Wird gespeichert …");
    try { await onSave(await pack()); onClose(); }
    catch (e) { setInfo(e instanceof HostRequestError || (e instanceof Error && e.message.startsWith("Zeichne")) ? (e as Error).message : "Speichern fehlgeschlagen. Prüfe deine Verbindung und versuch es noch einmal."); }
    finally { setBusy(false); }
  }

  async function next() { if (state && state.idx === state.total - 1) await save(); else send({ type: "next" }); }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: colors.canvas }]}>
        <View style={styles.head}>
          <AppText variant="section" accessibilityRole="header" style={{ flex: 1 }}>Deine Handschrift.</AppText>
          <Button title="Schließen" variant="plain" onPress={onClose} />
        </View>
        <AppText variant="caption" tone="muted">
          Schreib jedes Zeichen einmal in das Feld. {cloud ? "Wird in deinem Konto gespeichert und ist auf allen Geräten verfügbar." : "Wird nur auf diesem Gerät gespeichert. Mit Konto ist sie überall verfügbar."}
        </AppText>

        <View style={styles.charRow}>
          <AppText variant="display" accessibilityLabel={state ? `Zeichen ${state.char}` : undefined}>{state?.char ?? "…"}</AppText>
          <AppText tone="muted" accessibilityLiveRegion="polite">{state ? padProgressLabel(state) : "Zeichenfeld startet …"}</AppText>
        </View>

        <View style={[styles.pad, { borderColor: colors.border }]} accessibilityLabel="Zeichenfeld" accessible={false}>
          <WebView<unknown> key={instance} ref={web} originWhitelist={["about:*", "data:*"]} source={{ html: GOODNOTES_PAD_HTML, baseUrl: "about:blank" }}
            onMessage={onMessage} javaScriptEnabled domStorageEnabled={false} allowFileAccess={false} scrollEnabled={false}
            bounces={false} overScrollMode="never" style={styles.web}
            onContentProcessDidTerminate={handleTerminated} onRenderProcessGone={handleTerminated} />
        </View>

        {info ? <AppText tone={info.startsWith("Wird") ? "muted" : "danger"} accessibilityLiveRegion="polite">{info}</AppText> : null}

        <View style={styles.row}>
          <Button title="Zurück" variant="secondary" onPress={() => send({ type: "prev" })} disabled={!ready || !state || state.idx === 0 || busy} />
          <Button title="Rückgängig" variant="secondary" onPress={() => send({ type: "undo" })} disabled={!ready || busy} />
          <Button title="Zeichen leeren" variant="secondary" onPress={() => send({ type: "clear" })} disabled={!ready || busy} />
        </View>
        <View style={styles.row}>
          <Button title={state ? padNextLabel(state.idx, state.total, state.current) : "Weiter"} onPress={next} disabled={!ready || !state || busy} />
          <Button title="Speichern" variant="secondary" onPress={save} loading={busy} disabled={!ready || !state || state.doneCount === 0} />
          {onDelete ? <Button title="Handschrift löschen" variant="danger" onPress={onDelete} disabled={busy || !packed} /> : null}
        </View>

        {state ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} accessibilityLabel="Zeichenliste">
            {state.done.map((done, i) => (
              <Pressable key={i} onPress={() => send({ type: "goto", idx: i })} accessibilityRole="button"
                accessibilityLabel={`Zeichen ${i + 1}${done ? ", gezeichnet" : ""}${i === state.idx ? ", aktuell" : ""}`}
                style={[styles.dot, { borderColor: i === state.idx ? colors.ink : colors.border, backgroundColor: done ? colors.surface : "transparent" }]}>
                <AppText variant="caption">{i + 1}</AppText>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, padding: spacing.lg, gap: spacing.md },
  head: { flexDirection: "row", alignItems: "center" },
  charRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pad: { height: 220, borderWidth: 1, borderRadius: radius.field, overflow: "hidden", backgroundColor: "#fff" },
  web: { flex: 1, backgroundColor: "transparent" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  strip: { gap: spacing.xs },
  dot: { minWidth: 36, minHeight: 36, borderWidth: 1, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xs },
});
