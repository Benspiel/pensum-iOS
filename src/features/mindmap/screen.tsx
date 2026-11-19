import { File, Paths } from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import { usePreventRemove, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Keyboard, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { Models } from 'react-native-appwrite';
import { useSession } from '../../account/session';
import { databaseId, executeFunction, functionIds, listAllRows, Query, tableIds, tablesDB } from '../../backend';
import { spacing } from '../../theme';
import { AppText, Button, Field, LoadingState, Screen, Segmented } from '../../ui';
import { BottomSheet } from '../../ui/BottomSheet';
import { useStoreDeps } from '../../storage';
import { confirmAction, consentToGemini, errorText } from '../appwrite-tools/actions';
import { useAccountGuard } from '../appwrite-tools/account-scope';
import { createCloudHandStore, type PackedHand } from '../goodnotes/hand-store';
import { ExportBar, ExportMenu } from '../goodnotes/ExportMenu';
import { FormMessage, InkDot, Notice } from '../goodnotes/parts';
import { base64ToBytes } from '../goodnotes/protocol';
import { deleteQuietly } from '../goodnotes/request-queue';
import { putHandoff } from '../shared/handoff';
import { MindmapCanvas } from './canvas';
import { useGoodnotesExporter } from './goodnotes-export';
import { usableHand, type Hand } from './hand';
import { HAND_STYLE, STYLE, clampFontScale, layout, scaleStyle } from './layout';
import { measureInter, measureWithHand } from './measure';
import {
  DEFAULT_INK, INKS, buildScene, drawList, goodnotesPlacement, goodnotesStrokes, isInk, pdfDocument,
} from './scene';
import * as S from './state';
import * as T from './tree';

type MapSummary = { id: string; day: string; topic: string };
type MindmapRow = Models.Row & { topic: string; day: string; data: string };
type Status = { day: string; usage: S.Usage };
type CreateResult = Status & { id: string; topic: string; map: unknown };
type RefineResult = Status & { map: unknown };
type FontChoice = 'standard' | 'hand';
type Sheet = 'create' | 'refine' | 'library' | 'appearance' | 'export';
const unfolded = new Set<string>();

export function MindmapScreen({ userId }: { userId: string }) {
  const router = useRouter();
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
          Query.equal('userId', userId), Query.orderDesc('$createdAt'), Query.select(['$id', 'topic', 'day']),
        ], requireAccount);
        if (!active) return;
        const summaries = rows.map((row) => ({ id: row.$id, day: row.day, topic: row.topic }));
        setList(summaries);
        setListError('');
        // Pro Tag gibt es eine Mindmap, die neueste ist also die von heute (falls vorhanden)
        const first = summaries[0];
        if (first && !editorRef.current) await openMap(first);
      } catch (reason) {
        if (active) setListError(errorText(reason));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [attempt, openMap, requireAccount, userId]);

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
      const summary = { id: result.id, day: result.day, topic: result.topic };
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

  function removeMap() {
    if (!current || today || busy) return;
    const target = current;
    void runAi(async () => {
      if (!await confirmAction('Mindmap löschen?', `„${target.topic}“ wird endgültig gelöscht.`, 'Löschen', true)) return;
      requireAccount();
      try {
        await tablesDB.deleteRow({ databaseId, tableId: tableIds.mindmaps, rowId: target.id });
      } catch (reason) {
        if ((reason as { code?: number } | null)?.code !== 404) throw reason;
      }
      saver.drop(target.id);
      const rest = list.filter((entry) => entry.id !== target.id);
      setList(rest);
      setCurrent(undefined);
      setEditorNow(undefined);
      const next = rest.find((entry) => entry.day === status?.day) ?? rest[0];
      if (next) await openMap(next);
      else setSheet(undefined);
    }, setActionError);
  }

  function switchMap(summary: MapSummary) {
    if (summary.id === current?.id || busy) return;
    void runAi(async () => { await openMap(summary); setSheet(undefined); }, setActionError);
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
      footer={scene ? (
        <ExportBar onPress={openExport} disabled={exportBlocked} actions={[
          { title: 'Zentrieren', symbol: { ios: 'viewfinder', android: 'center_focus_strong', web: 'center_focus_strong' },
            onPress: () => setCanvasReset((value) => value + 1) },
          { title: 'Darstellung', symbol: { ios: 'slider.horizontal.3', android: 'tune', web: 'tune' },
            onPress: () => setSheet('appearance') },
        ]} />
      ) : undefined}
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
            <View style={styles.actions}>
              <Button title="Meine Mindmaps" variant="soft" size="sm" disabled={busy} onPress={() => setSheet('library')} />
              {canCreate ? <Button title="Mindmap erstellen" size="sm" disabled={busy} onPress={() => setSheet('create')} /> : null}
              {today ? <Button title="Mit KI ändern" size="sm" disabled={busy || !canRefine} onPress={() => setSheet('refine')} /> : null}
            </View>
            {today && !canRefine ? <AppText variant="caption" tone="muted">KI-Änderungen für heute aufgebraucht</AppText> : null}
          </View>
          <MindmapCanvas key={`${current.id}:${canvasReset}`} scene={scene} ink={ink} />
        </>
      ) : (
        <View style={styles.empty}>
          {loading || (!status && !statusError) ? <LoadingState title="Mindmaps werden geladen" /> : (
            <>
              <AppText variant="h2" accessibilityRole="header">Deine Mindmaps</AppText>
              {canCreate ? <Button title="Mindmap erstellen" disabled={busy} onPress={() => setSheet('create')} /> : (
                status ? <AppText tone="muted">Du kannst morgen wieder eine neue Mindmap erstellen.</AppText> : null
              )}
              {list.length ? <Button title="Meine Mindmaps öffnen" variant="secondary" disabled={busy} onPress={() => setSheet('library')} /> : null}
            </>
          )}
        </View>
      )}

      <BottomSheet visible={sheet === 'create'} title="Mindmap erstellen" busy={busy} onClose={closeSheet}>
        <Field label="Thema" value={topic} onChangeText={(value) => { setTopic(value); setCreateError(''); }} maxLength={120} editable={!busy} placeholder="z. B. Photosynthese" />
        <Field label="Hinweise (optional)" value={notes} onChangeText={setNotes} maxLength={500} multiline editable={!busy} placeholder="z. B. für eine Klausur in Klasse 9" />
        {createError ? <FormMessage text={createError} /> : null}
        <Button title={busy ? 'KI arbeitet …' : 'Mindmap erstellen'} loading={busy} disabled={!canCreate} onPress={create} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'refine'} title="Mit KI ändern" busy={busy} onClose={closeSheet}>
        <AppText variant="bodySm" tone="muted">{S.aiInfoText({ hasMap: Boolean(root), today, usage: status?.usage })}</AppText>
        <Field label="Was soll sich ändern?" value={instruction} onChangeText={(value) => { setInstruction(value); setAiError(''); }}
          maxLength={500} multiline editable={!busy && canRefine} placeholder="z. B. Erkläre die Lichtreaktion ausführlicher" />
        {aiError ? <FormMessage text={aiError} /> : null}
        <Button title={busy ? 'KI arbeitet …' : 'Änderung anwenden'} loading={busy} disabled={!canRefine} onPress={refine} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'library'} title="Meine Mindmaps" busy={busy} onClose={closeSheet}>
        {actionError ? <FormMessage text={actionError} onDismiss={() => setActionError('')} /> : null}
        {list.map((entry) => (
          <Button key={entry.id} title={S.mapOptionLabel(entry, status?.day)} variant={entry.id === current?.id ? 'soft' : 'secondary'}
            accessibilityState={{ selected: entry.id === current?.id }} disabled={busy} onPress={() => {
              if (entry.id === current?.id) closeSheet();
              else switchMap(entry);
            }} />
        ))}
        {current && !today && status ? <Button title="Diese Mindmap löschen" variant="plain" disabled={busy} onPress={removeMap} /> : null}
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
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  inks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  empty: { flex: 1, gap: spacing.lg, alignItems: 'center', justifyContent: 'center' },
});
