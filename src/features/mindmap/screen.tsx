import { File, Paths } from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import { usePreventRemove, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Keyboard, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { Models } from 'react-native-appwrite';
import { useSession } from '../../account/session';
import { databaseId, executeFunction, functionIds, listAllRows, Query, tableIds, tablesDB } from '../../backend';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { radius, spacing, usePensumTheme } from '../../theme';
import { AppText, Button, Field, LoadingState, Screen, Segmented, type HapticKind } from '../../ui';
import { BottomSheet } from '../../ui/BottomSheet';
import { PressableScale } from '../../ui/motion';
import { useStoreDeps } from '../../storage';
import { confirmAction, consentToGemini, errorText } from '../appwrite-tools/actions';
import { useAccountGuard } from '../appwrite-tools/account-scope';
import { createCloudHandStore, type PackedHand } from '../goodnotes/hand-store';
import { ExportMenu } from '../goodnotes/ExportMenu';
import { FormMessage, InkDot, Notice } from '../goodnotes/parts';
import { base64ToBytes } from '../goodnotes/protocol';
import { deleteQuietly } from '../goodnotes/request-queue';
import { putHandoff } from '../shared/handoff';
import { MapThumbnail, MindmapCanvas } from './canvas';
import { useGoodnotesExporter } from './goodnotes-export';
import { usableHand, type Hand } from './hand';
import { HAND_STYLE, STYLE, clampFontScale, layout, scaleStyle } from './layout';
import { measureInter, measureWithHand } from './measure';
import {
  DEFAULT_INK, INKS, buildScene, drawList, goodnotesPlacement, goodnotesStrokes, isInk, isPaper, pdfDocument,
} from './scene';
import * as S from './state';
import * as T from './tree';

type MapSummary = { id: string; day: string; topic: string; root?: T.MindmapNode };
type MindmapRow = Models.Row & { topic: string; day: string; data: string };
type Status = { day: string; usage: S.Usage };
type CreateResult = Status & { id: string; topic: string; map: unknown };
type RefineResult = Status & { map: unknown };
type FontChoice = 'standard' | 'hand';
type Sheet = 'create' | 'refine' | 'appearance' | 'export';
const unfolded = new Set<string>();

/** Vorlagen für das Thema: ein Tipp füllt das Feld (wie die Startvorschläge in Whimsical oder MindMeister). */
const TOPIC_TEMPLATES = [
  'Photosynthese', 'Französische Revolution', 'Bruchrechnung', 'Zellbiologie', 'Weimarer Republik',
  'Present Perfect', 'Klimawandel', 'Gedichtanalyse', 'Elektrischer Strom',
] as const;

/** Große Schaltfläche der Werkzeugleiste: Symbol über Beschriftung, 72 × 64 pt, auf dem iPad gut zu treffen. */
function DockButton({ label, symbol, onPress, disabled, accent, haptic = 'tap' }: {
  label: string;
  symbol: SymbolViewProps['name'];
  onPress: () => void;
  disabled?: boolean;
  accent?: boolean;
  haptic?: HapticKind | false;
}) {
  const { colors } = usePensumTheme();
  const fg = accent ? colors.onAccent : colors.ink;
  return (
    <PressableScale scaleTo={0.95} haptic={haptic} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.dockButton, {
        backgroundColor: accent ? colors.accentFill : pressed ? colors.border : 'transparent',
        opacity: disabled ? 0.4 : pressed && accent ? 0.82 : 1,
      }]}>
      <SymbolView name={symbol} size={24} tintColor={fg} accessible={false} />
      <AppText variant="caption" style={[styles.dockLabel, { color: fg }]} numberOfLines={1}>{label}</AppText>
    </PressableScale>
  );
}

/** Kachel der Übersicht (wie ein Stapel bei den Karteikarten): Vorschau oben, darunter Titel, Datum und die ersten Äste. */
function MapCard({ map, today, ink, width, busy, onOpen, onDelete }: {
  map: MapSummary;
  today: boolean;
  ink: string;
  width: number;
  busy: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { colors } = usePensumTheme();
  const root = map.root;
  const paper = isPaper(ink);
  const previewHeight = Math.round(Math.min(width * 0.62, 190));
  const scene = useMemo(() => {
    if (!root) return undefined;
    // Nur Thema und erste Ebene, damit die kleine Vorschau lesbar bleibt
    return buildScene(layout(root, measureInter, STYLE, new Set(T.branchIds(root))), null);
  }, [root]);
  const title = map.topic || 'Mindmap';
  const branches = root?.children.map((child) => child.text).filter(Boolean).slice(0, 3).join(' · ');
  const count = root ? T.countNodes(root) : undefined;
  const meta = `${today ? 'Heute' : S.dayLabel(map.day)}${count ? ` · ${count} Punkte` : ''}`;

  return (
    <View style={[styles.card, { width, backgroundColor: colors.canvas, borderColor: colors.hairlineSoft }]}>
      <PressableScale scaleTo={0.985} haptic="tap" accessibilityRole="button" accessibilityLabel={`${title}, ${meta}`}
        disabled={busy} onPress={onOpen} onLongPress={today ? undefined : onDelete} style={styles.cardOpen}>
        <View style={[styles.preview, { height: previewHeight, backgroundColor: paper ? '#ffffff' : colors.surface }]}>
          {scene ? <MapThumbnail scene={scene} ink={ink} width={width - 2} height={previewHeight} /> : null}
        </View>
        <View style={styles.cardBody}>
          <AppText variant="h4" numberOfLines={2} style={styles.cardTitle}>{title}</AppText>
          <AppText variant="bodySm" tone="muted">{meta}</AppText>
          {branches ? <AppText variant="bodySm" tone="muted" numberOfLines={2}>{branches}</AppText> : null}
        </View>
      </PressableScale>
      {today ? null : (
        <PressableScale scaleTo={0.92} haptic="warn" accessibilityRole="button" accessibilityLabel={`${title} löschen`} disabled={busy}
          onPress={onDelete} hitSlop={8} style={[styles.cardMore, { backgroundColor: colors.canvas, borderColor: colors.border }]}>
          <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={16} tintColor={colors.ink} accessible={false} />
        </PressableScale>
      )}
    </View>
  );
}

export function MindmapScreen({ userId }: { userId: string }) {
  const router = useRouter();
  const { colors } = usePensumTheme();
  const requireAccount = useAccountGuard();
  const { state: session, updatePrefs, registerBeforeLogout } = useSession();
  const deps = useStoreDeps();
  const { fontScale } = useWindowDimensions();
  const prefs = session.status === 'account' ? session.user.prefs : undefined;

  /* ---- Zustand ---- */
  const [list, setList] = useState<MapSummary[]>([]);
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>();
  const [statusError, setStatusError] = useState('');
  const [current, setCurrent] = useState<MapSummary>();
  const [editor, setEditor] = useState<S.EditorState>();
  const editorRef = useRef<S.EditorState | undefined>(undefined);
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [createError, setCreateError] = useState('');
  const [aiError, setAiError] = useState('');
  const [actionError, setActionError] = useState('');
  const [exportError, setExportError] = useState('');
  const [sheet, setSheet] = useState<Sheet>();
  const [notice, setNotice] = useState('');
  const [font, setFont] = useState<FontChoice>(prefs?.mmFont === 'hand' ? 'hand' : 'standard');
  const [ink, setInk] = useState<string>(isInk(prefs?.mmInk) ? prefs.mmInk : DEFAULT_INK);
  const [hand, setHand] = useState<Hand | null>(null);
  const [saveStatus, setSaveStatus] = useState<S.SaveStatus>('saved');
  const [exporting, setExporting] = useState<'goodnotes' | 'pdf' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [canvasReset, setCanvasReset] = useState(0);
  const [gridWidth, setGridWidth] = useState(0);
  const cardGap = spacing.md;
  const gridColumns = gridWidth >= 900 ? 3 : gridWidth >= 560 ? 2 : 1;
  const cardWidth = Math.max(0, Math.floor((gridWidth - cardGap * (gridColumns - 1)) / gridColumns));
  const goodnotes = useGoodnotesExporter();

  const setEditorNow = useCallback((next: S.EditorState | undefined) => { editorRef.current = next; setEditor(next); }, []);

  /* ---- Speichern (verzögert, wie im Web) ---- */
  const saver = useMemo(() => S.createSaver({
    save: async (id, root) => {
      requireAccount();
      await tablesDB.updateRow({ databaseId, tableId: tableIds.mindmaps, rowId: id, data: { data: JSON.stringify(root), topic: S.topicOf(root) } });
    },
    onStatus: setSaveStatus,
  }), [requireAccount]);
  useEffect(() => registerBeforeLogout(async () => { if (!await saver.flush()) throw new Error('Die Mindmap konnte nicht gespeichert werden.'); }), [registerBeforeLogout, saver]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => { if (next !== 'active') void saver.flush(); });
    return () => { sub.remove(); void saver.flush().finally(() => saver.dispose()); };
  }, [saver]);
  usePreventRemove(saveStatus === 'error', ({ repeat }) => {
    void confirmAction('Ungespeicherte Änderungen', 'Die letzten Änderungen an dieser Mindmap konnten noch nicht gespeichert werden. Trotzdem verlassen?', 'Verlassen', true)
      .then((ok) => { if (ok) repeat(); });
  });

  /* ---- Laden: Liste, Status, Handschrift ---- */
  const openMap = useCallback(async (summary: MapSummary) => {
    await saver.flush();
    requireAccount();
    const row = await tablesDB.getRow<MindmapRow>({ databaseId, tableId: tableIds.mindmaps, rowId: summary.id });
    const root = T.parse(row.data);
    if (!root) throw new Error('Die Mindmap ist beschädigt.');
    setCurrent({ id: row.$id, day: row.day, topic: row.topic });
    setEditorNow(S.openEditor(root));
    setInstruction('');
    setAiError('');
    setActionError('');
  }, [requireAccount, saver, setEditorNow]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const rows = await listAllRows<MindmapRow>(tableIds.mindmaps, [
          Query.equal('userId', userId), Query.orderDesc('$createdAt'), Query.select(['$id', 'topic', 'day', 'data']),
        ], requireAccount);
        if (!active) return;
        // Die Übersicht zeigt je Mindmap Titel und Vorschau; geöffnet wird erst per Tipp auf die Kachel.
        const summaries = rows.map((row): MapSummary => {
          const root = T.parse(row.data);
          return { id: row.$id, day: row.day, topic: row.topic, ...(root ? { root } : {}) };
        });
        setList(summaries);
        setListError('');
      } catch (reason) {
        if (active) setListError(errorText(reason));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [attempt, requireAccount, userId]);

  useEffect(() => {
    let active = true;
    executeFunction<Status>(functionIds.mindmap, { action: 'status' })
      .then((value) => { if (active) { setStatus(value); setStatusError(''); } })
      .catch((reason: unknown) => { if (active) setStatusError(errorText(reason)); });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    if (!deps) return;
    let active = true;
    createCloudHandStore({ $id: userId }, { kv: deps.kv, rows: deps.rows, tableId: tableIds.handwriting }).load()
      .then((packed: PackedHand | null) => {
        if (!active) return;
        const loaded = usableHand(packed);
        setHand(loaded);
        if (!loaded) setFont('standard');
      })
      .catch(() => { if (active) setHand(null); });
    return () => { active = false; };
  }, [deps, userId]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  /* ---- Darstellung ---- */
  const useHandFont = font === 'hand' && !!hand;
  const scale = clampFontScale(fontScale);
  const root = editor?.root;
  const scene = useMemo(() => {
    if (!root) return undefined;
    const lay = layout(
      root,
      useHandFont && hand ? measureWithHand(hand) : measureInter,
      scaleStyle(useHandFont ? HAND_STYLE : STYLE, scale),
      unfolded,
    );
    return buildScene(lay, useHandFont ? hand : null);
  }, [root, hand, scale, useHandFont]);
  const today = !!current && !!status && current.day === status.day;

  /* ---- KI und Verwaltung ---- */
  const runAi = useCallback(async (fn: () => Promise<void>, setError: (text: string) => void) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (reason) {
      setError(errorText(reason));
      executeFunction<Status>(functionIds.mindmap, { action: 'status' }).then(setStatus).catch(() => {}); // Zähler neu lesen, falls das Limit erreicht wurde
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, []);

  function create() {
    const text = topic.trim();
    if (!text) { setCreateError('Gib ein Thema ein.'); return; }
    Keyboard.dismiss();
    void runAi(async () => {
      if (!await consentToGemini('Dein Thema mit Hinweisen')) return;
      requireAccount();
      const result = await executeFunction<CreateResult>(functionIds.mindmap, { action: 'create', topic: text, notes: notes.trim() });
      const created = T.sanitize(result.map);
      if (!created) throw new Error('Die Mindmap ist beschädigt.');
      await saver.flush();
      const summary: MapSummary = { id: result.id, day: result.day, topic: result.topic, root: created };
      setStatus({ day: result.day, usage: result.usage });
      setList((value) => [summary, ...value.filter((entry) => entry.id !== summary.id)]);
      setCurrent(summary);
      setEditorNow(S.openEditor(created));
      setSheet(undefined);
      setTopic('');
      setNotes('');
      setNotice('Mindmap erstellt.');
    }, setCreateError);
  }

  function refine() {
    const text = instruction.trim();
    if (!text) { setAiError('Schreib, was die KI ändern soll.'); return; }
    if (!editor || !current || !today || S.aiLeft(status?.usage) <= 0) return;
    const id = current.id;
    Keyboard.dismiss();
    void runAi(async () => {
      if (!await consentToGemini('Deine Mindmap und die Änderungsanweisung')) return;
      await saver.flush();
      requireAccount();
      const result = await executeFunction<RefineResult>(functionIds.mindmap, { action: 'refine', instruction: text, map: editorRef.current?.root ?? editor.root });
      setStatus({ day: result.day, usage: result.usage });
      const before = editorRef.current;
      if (!before) return;
      const map = T.sanitize(result.map);
      if (!map) throw new Error('Die KI-Antwort war nicht brauchbar.');
      if (id !== currentId.current) return; // in der Zwischenzeit gewechselt
      const { state: next } = S.applyAiMap(before, map);
      setEditorNow(next);
      saver.schedule(id, next.root);
      setCanvasReset((value) => value + 1);
      setSheet(undefined);
      setInstruction('');
      setNotice('Die KI hat die Mindmap geändert.');
    }, setAiError);
  }
  const currentId = useRef<string | undefined>(undefined);
  currentId.current = current?.id;

  /** Löschen aus der Übersicht (nicht die Mindmap von heute, wie bisher). */
  function removeMap(target: MapSummary) {
    if (target.day === status?.day || busy) return;
    void runAi(async () => {
      if (!await confirmAction('Mindmap löschen?', `„${target.topic}“ wird endgültig gelöscht.`, 'Löschen', true)) return;
      requireAccount();
      try {
        await tablesDB.deleteRow({ databaseId, tableId: tableIds.mindmaps, rowId: target.id });
      } catch (reason) {
        if ((reason as { code?: number } | null)?.code !== 404) throw reason;
      }
      saver.drop(target.id);
      setList((value) => value.filter((entry) => entry.id !== target.id));
      if (currentId.current === target.id) { setCurrent(undefined); setEditorNow(undefined); }
    }, setActionError);
  }

  function openFromOverview(summary: MapSummary) {
    if (busy) return;
    void runAi(async () => { await openMap(summary); }, setActionError);
  }

  /** Zurück zur Übersicht: erst speichern, dann die Vorschau der Kachel mit dem neuesten Stand auffrischen. */
  function closeMap() {
    if (busy) return;
    void runAi(async () => {
      await saver.flush();
      const id = currentId.current;
      const latest = editorRef.current?.root;
      if (id && latest) setList((value) => value.map((entry) => entry.id === id ? { ...entry, topic: S.topicOf(latest), root: latest } : entry));
      setCurrent(undefined);
      setEditorNow(undefined);
    }, setActionError);
  }

  /* ---- Schrift und Farbe (werden wie im Web im Konto gemerkt) ---- */
  function chooseFont(next: FontChoice) {
    if (next === font || (next === 'hand' && !hand)) return;
    setFont(next);
    void updatePrefs({ mmFont: next }).catch(() => {});
  }
  function chooseInk(next: string) {
    if (next === ink) return;
    setInk(next);
    void updatePrefs({ mmInk: next }).catch(() => {});
  }

  /* ---- Export ---- */
  async function shareBytes(base64: string, name: string, mimeType: string, uti?: string) {
    const file = new File(Paths.cache, name);
    try {
      if (file.exists) file.delete();
      file.create();
      file.write(base64ToBytes(base64));
      await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: name });
    } finally {
      deleteQuietly(file);
    }
  }

  async function exportPdf() {
    if (!scene || !editor || !current || exporting) return;
    setExporting('pdf'); setExportError(''); setNotice('');
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
      const page = pdfDocument(scene, ink);
      const printed = await printToFileAsync({ html: page.html, width: page.width, height: page.height, base64: true });
      try {
        if (!printed.base64) throw new Error('Das PDF konnte nicht erstellt werden.');
        await shareBytes(printed.base64, `${S.exportBase(editor.root, current.day)}.pdf`, 'application/pdf', 'com.adobe.pdf');
      } finally {
        deleteQuietly(new File(printed.uri));
      }
      setNotice('PDF bereit zum Teilen.');
      setSheet(undefined);
    } catch (reason) { setExportError(errorText(reason)); }
    finally { setExporting(null); }
  }

  async function exportGoodnotes() {
    if (!scene || !editor || !current || exporting) return;
    setExporting('goodnotes'); setExportError(''); setNotice('');
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
      const strokes = goodnotesStrokes(scene);
      const base64 = await goodnotes.run({ draw: drawList(scene), ink, place: goodnotesPlacement(scene), strokes });
      await shareBytes(base64, `${S.exportBase(editor.root, current.day)}.goodnotes`, 'application/octet-stream');
      setNotice(strokes ? 'Handschrift als Stiftstriche. Jetzt in Goodnotes öffnen.' : 'Als Bild exportiert. Für Striche wähle die eigene Handschrift.');
      setSheet(undefined);
    } catch (reason) { setExportError(errorText(reason)); }
    finally { setExporting(null); }
  }

  const canCreate = S.canCreateToday(status?.usage);
  const canRefine = today && S.aiLeft(status?.usage) > 0;
  const exportBlocked = !scene || busy || !!exporting;
  const closeSheet = () => setSheet(undefined);
  function openExport() {
    setExportError('');
    setSheet('export');
  }

  return (
    <Screen
      wide
      scroll={false}
      navigationTitle="Mindmap-Generator"
      contentStyle={styles.screen}
    >
      {goodnotes.element}
      {statusError ? <FormMessage text={statusError} onDismiss={() => setAttempt((n) => n + 1)} /> : null}
      {listError ? <FormMessage text={`Deine Mindmaps konnten nicht geladen werden. ${listError}`} onDismiss={() => setAttempt((n) => n + 1)} /> : null}
      {notice ? <Notice text={notice} /> : null}
      {saveStatus === 'error' ? (
        <FormMessage text="Die Änderung konnte noch nicht gespeichert werden. Zum Wiederholen antippen." onDismiss={() => void saver.flush()} />
      ) : null}

      {scene && current ? (
        <>
          <View style={styles.toolbar}>
            <AppText variant="h4" numberOfLines={2} accessibilityRole="header" style={styles.mapTitle}>{root?.text || current.topic}</AppText>
            {today && !canRefine ? <AppText variant="caption" tone="muted">KI-Änderungen für heute aufgebraucht</AppText> : null}
          </View>
          <MindmapCanvas key={`${current.id}:${canvasReset}`} scene={scene} ink={ink} />
          <View style={styles.dockRow}>
            <View style={[styles.dock, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityRole="toolbar">
              <DockButton label="Übersicht" symbol={{ ios: 'square.grid.2x2', android: 'grid_view', web: 'grid_view' }} disabled={busy}
                onPress={closeMap} />
              {canCreate ? <DockButton label="Neu" symbol={{ ios: 'plus.circle', android: 'add_circle', web: 'add_circle' }} disabled={busy}
                onPress={() => setSheet('create')} /> : null}
              {today ? <DockButton label="Mit KI" symbol={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} disabled={busy || !canRefine}
                onPress={() => setSheet('refine')} /> : null}
              <View style={[styles.dockDivider, { backgroundColor: colors.border }]} />
              <DockButton label="Zentrieren" symbol={{ ios: 'viewfinder', android: 'center_focus_strong', web: 'center_focus_strong' }}
                onPress={() => setCanvasReset((value) => value + 1)} />
              <DockButton label="Darstellung" symbol={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }} onPress={() => setSheet('appearance')} />
              <DockButton label="Exportieren" accent symbol={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }} disabled={exportBlocked}
                haptic="open" onPress={openExport} />
            </View>
          </View>
        </>
      ) : (
        <View style={styles.overview}>
          {loading || (!status && !statusError) ? <LoadingState title="Mindmaps werden geladen" /> : (
            <>
              <ScrollView contentContainerStyle={styles.overviewContent} showsVerticalScrollIndicator={false}
                onLayout={({ nativeEvent: { layout: { width } } }) => setGridWidth((old) => old === width ? old : width)}>
                <View style={styles.overviewHead}>
                  <AppText variant="h1" accessibilityRole="header" style={styles.overviewTitle}>Mindmaps.</AppText>
                  <AppText tone="muted">
                    {list.length ? `${list.length} ${list.length === 1 ? 'Mindmap' : 'Mindmaps'}` : 'Noch keine Mindmaps.'}
                    {status && !canCreate ? ' Eine neue kannst du morgen wieder erstellen.' : ''}
                  </AppText>
                </View>
                {actionError ? <FormMessage text={actionError} onDismiss={() => setActionError('')} /> : null}
                {list.length ? (
                  <View style={[styles.cards, { gap: cardGap }]}>
                    {list.map((entry) => (
                      <MapCard key={entry.id} map={entry} today={entry.day === status?.day} ink={ink} width={cardWidth} busy={busy}
                        onOpen={() => openFromOverview(entry)} onDelete={() => removeMap(entry)} />
                    ))}
                  </View>
                ) : (
                  <View style={[styles.emptyCard, { borderColor: colors.border }]}>
                    <AppText variant="h4">Starte deine erste Mindmap.</AppText>
                    <AppText variant="bodySm" tone="muted">Gib ein Thema ein oder wähle eine Vorlage, die KI baut dir die Mindmap.</AppText>
                  </View>
                )}
              </ScrollView>
              <PressableScale scaleTo={0.94} haptic="open" accessibilityRole="button" accessibilityLabel="Neue Mindmap erstellen"
                accessibilityState={{ disabled: !canCreate || busy }} disabled={!canCreate || busy} onPress={() => setSheet('create')}
                style={[styles.fab, { backgroundColor: colors.ink, opacity: !canCreate || busy ? 0.35 : 1 }]}>
                <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={26} weight="semibold" tintColor={colors.onPrimary} accessible={false} />
              </PressableScale>
            </>
          )}
        </View>
      )}

      <BottomSheet visible={sheet === 'create'} title="Mindmap erstellen" busy={busy} onClose={closeSheet}>
        <Field label="Thema" value={topic} onChangeText={(value) => { setTopic(value); setCreateError(''); }} maxLength={120} editable={!busy} placeholder="z. B. Photosynthese" />
        <Field label="Hinweise (optional)" value={notes} onChangeText={setNotes} maxLength={500} multiline editable={!busy} placeholder="z. B. für eine Klausur in Klasse 9" />
        <AppText variant="fieldLabel">Vorlagen</AppText>
        <View style={styles.templates}>
          {TOPIC_TEMPLATES.map((entry) => (
            <Button key={entry} title={entry} variant={topic === entry ? 'soft' : 'secondary'} size="sm" disabled={busy}
              onPress={() => { setTopic(entry); setCreateError(''); }} />
          ))}
        </View>
        {createError ? <FormMessage text={createError} /> : null}
        <Button title={busy ? 'KI arbeitet …' : 'Mindmap erstellen'} haptic="send" loading={busy} disabled={!canCreate} onPress={create} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'refine'} title="Mit KI ändern" busy={busy} onClose={closeSheet}>
        <AppText variant="bodySm" tone="muted">{S.aiInfoText({ hasMap: Boolean(root), today, usage: status?.usage })}</AppText>
        <Field label="Was soll sich ändern?" value={instruction} onChangeText={(value) => { setInstruction(value); setAiError(''); }}
          maxLength={500} multiline editable={!busy && canRefine} placeholder="z. B. Erkläre die Lichtreaktion ausführlicher" />
        {aiError ? <FormMessage text={aiError} /> : null}
        <Button title={busy ? 'KI arbeitet …' : 'Änderung anwenden'} haptic="send" loading={busy} disabled={!canRefine} onPress={refine} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'appearance'} title="Darstellung" onClose={closeSheet}>
        <AppText variant="fieldLabel">Schrift</AppText>
        <Segmented label="Schrift" value={useHandFont ? 'hand' : 'standard'} onChange={chooseFont} options={[
          { id: 'standard', label: 'Standardschrift' },
          { id: 'hand', label: 'Eigene Handschrift', disabled: !hand },
        ]} />
        {!hand ? <Button title="Handschrift in Goodnotes einrichten" variant="plain" size="sm" onPress={() => {
          closeSheet();
          router.push('/tools/goodnotes');
        }} /> : null}
        <AppText variant="fieldLabel">Farbe</AppText>
        <View accessibilityRole="radiogroup" accessibilityLabel="Farbe" style={styles.inks}>
          {INKS.map((entry) => <InkDot key={entry.id} color={entry.id} label={entry.name} selected={entry.id === ink} onPress={() => chooseInk(entry.id)} />)}
        </View>
      </BottomSheet>

      <ExportMenu visible={sheet === 'export'} onClose={closeSheet} busy={!!exporting} error={exportError} rows={[
        { id: 'goodnotes', title: 'Als Goodnotes', hint: '.goodnotes-Datei zum Öffnen in Goodnotes', symbol: 'square.and.arrow.up',
          accessibilityLabel: 'Als Goodnotes exportieren', busy: exporting === 'goodnotes', disabled: exportBlocked, onPress: () => void exportGoodnotes() },
        { id: 'pdf', title: 'Als PDF', hint: 'Zum Drucken und Teilen', symbol: 'doc.richtext',
          accessibilityLabel: 'Als PDF exportieren', busy: exporting === 'pdf', disabled: exportBlocked, onPress: () => void exportPdf() },
        { id: 'tool', title: 'In Goodnotes-Tool übernehmen', hint: 'Die Punkte dort als Text öffnen', symbol: 'pencil.and.scribble',
          accessibilityLabel: 'Text in Goodnotes-Tool übernehmen', busy: false, disabled: exportBlocked, onPress: () => {
            if (!root) return;
            putHandoff(T.formatTree(root), root.text);
            setSheet(undefined);
            router.push('/tools/goodnotes');
          } },
      ]} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  toolbar: { gap: spacing.sm, paddingBottom: spacing.xs },
  mapTitle: { flexShrink: 1 },
  dockRow: { alignItems: 'center', paddingTop: spacing.xs },
  dock: {
    maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.xs,
    borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1,
  },
  dockButton: {
    minWidth: 72, minHeight: 64, flexShrink: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingHorizontal: spacing.sm, borderRadius: radius.field, borderCurve: 'continuous',
  },
  dockLabel: { fontSize: 12, textAlign: 'center' },
  dockDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: spacing.sm },
  templates: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  inks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  overview: { flex: 1 },
  overviewContent: { gap: spacing.lg, paddingBottom: 110 },
  overviewHead: { gap: spacing.xs },
  overviewTitle: { fontSize: 32, lineHeight: 37 },
  cards: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  cardOpen: { overflow: 'hidden' },
  preview: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cardBody: { gap: 2, padding: spacing.lg },
  cardTitle: { fontSize: 18, lineHeight: 23 },
  cardMore: {
    position: 'absolute', top: spacing.sm, right: spacing.sm, width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyCard: { gap: spacing.xs, padding: spacing.xl, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderStyle: 'dashed' },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.lg, width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
  },
});
