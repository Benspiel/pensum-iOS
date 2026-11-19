/* Zeichenfeld für die eigene Handschrift als Vollbild-Blatt. Das Feld selbst ist eine lokale WebView (engine/pad-bridge.js),
 * Bedienung und Texte sind nativ. Vorlage Web: tools/goodnotes/index.html (Handschrift-Dialog) + goodnotes.js (Web-Commit 770dbe4). */
import { useCallback, useEffect, useRef, useState } from "react";
import { SymbolView } from "expo-symbols";
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { radius, spacing, usePensumTheme } from "../../theme";
import { AppText, Button } from "../../ui";
import { HAND_PAD_MAX_WIDTH, handPadHeight, isTabletWindow } from "./layout";
import { FormMessage } from "./parts";
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
  const { width, height, fontScale } = useWindowDimensions();
  const tablet = isTabletWindow(width, height, fontScale);
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

  const content = (
    <>
      <View style={styles.head}>
        <AppText variant="h3" accessibilityRole="header" style={styles.title}>Deine Handschrift.</AppText>
        <View style={styles.close}>
          <Pressable accessibilityRole="button" accessibilityLabel="Schließen" onPress={onClose} style={({ pressed }) => [styles.closeButton, { backgroundColor: pressed ? colors.surface : "transparent" }]}>
            <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} tintColor={colors.muted} size={20} />
          </Pressable>
        </View>
      </View>
      <AppText variant="bodySm" tone="muted">
        Schreib jedes Zeichen einmal in das Feld. {cloud ? "Wird in deinem Konto gespeichert und ist auf allen Geräten verfügbar." : "Wird nur auf diesem Gerät gespeichert. Mit Konto ist sie überall verfügbar."}
      </AppText>

      <View style={styles.charRow}>
        <AppText variant="h2" accessibilityLabel={state ? `Zeichen ${state.char}` : undefined} style={styles.char}>{state?.char ?? "…"}</AppText>
        <AppText variant="caption" tone="muted" accessibilityLiveRegion="polite">{state ? padProgressLabel(state) : "Zeichenfeld startet …"}</AppText>
      </View>

      <View style={[styles.pad, { borderColor: colors.border, height: handPadHeight(height, tablet) }]} accessibilityLabel="Zeichenfeld" accessible={false}>
        <WebView<unknown> key={instance} ref={web} originWhitelist={["about:*", "data:*"]} source={{ html: GOODNOTES_PAD_HTML, baseUrl: "about:blank" }}
          onMessage={onMessage} javaScriptEnabled domStorageEnabled={false} allowFileAccess={false} scrollEnabled={false}
          bounces={false} overScrollMode="never" style={styles.web}
          onContentProcessDidTerminate={handleTerminated} onRenderProcessGone={handleTerminated} />
      </View>

      {info ? (info.startsWith("Wird") ? <AppText variant="caption" tone="muted" accessibilityLiveRegion="polite">{info}</AppText> : <FormMessage text={info} />) : null}

      <View style={styles.controls}>
        <Button title="Zurück" variant="secondary" size="sm" style={styles.controlOutline} onPress={() => send({ type: "prev" })} disabled={!ready || !state || state.idx === 0 || busy} />
        <Button title="Rückgängig" variant="plain" size="sm" style={styles.controlPlain} onPress={() => send({ type: "undo" })} disabled={!ready || busy} />
        <Button title="Leeren" accessibilityLabel="Zeichen leeren" variant="plain" size="sm" style={styles.controlPlain} onPress={() => send({ type: "clear" })} disabled={!ready || busy} />
        <Button title={state ? padNextLabel(state.idx, state.total, state.current) : "Weiter"} variant="secondary" size="sm" style={styles.controlOutline} onPress={next} disabled={!ready || !state || busy} />
      </View>

      {state ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} accessibilityLabel="Zeichenliste" style={styles.stripScroll}>
          {state.done.map((done, i) => {
            const current = i === state.idx;
            return (
              <Pressable key={i} onPress={() => send({ type: "goto", idx: i })} accessibilityRole="button"
                accessibilityLabel={`Zeichen ${i + 1}${done ? ", gezeichnet" : ""}${current ? ", aktuell" : ""}`}
                style={[styles.dot, { borderColor: current ? colors.ink : done ? colors.surface : colors.border, backgroundColor: current ? colors.ink : done ? colors.surface : colors.canvas }]}>
                <AppText variant="body" style={[styles.dotText, { color: current ? colors.onPrimary : done ? colors.ink : colors.muted }]}>{i + 1}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.actions}>
        <Button title="Speichern" onPress={save} loading={busy} disabled={!ready || !state || state.doneCount === 0} />
        {onDelete ? <Button title="Handschrift löschen" variant="plain" accessibilityHint="Destruktive Aktion" onPress={onDelete} disabled={busy || !packed} /> : null}
      </View>
    </>
  );

  // iPad: zentriertes Blatt mit begrenzter Breite über abgedunkeltem Screen; das Zeichenfeld darf dort deutlich größer sein
  if (tablet) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.scrim}>
          <SafeAreaView style={styles.centerWrap} edges={["top", "left", "right", "bottom"]}>
            <View style={[styles.centerSheet, { backgroundColor: colors.canvas, borderColor: colors.border, maxWidth: HAND_PAD_MAX_WIDTH }]} accessibilityViewIsModal>
              {content}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    );
  }
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: colors.canvas }]}>
        {content}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, padding: spacing.xl, gap: spacing.lg },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  centerSheet: { width: "100%", maxHeight: "100%", padding: spacing.xl, gap: spacing.lg, borderRadius: radius.card, borderCurve: "continuous", borderWidth: 1 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.lg },
  title: { flex: 1 },
  close: { marginTop: -spacing.sm, marginRight: -spacing.sm },
  closeButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  charRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.lg },
  char: { fontSize: 44, lineHeight: 44, minWidth: 40 },
  pad: { height: 220, borderWidth: 1, borderRadius: radius.field, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#fff" },
  web: { flex: 1, backgroundColor: "transparent" },
  controls: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.xs },
  controlOutline: { paddingHorizontal: spacing.md },
  controlPlain: { paddingHorizontal: spacing.sm },
  stripScroll: { flexGrow: 0 },
  strip: { gap: spacing.xs, paddingBottom: spacing.sm },
  dot: { width: 44, height: 44, borderWidth: 1, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  dotText: { fontWeight: "600" },
  actions: { gap: spacing.sm },
});
