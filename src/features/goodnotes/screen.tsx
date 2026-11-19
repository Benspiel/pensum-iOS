/* Goodnotes-Tool – nativer Screen. Die Tinten-Engine läuft unverändert und offline in einer WebView (engine/, host-html.generated.ts);
 * Eingabe, Auswahl, Speichern und Teilen sind nativ. Vorlage Web: tools/goodnotes/index.html + goodnotes.js (Commit 770dbe4). */
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { radius, spacing, usePensumTheme } from "../../theme";
import { AppText, Button, Card, ErrorState, Field, Screen } from "../../ui";
import { takeHandoff } from "../shared/handoff";
import { HandPad } from "./HandPad";
import { handInfo } from "./hand-store";
import { GOODNOTES_HOST_HTML } from "./host-html.generated";
import { useHand } from "./useHand";
import {
  DEFAULT_SETTINGS, FONTS, HAND_FONT, HAND_VARY, handVaryLabel, INKS, PAPERS, base64ToBytes, bytesToBase64, createIdGenerator, exportFileNames, exportHint,
  pageCountLabel, parseHostMessage, rangeLabel, stepValue, type RangeId, type HostMessage, type HostRequest, type InkSettings,
} from "./protocol";

const SAMPLE = "# Lernzettel Biologie\n\nDie Zelle ist die kleinste Einheit des Lebens.\n- Zellkern: enthält die DNA\n- Mitochondrien: Kraftwerke der Zelle\n- Ribosomen: bauen Proteine";
const nextId = createIdGenerator("gn");

type Req = HostRequest extends infer T ? (T extends { id: string } ? Omit<T, "id"> : never) : never;
type Pending = { resolve: (m: HostMessage) => void; reject: (e: Error) => void };

export default function GoodnotesScreen() {
  const { colors } = usePensumTheme();
  const web = useRef<WebView<unknown>>(null);
  const pending = useRef(new Map<string, Pending>());
  const [ready, setReady] = useState(false);
  const [text, setText] = useState(SAMPLE);
  const [fileName, setFileName] = useState("Lernzettel");
  const [settings, setSettings] = useState<InkSettings>(DEFAULT_SETTINGS);
  const [pages, setPages] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<string | null>(null);

  // Übergabe aus „Abschreiben“ (einmal lesen, danach leer)
  useEffect(() => {
    const h = takeHandoff();
    if (h) { setText(h.text); setFileName(h.name); setNotice("Text aus „Abschreiben“ übernommen."); }
  }, []);

  const call = useCallback((req: Req): Promise<HostMessage> => {
    const id = nextId();
    return new Promise((resolve, reject) => {
      pending.current.set(id, { resolve, reject });
      web.current?.postMessage(JSON.stringify({ ...req, id }));
    });
  }, []);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    const m = parseHostMessage(e.nativeEvent.data);
    if (!m) return;
    if (m.type === "ready") { setReady(true); return; }
    const p = pending.current.get(m.id);
    if (!p) return;
    pending.current.delete(m.id);
    if (m.type === "error") p.reject(new Error(m.message)); else p.resolve(m);
  }, []);

  const say = useMemo(() => ({ notice: (t: string) => { setNotice(t); setError(null); }, error: (t: string) => setError(t) }), []);
  const hand = useHand(call, ready, say);
  // Ohne Handschrift darf sie nicht ausgewählt bleiben (Web: selectFont("Caveat"))
  useEffect(() => { if (hand.loaded && !hand.count && settings.font === HAND_FONT) setSettings((s) => ({ ...s, font: "Caveat", handVary: 0 })); }, [hand.loaded, hand.count, settings.font]);

  // Vorschau neu rendern (mit kurzer Verzögerung wie im Web)
  useEffect(() => {
    if (!ready) return;
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const r = await call({ type: "render", text, settings });
        if (!stale && r.type === "rendered") { setPages(r.pages); setError(null); }
      } catch (e) { if (!stale) setError(e instanceof Error ? e.message : "Die Vorschau konnte nicht erstellt werden."); }
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [ready, text, settings, template, hand.packed, call]);

  const patch = (p: Partial<InkSettings>) => setSettings((s) => ({ ...s, ...p }));

  async function pickTemplate() {
    try {
      const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      const asset = r.canceled ? null : r.assets[0];
      if (!asset) return;
      const bytes = await new File(asset.uri).bytes();
      const res = await call({ type: "template", name: asset.name, base64: bytesToBase64(bytes) });
      if (res.type === "template-ok") { setTemplate(asset.name); setNotice("Eigene Vorlage geladen."); }
    } catch (e) { setTemplate(null); setError(e instanceof Error ? e.message : "Datei konnte nicht gelesen werden."); }
  }
  async function dropTemplate() {
    try { await call({ type: "clear-template" }); setTemplate(null); } catch (e) { setError(e instanceof Error ? e.message : "Vorlage konnte nicht entfernt werden."); }
  }

  async function exportAs(kind: "pdf" | "goodnotes") {
    if (!pages.length) { setError("Es gibt noch nichts zum Exportieren."); return; }
    setBusy(kind); setError(null); setNotice(null);
    try {
      const res = await call({ type: kind === "pdf" ? "export-pdf" : "export-goodnotes" });
      if (res.type !== "exported") throw new Error("Unerwartete Antwort der Engine.");
      const names = exportFileNames(fileName, kind, res.files.length);
      for (let i = 0; i < res.files.length; i++) {
        const file = new File(Paths.cache, names[i] ?? `Notiz-${i + 1}.${kind === "pdf" ? "pdf" : "goodnotes"}`);
        if (file.exists) file.delete();
        file.create();
        await file.write(base64ToBytes(res.files[i] ?? ""));
        if (!(await Sharing.isAvailableAsync())) throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
        await Sharing.shareAsync(file.uri, {
          mimeType: kind === "pdf" ? "application/pdf" : "application/octet-stream",
          UTI: kind === "pdf" ? "com.adobe.pdf" : undefined,
          dialogTitle: names[i],
        });
      }
      setNotice(exportHint(kind, res.files.length));
    } catch (e) { setError(e instanceof Error ? e.message : "Der Export ist fehlgeschlagen."); }
    finally { setBusy(null); }
  }

  const chip = (label: string, on: boolean, onPress: () => void, extra?: object) => (
    <Pressable key={label} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={onPress}
      style={[styles.chip, { borderColor: on ? colors.ink : colors.border, backgroundColor: on ? colors.surface : "transparent" }, extra]}>
      <AppText variant="label">{label}</AppText>
    </Pressable>
  );


  const stepper = (id: RangeId, label: string, value: number, key: "size" | "weight" | "jitter") => (
    <View key={id} style={styles.stepper}>
      <View style={{ flex: 1 }}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="caption" tone="muted" accessibilityLiveRegion="polite">{rangeLabel(id, value)}</AppText>
      </View>
      <Button title="−" variant="secondary" accessibilityLabel={label + " verringern"} onPress={() => patch({ [key]: stepValue(id, value, -1) })} style={styles.stepBtn} />
      <Button title="+" variant="secondary" accessibilityLabel={label + " erhöhen"} onPress={() => patch({ [key]: stepValue(id, value, 1) })} style={styles.stepBtn} />
    </View>
  );

  return (
    <Screen title="Goodnotes-Tool." description="Getippter Text wird zu Handschrift. Export als .goodnotes-Datei oder PDF, alles direkt auf deinem Gerät." navigationTitle="Goodnotes-Tool">
      {/* Engine: unsichtbar, läuft komplett offline */}
      <View style={styles.hidden} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <WebView<unknown> ref={web} originWhitelist={["about:*", "data:*"]} source={{ html: GOODNOTES_HOST_HTML, baseUrl: "about:blank" }}
          onMessage={onMessage} javaScriptEnabled domStorageEnabled={false} allowFileAccess={false} setSupportMultipleWindows={false}
          onError={() => setError("Die Schreib-Engine konnte nicht gestartet werden.")} />
      </View>

      {error ? <ErrorState message={error} onRetry={() => setError(null)} retryLabel="Schließen" /> : null}
      {notice ? <AppText tone="accent" accessibilityLiveRegion="polite">{notice}</AppText> : null}

      <Card style={styles.block}>
        <AppText variant="section" accessibilityRole="header">Dein Text.</AppText>
        <Field label="Text" value={text} onChangeText={setText} multiline autoCapitalize="sentences" spellCheck />
        <AppText variant="caption" tone="muted">Zeilen mit # werden zu Überschriften, Zeilen mit - zu Aufzählungen. Dein Text bleibt auf diesem Gerät.</AppText>
      </Card>

      <Card style={styles.block}>
        <AppText variant="section" accessibilityRole="header">Stil.</AppText>
        <AppText variant="label">Ausgabe</AppText>
        <View style={styles.row} accessibilityRole="radiogroup">
          {chip("Echte Tinte", settings.mode === "ink", () => patch({ mode: "ink" }))}
          {chip("PDF-Seite", settings.mode === "pdf", () => patch({ mode: "pdf" }))}
        </View>
        <AppText variant="label">Schrift</AppText>
        <View style={styles.row} accessibilityRole="radiogroup">{FONTS.map((f) => chip(f, settings.font === f, () => patch({ font: f })))}
          {hand.count ? chip("Meine Handschrift", settings.font === HAND_FONT, () => patch({ font: HAND_FONT, handVary: settings.handVary || 0 })) : null}
        </View>
        <AppText variant="caption" tone="muted">{handInfo(hand.count, 85, hand.cloud)}</AppText>
        <View style={styles.row}>
          <Button title={hand.count ? "Handschrift bearbeiten" : "Eigene Handschrift zeichnen"} variant="secondary" onPress={() => hand.setPadOpen(true)} disabled={!hand.loaded} />
        </View>
        {settings.font === HAND_FONT ? (
          <View style={styles.row}>
            {chip(settings.handVary > 0 ? "Natürlich variieren: an" : "Natürlich variieren: aus", settings.handVary > 0, () => patch({ handVary: settings.handVary > 0 ? 0 : HAND_VARY.default }))}
            {settings.handVary > 0 ? (
              <View style={styles.row}>
                <Button title="−" variant="secondary" accessibilityLabel="Variation verringern" style={styles.stepBtn} onPress={() => patch({ handVary: Math.max(HAND_VARY.min, Math.round((settings.handVary - HAND_VARY.step) * 10) / 10) })} />
                <AppText variant="caption" tone="muted">{handVaryLabel(settings.handVary)}</AppText>
                <Button title="+" variant="secondary" accessibilityLabel="Variation erhöhen" style={styles.stepBtn} onPress={() => patch({ handVary: Math.min(HAND_VARY.max, Math.round((settings.handVary + HAND_VARY.step) * 10) / 10) })} />
              </View>
            ) : null}
          </View>
        ) : null}
        <AppText variant="label">Papier</AppText>
        <View style={styles.row} accessibilityRole="radiogroup">{PAPERS.map((p) => chip(p.label, settings.paper === p.id, () => patch({ paper: p.id })))}</View>
        <AppText variant="label">Tintenfarbe</AppText>
        <View style={styles.row} accessibilityRole="radiogroup">{INKS.map((i) => chip(i.label, settings.ink === i.id, () => patch({ ink: i.id })))}</View>
        {stepper("size", "Schriftgröße", settings.size, "size")}
        {settings.mode === "ink" ? stepper("weight", "Strichstärke", settings.weight, "weight") : null}
        {stepper("jitter", "Unregelmäßigkeit", settings.jitter, "jitter")}
        <AppText variant="label">Eigene Vorlage</AppText>
        <AppText variant="caption" tone="muted">{template ? `Geladen: ${template}` : "Nur nötig, wenn du ein anderes Format brauchst. Wähle eine einseitige .goodnotes-Datei."}</AppText>
        <View style={styles.row}>
          <Button title={template ? "Andere Vorlage wählen" : "Vorlage wählen"} variant="secondary" onPress={pickTemplate} disabled={!ready} />
          {template ? <Button title="Entfernen" variant="plain" onPress={dropTemplate} /> : null}
        </View>
      </Card>

      <Card style={styles.block}>
        <View style={styles.row}>
          <AppText variant="section" accessibilityRole="header">Vorschau.</AppText>
          <AppText tone="muted" variant="caption">{ready ? pageCountLabel(pages.length || 1) : "Engine startet …"}</AppText>
        </View>
        {pages.map((uri, i) => (
          <Image key={i} source={{ uri }} resizeMode="contain" accessibilityLabel={`Seite ${i + 1} von ${pages.length}`}
            style={[styles.page, { borderColor: colors.border }]} />
        ))}
      </Card>

      <Card style={styles.block}>
        <Field label="Dateiname" value={fileName} onChangeText={setFileName} autoCorrect={false} />
        <Button title="Als Goodnotes exportieren" onPress={() => exportAs("goodnotes")} loading={busy === "goodnotes"} disabled={!ready || !!busy || !pages.length} />
        <Button title="Als PDF exportieren" variant="secondary" onPress={() => exportAs("pdf")} loading={busy === "pdf"} disabled={!ready || !!busy || !pages.length} />
      </Card>
      <HandPad visible={hand.padOpen} packed={hand.packed} ink={settings.ink} cloud={hand.cloud} onSave={hand.save} onDelete={hand.count ? hand.remove : undefined} onClose={() => hand.setPadOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hidden: { height: 1, width: 1, opacity: 0, position: "absolute" },
  block: { gap: spacing.md },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  chip: { minHeight: 44, paddingHorizontal: spacing.lg, justifyContent: "center", borderWidth: 1, borderRadius: radius.pill },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepBtn: { minWidth: 52 },
  page: { width: "100%", aspectRatio: 595.28 / 841.89, borderWidth: 1, borderRadius: radius.field, backgroundColor: "#fff" },
});
