/* Goodnotes-Tool – nativer Screen. Die Tinten-Engine läuft unverändert und offline in einer WebView (engine/, host-html.generated.ts);
 * Eingabe, Auswahl, Speichern und Teilen sind nativ. Vorlage Web: tools/goodnotes/index.html + goodnotes.js + goodnotes.css (Commit 770dbe4).
 * Reihenfolge und Optik wie die Website: Vorschau, Panels „Dein Text.“ und „Stil.“, eigene Vorlage, Export als Stack-Panel-Zeilen. */
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { radius, spacing, usePensumTheme } from "../../theme";
import { AppText, Badge, Button, Field, Panel, Screen } from "../../ui";
import { useWideLayout } from "../../ui/TwoColumn";
import { takeHandoff } from "../shared/handoff";
import { HandPad } from "./HandPad";
import { COLUMN_GAP, PREVIEW_WEIGHT, SETTINGS_WEIGHT, optionColumns, splitColumnWidths } from "./layout";
import { handInfo } from "./hand-store";
import { GOODNOTES_HOST_HTML } from "./host-html.generated";
import { ExportList, FormMessage, Grid, InkDot, Notice, OptionTile, PaperSwatch, StepperRow } from "./parts";
import { useHand } from "./useHand";
import { deleteQuietly, ENGINE_GIVEUP_MESSAGE } from "./request-queue";
import { useWebViewChannel } from "./useWebViewChannel";
import {
  DEFAULT_SETTINGS, FONTS, HAND_FONT, HAND_VARY, handVaryLabel, INKS, PAPERS, base64ToBytes, bytesToBase64, exportFileNames, exportHint,
  pageCountLabel, parseHostMessage, rangeLabel, stepValue, type RangeId, type HostMessage, type HostRequest, type InkSettings,
} from "./protocol";

const SAMPLE = "# Lernzettel Biologie\n\nDie Zelle ist die kleinste Einheit des Lebens.\n- Zellkern: enthält die DNA\n- Mitochondrien: Kraftwerke der Zelle\n- Ribosomen: bauen Proteine";

type Req = HostRequest extends infer T ? (T extends { id: string } ? Omit<T, "id"> : never) : never;

export default function GoodnotesScreen() {
  const { colors } = usePensumTheme();
  const { width } = useWindowDimensions();
  const { split, inner } = useWideLayout();
  const [epoch, setEpoch] = useState(0);
  const [text, setText] = useState(SAMPLE);
  const [fileName, setFileName] = useState("Lernzettel");
  const [settings, setSettings] = useState<InkSettings>(DEFAULT_SETTINGS);
  const [pages, setPages] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<string | null>(null);
  // Vorlage merken: stürzt die WebView ab, ist sie in der Engine weg und wird nach dem Neustart erneut geladen
  const templateRef = useRef<{ name: string; base64: string } | null>(null);
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
  // Ohne Handschrift darf sie nicht ausgewählt bleiben (Web: selectFont("Caveat"))
  useEffect(() => { if (hand.loaded && !hand.count && settings.font === HAND_FONT) setSettings((s) => ({ ...s, font: "Caveat", handVary: 0 })); }, [hand.loaded, hand.count, settings.font]);

  // Nach (Neu-)Start der Engine: gemerkte Vorlage wieder laden, danach Vorschau neu rendern
  useEffect(() => {
    if (!ready) return;
    let stale = false;
    (async () => {
      const t = templateRef.current;
      if (t) {
        try { await call({ type: "template", name: t.name, base64: t.base64 }); }
        catch (e) { if (!stale) { templateRef.current = null; setTemplate(null); setError(e instanceof Error ? e.message : "Die Vorlage konnte nicht neu geladen werden."); } }
      }
      if (!stale) setEpoch((n) => n + 1);
    })();
    return () => { stale = true; };
  }, [ready, call]);

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
  }, [ready, epoch, text, settings, template, hand.packed, call]);

  const patch = (p: Partial<InkSettings>) => setSettings((s) => ({ ...s, ...p }));

  async function pickTemplate() {
    try {
      const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      const asset = r.canceled ? null : r.assets[0];
      if (!asset) return;
      const picked = new File(asset.uri);
      let base64: string;
      try {
        const size = asset.size ?? picked.size;
        if (!size || size > 25 * 1024 * 1024) throw new Error("Wähle eine .goodnotes-Vorlage bis 25 MB.");
        base64 = bytesToBase64(await picked.bytes());
      } finally {
        deleteQuietly(picked);
      }
      const res = await call({ type: "template", name: asset.name, base64 });
      if (res.type === "template-ok") { templateRef.current = { name: asset.name, base64 }; setTemplate(asset.name); setNotice("Eigene Vorlage geladen."); }
    } catch (e) { templateRef.current = null; setTemplate(null); setError(e instanceof Error ? e.message : "Datei konnte nicht gelesen werden."); }
  }
  async function dropTemplate() {
    try { await call({ type: "clear-template" }); templateRef.current = null; setTemplate(null); } catch (e) { setError(e instanceof Error ? e.message : "Vorlage konnte nicht entfernt werden."); }
  }

  async function exportAs(kind: "pdf" | "goodnotes") {
    if (!pages.length) { setError("Es gibt noch nichts zum Exportieren."); return; }
    setBusy(kind); setError(null); setNotice(null);
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
      setNotice(exportHint(kind, res.files.length));
    } catch (e) { setError(e instanceof Error ? e.message : "Der Export ist fehlgeschlagen."); }
    finally { for (const f of made) deleteQuietly(f); setBusy(null); }
  }

  const stepFor = (id: RangeId, key: "size" | "weight" | "jitter", value: number) => (dir: 1 | -1) => patch({ [key]: stepValue(id, value, dir) });
  const varyBy = (dir: 1 | -1) => patch({ handVary: Math.min(HAND_VARY.max, Math.max(HAND_VARY.min, Math.round((settings.handVary + dir * HAND_VARY.step) * 10) / 10)) });
  const { fonts: columnsFonts, papers: columnsPapers } = optionColumns(width, split, splitColumnWidths(inner).settings);
  const exportBlocked = !ready || !!busy || !pages.length;

  /* Bausteine; einspaltig stehen sie untereinander (Telefon), auf dem iPad links Vorschau und rechts Einstellungen (Web: .gn-split) */
  const previewHead = (
    <View style={styles.previewHead}>
      <AppText variant="section" accessibilityRole="header">Vorschau.</AppText>
      <Badge label={ready ? pageCountLabel(pages.length || 1) : "Engine startet …"} />
      <AppText variant="caption" tone="muted" style={styles.previewMeta}>A4 · entspricht dem Export</AppText>
    </View>
  );
  const pageImages = pages.map((uri, i) => (
    <Image key={i} source={{ uri }} resizeMode="contain" accessibilityLabel={`Seite ${i + 1} von ${pages.length}`} style={styles.page} />
  ));

  const textPanel = (
    <Panel style={styles.panel}>
      <AppText variant="h4" accessibilityRole="header" style={styles.panelTitle}>Dein Text.</AppText>
      <Field
        label="Text" value={text} onChangeText={setText} multiline autoCapitalize="sentences" spellCheck style={[styles.textarea, split && styles.textareaWide]}
        hint="Zeilen mit # werden zu Überschriften, Zeilen mit - zu Aufzählungen. Dein Text bleibt auf diesem Gerät."
      />
    </Panel>
  );
  const stylePanel = (
    <Panel style={styles.panel}>
      <AppText variant="h4" accessibilityRole="header" style={styles.panelTitle}>Stil.</AppText>

      <View style={styles.group}>
        <AppText variant="fieldLabel">Ausgabe</AppText>
        <View style={styles.pair} accessibilityRole="radiogroup" accessibilityLabel="Ausgabe">
          <View style={styles.half}><OptionTile title="Echte Tinte" hint="Radieren, auswählen, umfärben. Wie selbst geschrieben." selected={settings.mode === "ink"} onPress={() => patch({ mode: "ink" })} /></View>
          <View style={styles.half}><OptionTile title="PDF-Seite" hint="Text ist Teil des Seitenhintergrunds." selected={settings.mode === "pdf"} onPress={() => patch({ mode: "pdf" })} /></View>
        </View>
      </View>

      <View style={styles.group}>
        <AppText variant="fieldLabel">Schrift</AppText>
        <View accessibilityRole="radiogroup" accessibilityLabel="Schrift" style={styles.group}>
          <Grid columns={columnsFonts}>
            {FONTS.map((f) => <OptionTile key={f} center title={f} selected={settings.font === f} onPress={() => patch({ font: f })} />)}
          </Grid>
          {hand.count ? (
            <OptionTile title="Meine Handschrift" hint={handInfo(hand.count, 85, hand.cloud)} selected={settings.font === HAND_FONT} onPress={() => patch({ font: HAND_FONT, handVary: settings.handVary || 0 })} />
          ) : null}
        </View>
        {hand.count ? null : <AppText variant="caption" tone="muted">{handInfo(hand.count, 85, hand.cloud)}</AppText>}
        <View style={styles.wrap}>
          <Button title={hand.count ? "Handschrift bearbeiten" : "Eigene Handschrift zeichnen"} variant="soft" size="sm" onPress={() => hand.setPadOpen(true)} disabled={!hand.loaded} />
        </View>
        {settings.font === HAND_FONT ? (
          <View style={styles.group}>
            <View style={styles.toggle}>
              <AppText variant="fieldLabel" style={styles.toggleLabel}>Natürlich variieren</AppText>
              <Switch
                value={settings.handVary > 0}
                onValueChange={(on) => patch({ handVary: on ? HAND_VARY.default : 0 })}
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
    </Panel>
  );
  const templatePanel = (
    <Panel style={styles.template}>
      <AppText variant="fieldLabel">Eigene Vorlage</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={template ? "Andere Vorlage wählen" : "Vorlage wählen"}
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        onPress={pickTemplate}
        style={[styles.drop, { backgroundColor: colors.canvas, borderColor: template ? colors.ink : colors.muted, borderStyle: template ? "solid" : "dashed", opacity: ready ? 1 : 0.5 }]}
      >
        {template ? <Badge label="Gespeichert" /> : null}
        <AppText variant="fieldLabel" accessible={false}>{template ? "Andere Vorlage wählen" : "Vorlage wählen"}</AppText>
        <AppText variant="bodySm" tone="muted" accessible={false}>{template ? `Geladen: ${template}` : "Nur nötig, wenn du ein anderes Format brauchst. Wähle eine einseitige .goodnotes-Datei."}</AppText>
      </Pressable>
      {template ? <Button title="Entfernen" accessibilityLabel="Eigene Vorlage entfernen" variant="plain" size="sm" onPress={dropTemplate} style={styles.removeTemplate} /> : null}
    </Panel>
  );
  const exportSection = (
    <View style={styles.section}>
      <Field label="Dateiname" value={fileName} onChangeText={setFileName} autoCorrect={false} />
      <ExportList
        title="Exportieren"
        rows={[
          { id: "gn", title: "Als Goodnotes", hint: ".goodnotes-Datei zum Öffnen in Goodnotes", symbol: { ios: "pencil.line", android: "edit", web: "edit" }, accessibilityLabel: "Als Goodnotes exportieren", busy: busy === "goodnotes", disabled: exportBlocked, onPress: () => exportAs("goodnotes") },
          { id: "pdf", title: "Als PDF", hint: "Zum Drucken und Teilen", symbol: { ios: "doc.text", android: "description", web: "description" }, accessibilityLabel: "Als PDF exportieren", busy: busy === "pdf", disabled: exportBlocked, onPress: () => exportAs("pdf") },
        ]}
      />
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
    <>
      {/* Engine und Handschrift-Blatt stehen neben dem Screen: wechselt er zwischen einer und zwei Spalten, bleiben WebView und Blatt unangetastet */}
      {engine}
      <Screen
        title="Goodnotes-Tool." description="Getippter Text wird zu Handschrift. Export als .goodnotes-Datei oder PDF, alles direkt auf deinem Gerät." navigationTitle="Goodnotes-Tool"
        scroll={!split} wide={split}
      >
        {error ? <FormMessage text={error} onDismiss={() => setError(null)} /> : null}
        {notice ? <Notice text={notice} /> : null}

        {split ? (
          <View style={styles.panes}>
            {/* links: Vorschau, bleibt beim Scrollen der Einstellungen stehen (eigener Scrollbereich wie .gn-stage im Web) */}
            <View style={[styles.previewPane, { flex: PREVIEW_WEIGHT }]}>
              {previewHead}
              <ScrollView style={[styles.stageScroll, { backgroundColor: colors.surface }]} contentContainerStyle={styles.stage} accessibilityLabel="Vorschau der Seiten">
                {pageImages}
              </ScrollView>
            </View>
            <ScrollView
              style={{ flex: SETTINGS_WEIGHT }}
              contentContainerStyle={styles.settings}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
              {textPanel}
              {stylePanel}
              {templatePanel}
              {exportSection}
            </ScrollView>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              {previewHead}
              {pages.length ? <View style={[styles.stage, styles.stageFlat, { backgroundColor: colors.surface }]}>{pageImages}</View> : null}
            </View>
            {textPanel}
            {stylePanel}
            {templatePanel}
            {exportSection}
          </>
        )}
      </Screen>
      <HandPad visible={hand.padOpen} packed={hand.packed} ink={settings.ink} cloud={hand.cloud} onSave={hand.save} onDelete={hand.count ? hand.remove : undefined} onClose={() => hand.setPadOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  hidden: { height: 1, width: 1, opacity: 0, position: "absolute" },
  section: { gap: spacing.md },
  previewHead: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: spacing.md, rowGap: spacing.sm },
  previewMeta: { marginLeft: "auto" },
  stage: { gap: spacing.lg, padding: spacing.lg },
  stageFlat: { borderRadius: radius.card, borderCurve: "continuous" },
  panes: { flex: 1, flexDirection: "row", gap: COLUMN_GAP, minHeight: 0 },
  previewPane: { minWidth: 0, minHeight: 0, gap: spacing.md },
  stageScroll: { flex: 1, borderRadius: radius.card, borderCurve: "continuous", overflow: "hidden" },
  settings: { gap: spacing.lg, paddingBottom: spacing.xl },
  page: { width: "100%", aspectRatio: 595.28 / 841.89, borderRadius: radius.field, backgroundColor: "#fff" },
  panel: { gap: spacing.xl },
  panelTitle: { marginBottom: -spacing.sm },
  textarea: { minHeight: 220 },
  textareaWide: { minHeight: 260 },
  group: { gap: spacing.sm },
  pair: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.lg, minHeight: 48 },
  toggleLabel: { flexShrink: 1 },
  inks: { flexDirection: "row", gap: spacing.sm },
  template: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.field },
  drop: { gap: spacing.xs, alignItems: "flex-start", padding: spacing.lg, borderWidth: 1, borderRadius: radius.field, borderCurve: "continuous" },
  removeTemplate: { alignSelf: "flex-start" },
});
