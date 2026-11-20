import { File, Paths } from "expo-file-system";
import { useFonts } from "expo-font";
import { useHeaderHeight } from "expo-router/react-navigation";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, TextInput, View, useWindowDimensions } from "react-native";
import { WebView, type WebViewMessageEvent } from "./engine-view";

import { gutter, radius, resolveTextStyle, spacing, usePensumTheme } from "../../theme";
import { AppText, Badge, Button, Panel, Screen } from "../../ui";
import { Disclosure } from "../../ui/Disclosure";
import { haptic } from "../../ui/haptics";
import { useWideLayout } from "../../ui/TwoColumn";
import { takeHandoff } from "../shared/handoff";
import { ExportBar, ExportMenu } from "./ExportMenu";
import { fontSampleSources, fontSamples } from "./font-samples";
import { HandPad } from "./HandPad";
import { PreviewViewer } from "./PreviewViewer";
import { optionColumns, previewColumns } from "./layout";
import { handInfo } from "./hand-store";
import { GOODNOTES_HOST_HTML } from "./host-html.generated";
import { FormMessage, Grid, InkDot, Notice, OptionTile, PagePlaceholder, PaperSwatch, PreviewPage, StepperRow } from "./parts";
import { useHand } from "./useHand";
import { deleteQuietly, ENGINE_GIVEUP_MESSAGE } from "./request-queue";
import { useWebViewChannel } from "./useWebViewChannel";
import {
  DEFAULT_SETTINGS, FONTS, HAND_FONT, HAND_VARY, handVaryLabel, INKS, PAPERS, base64ToBytes, exportFileNames, exportHint,
  pageCountLabel, parseHostMessage, rangeLabel, stepValue, type RangeId, type HostMessage, type HostRequest, type InkSettings,
} from "./protocol";

const SAMPLE = [
  "# Lernzettel Biologie",
  "",
  "Die Zelle ist die kleinste Einheit des Lebens.",
  "- Zellkern: enthält die DNA",
  "- Mitochondrien: Kraftwerke der Zelle",
  "- Ribosomen: bauen Proteine",
  "",
  "Tipp: Zeilen mit # werden zu Überschriften, Zeilen mit - zu Aufzählungen.",
].join("\n");
const A4_ASPECT = 595.28 / 841.89;

type Req = HostRequest extends infer T ? (T extends { id: string } ? Omit<T, "id"> : never) : never;

export default function GoodnotesScreen() {
  const { colors, customFonts, scheme } = usePensumTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const { inner } = useWideLayout();
  const headerHeight = useHeaderHeight();
  const [sampleFontsLoaded] = useFonts(fontSampleSources);
  const [epoch, setEpoch] = useState(0);
  const [text, setText] = useState(SAMPLE);
  const [fileName, setFileName] = useState("Lernzettel");
  const [settings, setSettings] = useState<InkSettings>(DEFAULT_SETTINGS);
  const [pages, setPages] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [exportError, setExportError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const settingsScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const editorTop = useRef(0);
  const giveUp = useCallback(() => setError(ENGINE_GIVEUP_MESSAGE), []);
  const { web, ready, setReady, instance, getQueue, request, handleTerminated } = useWebViewChannel({ idPrefix: "gn", onGiveUp: giveUp });

  // Werkzeugübergabe einmalig aus dem Arbeitsspeicher übernehmen.
  useEffect(() => {
    const h = takeHandoff();
    if (h) { setText(h.text); setFileName(h.name); setNotice("Text aus dem vorherigen Werkzeug übernommen."); }
  }, []);

  // Zeitlimit (Export 60 s, sonst 20 s) und Abbruch bei Absturz/Unmount stecken in der Queue (request-queue.ts)
  const call = useCallback((req: Req): Promise<HostMessage> => request(req) as Promise<HostMessage>, [request]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    const m = parseHostMessage(e.nativeEvent.data);
    if (!m) return;
    if (m.type === "ready") { setReady(true); return; }
    const q = getQueue();
    if (m.type === "error") q.reject(m.id, new Error(m.message)); else q.resolve(m.id, m);
  }, [getQueue, setReady]);

  const say = useMemo(() => ({ notice: (t: string) => { setNotice(t); setError(null); }, error: (t: string) => setError(t) }), []);
  const hand = useHand(call, ready, say);
  const hasText = text.trim().length > 0;
  // Ohne Handschrift darf sie nicht ausgewählt bleiben (Web: selectFont("Caveat"))
  useEffect(() => { if (hand.loaded && !hand.count && settings.font === HAND_FONT) setSettings((s) => ({ ...s, font: "Caveat", handVary: 0 })); }, [hand.loaded, hand.count, settings.font]);

  // Nach (Neu-)Start der Engine die Vorschau neu rendern.
  useEffect(() => {
    if (!ready) return;
    setEpoch((n) => n + 1);
  }, [ready]);

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
  }, [ready, epoch, text, settings, hand.packed, call]);

  const patch = (p: Partial<InkSettings>) => setSettings((s) => ({ ...s, ...p }));

  async function exportAs(kind: "pdf" | "goodnotes") {
    if (!hasText || !ready || busy) return;
    Keyboard.dismiss();
    setBusy(kind); setExportError(""); setNotice(null);
    const made: File[] = [];
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
      const res = await call({ type: kind === "pdf" ? "export-pdf" : "export-goodnotes", text, settings });
      if (res.type !== "exported") throw new Error("Unerwartete Antwort der Engine.");
      const names = exportFileNames(fileName, kind, res.files.length);
      for (let i = 0; i < res.files.length; i++) {
        const file = new File(Paths.cache, names[i] ?? `Notiz-${i + 1}.${kind === "pdf" ? "pdf" : "goodnotes"}`);
        if (file.exists) file.delete();
        file.create();
        made.push(file);
        file.write(base64ToBytes(res.files[i] ?? ""));
        await Sharing.shareAsync(file.uri, {
          mimeType: kind === "pdf" ? "application/pdf" : "application/octet-stream",
          UTI: kind === "pdf" ? "com.adobe.pdf" : undefined,
          dialogTitle: names[i],
        });
        deleteQuietly(file); // nach dem Teilen nicht im Cache liegen lassen; ein Fehler beim Löschen stört das Teilen nicht
      }
      setExportOpen(false);
      setNotice(exportHint(kind, res.files.length));
    } catch (e) { setExportError(e instanceof Error ? e.message : "Der Export ist fehlgeschlagen."); }
    finally { for (const f of made) deleteQuietly(f); setBusy(null); }
  }

  const stepFor = (id: RangeId, key: "size" | "weight" | "jitter", value: number) => (dir: 1 | -1) => patch({ [key]: stepValue(id, value, dir) });
  const varyBy = (dir: 1 | -1) => patch({ handVary: Math.min(HAND_VARY.max, Math.max(HAND_VARY.min, Math.round((settings.handVary + dir * HAND_VARY.step) * 10) / 10)) });
  const columns = previewColumns(inner, height, fontScale);
  const split = columns !== undefined;
  const { fonts: columnsFonts, papers: columnsPapers } = optionColumns(columns?.editor ?? inner, fontScale, gutter(width) + 1);
  const compactPageHeight = Math.round(Math.max(128, Math.min(224, height * 0.28)));
  const textHeight = Math.round(Math.max(224, Math.min(300, height * 0.3)) * Math.max(1, fontScale));
  const exportBlocked = !ready || !!busy || !hasText;
  const paper = PAPERS.find((entry) => entry.id === settings.paper)?.label ?? "Liniert";
  const exportSummary = `Vorlage: ${paper} · ${settings.mode === "ink" ? "echte Tinte" : "PDF-Seite"}`;
  function openExport() {
    Keyboard.dismiss();
    setExportError("");
    setExportOpen(true);
  }
  function revealFocusedEditor() {
    if (!split && input.current?.isFocused()) {
      settingsScroll.current?.scrollTo({ y: editorTop.current, animated: false });
    }
  }

  const body = resolveTextStyle("body", { customFonts });
  const editor = (
    <View style={styles.editor}>
      <TextInput
        ref={input}
        accessibilityLabel="Dein Text"
        accessibilityHint="Nutze # für Überschriften und - für Listen."
        value={text}
        onChangeText={setText}
        placeholder="Schreib oder füge deinen Text hier ein."
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        keyboardAppearance={scheme}
        autoCapitalize="sentences"
        spellCheck
        multiline
        onFocus={revealFocusedEditor}
        style={[styles.textInput, {
          height: textHeight, backgroundColor: colors.canvas, color: colors.ink,
          fontSize: body.fontSize, fontFamily: body.fontFamily,
        }]}
      />
      <AppText variant="caption" tone="muted"># macht eine Überschrift, - eine Aufzählung. Dein Text bleibt auf diesem Gerät.</AppText>
    </View>
  );
  const pageStyle = [styles.page, !split && { width: compactPageHeight * A4_ASPECT }];
  const preview = (
    <View style={[styles.preview, columns && { width: columns.preview }]}>
      <View style={styles.previewHead}>
        <AppText variant="section" accessibilityRole="header">Vorschau.</AppText>
        <Badge label={pages.length ? pageCountLabel(pages.length) : "Wird erstellt …"} />
        <AppText variant="caption" tone="muted" style={styles.previewMeta}>A4 · entspricht dem Export</AppText>
      </View>
      <ScrollView
        horizontal={!split}
        style={[styles.stageScroll, { backgroundColor: colors.surface }, split ? styles.fill : { flexGrow: 0, height: compactPageHeight + 2 * spacing.md }]}
        contentContainerStyle={[styles.stage, split ? styles.wideStage : styles.horizontalStage, !split && pages.length <= 1 && styles.centerPage]}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        accessibilityLabel="Vorschau der Seiten"
      >
        {pages.length
          ? pages.map((uri, i) => <PreviewPage key={i} uri={uri} label={`Seite ${i + 1} von ${pages.length}`} style={pageStyle} onPress={() => { Keyboard.dismiss(); setViewerIndex(i); }} />)
          : <PagePlaceholder style={[pageStyle, { backgroundColor: colors.canvas }]} />}
      </ScrollView>
      <PreviewViewer pages={pages} index={viewerIndex} onClose={() => setViewerIndex(null)} />
    </View>
  );
  const stylePanel = (
    <View style={styles.styleOptions}>
      <View style={styles.group}>
        <AppText variant="fieldLabel">Ausgabe</AppText>
        <View style={columnsFonts === 3 ? styles.pair : styles.group} accessibilityRole="radiogroup" accessibilityLabel="Ausgabe">
          <View style={columnsFonts === 3 && styles.fill}><OptionTile title="Echte Tinte" hint="Radieren, auswählen, umfärben. Wie selbst geschrieben." selected={settings.mode === "ink"} onPress={() => patch({ mode: "ink" })} /></View>
          <View style={columnsFonts === 3 && styles.fill}><OptionTile title="PDF-Seite" hint="Text ist Teil des Seitenhintergrunds." selected={settings.mode === "pdf"} onPress={() => patch({ mode: "pdf" })} /></View>
        </View>
      </View>

      <View style={styles.group}>
        <AppText variant="fieldLabel">Handschrift</AppText>
        <View accessibilityRole="radiogroup" accessibilityLabel="Handschrift" style={styles.group}>
          <Grid columns={columnsFonts}>
            {FONTS.map((font) => (
              <OptionTile key={font} center title={fontSamples[font].label} label={font}
                titleStyle={sampleFontsLoaded ? [styles.fontSample, { fontFamily: font }] : undefined}
                selected={settings.font === font} onPress={() => patch({ font })} />
            ))}
          </Grid>
          {hand.count ? (
            <OptionTile title="Meine Handschrift" hint={handInfo(hand.count, 85, hand.cloud)} selected={settings.font === HAND_FONT} onPress={() => patch({ font: HAND_FONT, handVary: settings.handVary || 0 })} />
          ) : null}
        </View>
        {hand.count ? null : <AppText variant="caption" tone="muted">{handInfo(hand.count, 85, hand.cloud)}</AppText>}
        <View style={styles.wrap}>
          <Button title={hand.count ? "Handschrift bearbeiten" : "Eigene Handschrift zeichnen"} variant="soft" size="sm" haptic="open" onPress={() => hand.setPadOpen(true)} disabled={!hand.loaded} />
        </View>
        {settings.font === HAND_FONT ? (
          <View style={styles.group}>
            <View style={styles.toggle}>
              <AppText variant="fieldLabel" style={styles.toggleLabel}>Natürlich variieren</AppText>
              <Switch
                value={settings.handVary > 0}
                onValueChange={(on) => { haptic("select"); patch({ handVary: on ? HAND_VARY.default : 0 }); }}
                accessibilityLabel="Natürlich variieren"
                trackColor={{ false: colors.border, true: colors.ink }}
                thumbColor={colors.canvas}
                ios_backgroundColor={colors.border}
              />
            </View>
            {settings.handVary > 0 ? <StepperRow label="Variation" valueLabel={handVaryLabel(settings.handVary)} onStep={varyBy} /> : null}
          </View>
        ) : null}
      </View>

      <View style={styles.group}>
        <AppText variant="fieldLabel">Papier</AppText>
        <View accessibilityRole="radiogroup" accessibilityLabel="Papier">
          <Grid columns={columnsPapers}>
            {PAPERS.map((p) => (
              <OptionTile key={p.id} title={p.label} selected={settings.paper === p.id} onPress={() => patch({ paper: p.id })}>
                <PaperSwatch kind={p.id} />
              </OptionTile>
            ))}
          </Grid>
        </View>
      </View>

      <View style={styles.group}>
        <AppText variant="fieldLabel">Tintenfarbe</AppText>
        <View style={styles.inks} accessibilityRole="radiogroup" accessibilityLabel="Tintenfarbe">
          {INKS.map((i) => <InkDot key={i.id} color={i.id} label={i.label} selected={settings.ink === i.id} onPress={() => patch({ ink: i.id })} />)}
        </View>
      </View>

      <StepperRow label="Schriftgröße" valueLabel={rangeLabel("size", settings.size)} onStep={stepFor("size", "size", settings.size)} />
      {settings.mode === "ink" ? <StepperRow label="Strichstärke" valueLabel={rangeLabel("weight", settings.weight)} onStep={stepFor("weight", "weight", settings.weight)} /> : null}
      <StepperRow label="Unregelmäßigkeit" valueLabel={rangeLabel("jitter", settings.jitter)} onStep={stepFor("jitter", "jitter", settings.jitter)} />
    </View>
  );
  const engine = (
    <View style={styles.hidden} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <WebView<unknown> key={instance} ref={web} originWhitelist={["about:*", "data:*"]} source={{ html: GOODNOTES_HOST_HTML, baseUrl: "about:blank" }}
        onMessage={onMessage} javaScriptEnabled domStorageEnabled={false} allowFileAccess={false} setSupportMultipleWindows={false}
        onContentProcessDidTerminate={handleTerminated} onRenderProcessGone={handleTerminated}
        onError={() => setError("Die Schreib-Engine konnte nicht gestartet werden.")} />
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={headerHeight}>
      {engine}
      <Screen
        navigationTitle="Handschrift-Tool"
        scroll={false} wide contentStyle={styles.screen}
        footer={hasText ? (
          <ExportBar
            onPress={openExport}
            disabled={exportBlocked}
            document={{ name: fileName, onChangeName: setFileName, summary: exportSummary }}
          />
        ) : undefined}
      >
        {error ? <FormMessage text={error} onDismiss={() => setError(null)} /> : null}
        {notice ? <Notice text={notice} /> : null}

        <View style={[styles.workspace, columns && { flexDirection: "row", gap: columns.gap }]}>
          {split ? preview : null}
          <ScrollView
            ref={settingsScroll}
            style={styles.settingsScroll}
            contentContainerStyle={styles.settings}
            showsVerticalScrollIndicator={false}
            onLayout={revealFocusedEditor}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          >
            {!split ? preview : null}
            <View onLayout={({ nativeEvent: { layout } }) => { editorTop.current = layout.y; }}>
              {split ? <SectionPanel title="Dein Text.">{editor}</SectionPanel> : <Disclosure title="Dein Text." large defaultOpen>{editor}</Disclosure>}
            </View>
            {split ? (
              <SectionPanel title="Stil.">
                {stylePanel}
              </SectionPanel>
            ) : (
              <Disclosure title="Stil." large>
                {stylePanel}
              </Disclosure>
            )}
          </ScrollView>
        </View>
      </Screen>
      <ExportMenu
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        busy={!!busy}
        error={exportError}
        rows={[
          { id: "pdf", title: "Als PDF", hint: "Zum Drucken und Teilen", symbol: { ios: "doc.text", android: "description", web: "description" }, accessibilityLabel: "Als PDF exportieren", busy: busy === "pdf", disabled: exportBlocked, onPress: () => void exportAs("pdf") },
        ]}
      />
      <HandPad visible={hand.padOpen} packed={hand.packed} ink={settings.ink} cloud={hand.cloud} onSave={hand.save} onDelete={hand.count ? hand.remove : undefined} onClose={() => hand.setPadOpen(false)} />
    </KeyboardAvoidingView>
  );
}

/** Abschnitt wie die Karten der Website: getönte Fläche, Überschrift, Inhalt – dauerhaft offen. */
function SectionPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel style={styles.section}>
      <AppText variant="section" accessibilityRole="header">{title}</AppText>
      {children}
    </Panel>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { height: 1, width: 1, opacity: 0, position: "absolute" },
  screen: { paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.md },
  editor: { gap: spacing.sm },
  textInput: {
    textAlignVertical: "top", paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.field, borderCurve: "continuous",
  },
  workspace: { flex: 1, minHeight: 0 },
  preview: { minHeight: 0, gap: spacing.sm },
  previewHead: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  previewMeta: { marginLeft: "auto", flexShrink: 1 },
  stage: { gap: spacing.lg, padding: spacing.md, alignItems: "center" },
  wideStage: { padding: spacing.lg },
  horizontalStage: { flexGrow: 1 },
  centerPage: { justifyContent: "center" },
  // Kein flexGrow hier: ein gesetztes flexGrow: 0 schlägt `flex: 1` (Yoga und RN Web) und ließ die Vorschau im Zweispalter auf Höhe 0 zusammenfallen.
  stageScroll: { borderRadius: radius.card, borderCurve: "continuous", overflow: "hidden" },
  settingsScroll: { flex: 1, minWidth: 0 },
  settings: { gap: spacing.lg, paddingBottom: spacing.md },
  /** Web `.gn-stage canvas`: Radius 16 wie eine Fläche, nicht 8 */
  page: { width: "100%", aspectRatio: A4_ASPECT, borderRadius: radius.field, borderCurve: "continuous", backgroundColor: "#fff" },
  styleOptions: { gap: spacing.xl },
  fontSample: { fontSize: 24, lineHeight: 29, fontWeight: "400" },
  section: { gap: spacing.lg },
  group: { gap: spacing.sm },
  pair: { flexDirection: "row", gap: spacing.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.lg, minHeight: 48 },
  toggleLabel: { flexShrink: 1 },
  inks: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  template: { gap: spacing.md, marginTop: spacing.md, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  drop: { gap: spacing.xs, alignItems: "flex-start", padding: spacing.lg, borderWidth: 1, borderRadius: radius.field, borderCurve: "continuous" },
  removeTemplate: { alignSelf: "flex-start" },
});
