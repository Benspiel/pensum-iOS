/* Mindmap-Generator – nativer Screen. Vorlage Web: tools/mindmap/index.html + mindmap.css + mindmap.js (Web-Commit 1612dc2).
 * Reihenfolge und Optik wie die Website: Kopf, Nutzungs-Badges, Panel „Mindmap für heute erstellen.“, „Deine Mindmap.“ mit Werkzeugleiste in
 * zwei Gruppen, Zeichenfläche, Schrift/Farbe, Panels „Ausgewählter Punkt.“ und „Mit KI ändern.“, Export-Zeilen.
 * Logik (Baum, Verlauf, Speichern, Zoom) steckt in tree.ts, state.ts, scene.ts – hier nur Oberfläche und Anbindung. */
import { File, Paths } from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import { usePreventRemove, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { AppState, PixelRatio, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import type { Models } from 'react-native-appwrite';
import { useSession } from '../../account/session';
import { databaseId, executeFunction, functionIds, listAllRows, Query, tableIds, tablesDB } from '../../backend';
import { spacing } from '../../theme';
import { AppText, Badge, Button, Field, LoadingState, Panel, Screen } from '../../ui';
import { TwoColumn, useWideLayout } from '../../ui/TwoColumn';
import { useStoreDeps } from '../../storage';
import { confirmAction, consentToGemini, errorText } from '../appwrite-tools/actions';
import { useAccountGuard } from '../appwrite-tools/account-scope';
import { createCloudHandStore, type PackedHand } from '../goodnotes/hand-store';
import { FormMessage, Notice } from '../goodnotes/parts';
import { base64ToBytes } from '../goodnotes/protocol';
import { deleteQuietly } from '../goodnotes/request-queue';
import { putHandoff } from '../shared/handoff';
import type { CanvasHandle } from './canvas';
import { EditorView, MapLibrary, showLibrary } from './editor-view';
import { useGoodnotesExporter } from './goodnotes-export';
import { usableHand, type Hand } from './hand';
import { HAND_STYLE, STYLE, clampFontScale, layout, scaleStyle } from './layout';
import { measureInter, measureWithHand } from './measure';
import {
  DEFAULT_INK, INKS, buildScene, drawList, goodnotesPlacement, goodnotesStrokes, isInk, pdfDocument,
} from './scene';
import * as S from './state';
import * as T from './tree';
import { MAP_COLUMN_WEIGHTS, canvasHeightFor, mapColumnWidth, soloPanelMaxWidth } from './wide';

type MapSummary = { id: string; day: string; topic: string };
type MindmapRow = Models.Row & { topic: string; day: string; data: string };
type Status = { day: string; usage: S.Usage };
type CreateResult = Status & { id: string; topic: string; map: unknown };
type RefineResult = Status & { map: unknown };
type FontChoice = 'standard' | 'hand';

export function MindmapScreen({ userId }: { userId: string }) {
  const router = useRouter();
  const requireAccount = useAccountGuard();
  const { state: session, updatePrefs, registerBeforeLogout } = useSession();
  const deps = useStoreDeps();
  const { height, fontScale } = useWindowDimensions();
  const { split, inner } = useWideLayout();
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
  const [nodeText, setNodeText] = useState('');
  const nodeInput = useRef<ComponentRef<typeof TextInput>>(null);
  const nodeFocused = useRef(false);
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [createError, setCreateError] = useState('');
  const [aiError, setAiError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [font, setFont] = useState<FontChoice>(prefs?.mmFont === 'hand' ? 'hand' : 'standard');
  const [ink, setInk] = useState<string>(isInk(prefs?.mmInk) ? prefs.mmInk : DEFAULT_INK);
  const [hand, setHand] = useState<Hand | null>(null);
  const [saveStatus, setSaveStatus] = useState<S.SaveStatus>('saved');
  const [exporting, setExporting] = useState<'goodnotes' | 'pdf' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const canvas = useRef<CanvasHandle>(null);
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
    setNodeText(root.text);
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
  const collapsed = editor?.collapsed;
  const scene = useMemo(() => {
    if (!root || !collapsed) return undefined;
    const lay = layout(
      root,
      useHandFont && hand ? measureWithHand(hand) : measureInter,
      scaleStyle(useHandFont ? HAND_STYLE : STYLE, scale),
      collapsed,
    );
    return buildScene(lay, useHandFont ? hand : null);
  }, [root, collapsed, hand, scale, useHandFont]);
  const tools = editor ? S.toolState(editor) : undefined;
  const today = !!current && !!status && current.day === status.day;
  const canvasHeight = canvasHeightFor(height, split, scene ? { sceneWidth: scene.width, sceneHeight: scene.height, canvasWidth: mapColumnWidth(inner, spacing.xl) } : undefined);
  const bigText = PixelRatio.getFontScale() > 1.3;

  // Textfeld folgt der Auswahl, solange man nicht gerade darin tippt (Web: renderTools)
  useEffect(() => {
    if (!editor || nodeFocused.current) return;
    setNodeText(T.find(editor.root, editor.selectedId)?.node.text ?? '');
  }, [editor]);

  /* ---- Bearbeiten ---- */
  const mutate = useCallback((fn: (state: S.EditorState) => { state: S.EditorState; changed: boolean } | S.EditorState) => {
    const before = editorRef.current;
    if (!before || !current) return;
    const result = fn(before);
    const { state: next, changed } = 'changed' in result ? result : { state: result, changed: false };
    setEditorNow(next);
    if (next.error !== before.error) setActionError(next.error);
    if (changed || next.root !== before.root) {
      saver.schedule(current.id, next.root);
      const name = S.topicOf(next.root);
      setList((value) => value.map((entry) => entry.id === current.id ? { ...entry, topic: name } : entry));
    }
  }, [current, saver, setEditorNow]);

  const focusText = () => { setTimeout(() => nodeInput.current?.focus(), 60); };
  const select = (id: string) => { mutate((s) => S.selectNode(s, id)); };
  const edit = (result: (s: S.EditorState) => T.EditResult, then?: () => void) => {
    mutate((s) => S.applyChange(s, result(s)));
    then?.();
  };

  function onNodeText(value: string) {
    setNodeText(value);
    const state = editorRef.current;
    if (!state) return;
    const result = T.rename(state.root, state.selectedId, value);
    if (result.error) { setActionError(result.error); return; }
    mutate((s) => S.applyChange(s, result, { coalesce: `text:${s.selectedId}`, select: false }));
  }

  function onNodeBlur() {
    nodeFocused.current = false;
    const state = editorRef.current;
    if (!state) return;
    const hit = T.find(state.root, state.selectedId);
    if (hit && !hit.node.text.trim()) mutate((s) => S.applyChange(s, T.rename(s.root, s.selectedId, 'Punkt'), { select: false }));
    else setNodeText(hit?.node.text ?? '');
  }

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
      setNodeText(created.text);
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
    void runAi(async () => {
      if (!await consentToGemini('Deine Mindmap und die Änderungsanweisung')) return;
      await saver.flush();
      requireAccount();
      const result = await executeFunction<RefineResult>(functionIds.mindmap, { action: 'refine', instruction: text, map: editorRef.current?.root ?? editor.root });
      setStatus({ day: result.day, usage: result.usage });
      if (!editorRef.current) return;
      const map = T.sanitize(result.map);
      if (!map) throw new Error('Die KI-Antwort war nicht brauchbar.');
      if (id !== currentId.current) return; // in der Zwischenzeit gewechselt
      mutate((s) => S.applyAiMap(s, map));
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
    }, setActionError);
  }

  function switchMap(summary: MapSummary) {
    if (summary.id === current?.id || busy) return;
    void runAi(() => openMap(summary), setActionError);
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
    setExporting('pdf'); setActionError(''); setNotice('');
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
    } catch (reason) { setActionError(errorText(reason)); }
    finally { setExporting(null); }
  }

  async function exportGoodnotes() {
    if (!scene || !editor || !current || exporting) return;
    setExporting('goodnotes'); setActionError(''); setNotice('');
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
      const strokes = goodnotesStrokes(scene);
      const base64 = await goodnotes.run({ draw: drawList(scene), ink, place: goodnotesPlacement(scene), strokes });
      await shareBytes(base64, `${S.exportBase(editor.root, current.day)}.goodnotes`, 'application/octet-stream');
      setNotice(strokes ? 'Handschrift als Stiftstriche. Jetzt in Goodnotes öffnen.' : 'Als Bild exportiert. Für Striche wähle die eigene Handschrift.');
    } catch (reason) { setActionError(errorText(reason)); }
    finally { setExporting(null); }
  }

  const exportBlocked = !scene || !!exporting;
  const canCreate = S.canCreateToday(status?.usage);
  const maps = list.map((entry) => ({ id: entry.id, label: S.mapOptionLabel(entry, status?.day) }));
  const canDelete = !today && !!status;
  // iPad quer: „Mindmap für heute erstellen.“ links, „Meine Mindmaps.“ rechts; ohne Erstellen steht die Liste in der Seitenleiste des Editors
  const libraryAbove = split && canCreate && showLibrary(maps, canDelete);
  const switchTo = (id: string) => { const entry = list.find((item) => item.id === id); if (entry) switchMap(entry); };

  const createPanel = (
    <Panel style={styles.panel}>
      <AppText variant="h4" accessibilityRole="header">Mindmap für heute erstellen.</AppText>
      <Field label="Thema" value={topic} onChangeText={(v) => { setTopic(v); setCreateError(''); }} maxLength={120} editable={!busy} autoCorrect={false} placeholder="z. B. Die Beatles" returnKeyType="done" />
      <Field label="Hinweise (optional)" value={notes} onChangeText={setNotes} maxLength={500} multiline editable={!busy} placeholder="z. B. für eine Klausur in Klasse 9, Schwerpunkt Entstehung und Einfluss" />
      {createError ? <FormMessage text={createError} /> : null}
      <Button title={busy ? 'KI arbeitet …' : 'Mindmap erstellen'} loading={busy} disabled={busy} onPress={create} />
      <AppText variant="bodySm" tone="muted">Du kannst pro Tag eine Mindmap erstellen. Sie lässt sich danach 3-mal von der KI verändern.</AppText>
    </Panel>
  );

  return (
    <Screen
      wide
      title="Mindmap-Generator."
      navigationTitle="Mindmap-Generator"
      description="Nenn ein Thema, die KI baut die Mindmap. Danach änderst du sie mit KI oder direkt im Editor, in Standardschrift oder in deiner eigenen Handschrift."
    >
      {goodnotes.element}
      {notice ? <Notice text={notice} /> : null}
      {statusError ? <FormMessage text={statusError} onDismiss={() => setAttempt((n) => n + 1)} /> : null}
      {listError ? <FormMessage text={`Deine Mindmaps konnten nicht geladen werden. ${listError}`} onDismiss={() => setAttempt((n) => n + 1)} /> : null}

      {status ? (
        <View style={styles.badges} accessibilityLiveRegion="polite">
          {S.usageBadges(status.usage).map((label) => <Badge key={label} label={label} />)}
        </View>
      ) : null}

      {canCreate ? (split ? (
        <TwoColumn
          split
          primaryWeight={MAP_COLUMN_WEIGHTS.primary}
          secondaryWeight={MAP_COLUMN_WEIGHTS.secondary}
          primary={<View style={{ maxWidth: soloPanelMaxWidth(split, libraryAbove), width: '100%' }}>{createPanel}</View>}
          secondary={libraryAbove ? (
            <MapLibrary maps={maps} currentId={current?.id ?? ''} canDelete={canDelete} busy={busy} switchMap={switchTo} removeMap={removeMap} panel />
          ) : undefined}
        />
      ) : createPanel) : null}

      {loading && !editor ? <LoadingState title="Mindmaps werden geladen" /> : null}

      {editor && current && scene && tools ? (
        <EditorView
          scene={scene}
          tools={tools}
          ink={ink}
          selectedId={editor.selectedId}
          fitKey={`${current.id}|${useHandFont ? 'hand' : 'std'}|${scale}`}
          canvasHeight={canvasHeight}
          split={split}
          libraryAbove={libraryAbove}
          bigText={bigText}
          canvasRef={canvas}
          maps={maps}
          currentId={current.id}
          canDelete={canDelete}
          busy={busy}
          hasHand={!!hand}
          useHandFont={useHandFont}
          saveText={S.saveStateText(saveStatus, true)}
          nodeText={nodeText}
          nodeInput={nodeInput}
          actionError={actionError}
          ai={{
            info: S.aiInfoText({ hasMap: true, today, usage: status?.usage }),
            label: S.aiButtonLabel({ busy, today, usage: status?.usage }),
            disabled: busy || !today || S.aiLeft(status?.usage) <= 0,
            editable: today && !busy && S.aiLeft(status?.usage) > 0,
            value: instruction,
            error: aiError,
          }}
          exporting={exporting}
          exportBlocked={exportBlocked}
          on={{
            switchMap: switchTo,
            removeMap,
            addChild: () => edit((s) => T.addChild(s.root, s.selectedId), focusText),
            addSibling: () => edit((s) => T.addSibling(s.root, s.selectedId), focusText),
            moveUp: () => edit((s) => T.move(s.root, s.selectedId, -1)),
            moveDown: () => edit((s) => T.move(s.root, s.selectedId, 1)),
            removeNode: () => edit((s) => T.remove(s.root, s.selectedId)),
            undo: () => mutate((s) => S.stepHistory(s, 'undo')),
            redo: () => mutate((s) => S.stepHistory(s, 'redo')),
            foldNode: () => mutate((s) => S.toggleFold(s, s.selectedId)),
            foldAll: () => mutate((s) => S.foldAll(s)),
            unfoldAll: () => mutate((s) => S.unfoldAll(s)),
            select,
            edit: () => nodeInput.current?.focus(),
            toggleFold: (id) => mutate((s) => S.toggleFold(s, id)),
            chooseFont,
            chooseInk,
            openHandTool: () => router.push('/tools/goodnotes'),
            nodeText: onNodeText,
            nodeFocus: () => { nodeFocused.current = true; },
            nodeBlur: onNodeBlur,
            clearActionError: () => setActionError(''),
            instruction: (text) => { setInstruction(text); setAiError(''); },
            refine,
            exportGoodnotes: () => void exportGoodnotes(),
            exportPdf: () => void exportPdf(),
            toGoodnotesTool: () => { putHandoff(T.formatTree(editor.root), editor.root.text); router.push('/tools/goodnotes'); },
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  panel: { gap: spacing.lg },
});
