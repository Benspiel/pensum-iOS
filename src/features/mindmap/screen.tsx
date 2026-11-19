import { usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Models } from 'react-native-appwrite';
import { databaseId, executeFunction, functionIds, listAllRows, Query, tableIds, tablesDB } from '../../backend';
import { useAccountGuard } from '../appwrite-tools/account-scope';
import { AppText, Button, Card, EmptyState, ErrorState, Field, LoadingState, Screen } from '../../ui';
import { confirmAction, consentToGemini, errorText, useToolAction } from '../appwrite-tools/actions';
import { escapeHtml, sharePdf } from '../appwrite-tools/export';
import { putHandoff } from '../shared/handoff';
import { appendNode, findNode, formatTree, normalizeMindmap, updateNode, type MindmapNode } from './tree';

type MindmapRow = Models.Row & { topic: string; day: string; data: string };
type MapSummary = Pick<MindmapRow, '$id' | 'topic' | 'day'>;
type Usage = { created: number; maxCreated: number; edits: number; maxEdits: number };
type Status = { day: string; usage: Usage };
type MapResult = Status & { id: string; topic: string; map: unknown };
type OpenMap = { summary: MapSummary; original: MindmapNode; root: MindmapNode; past: MindmapNode[]; future: MindmapNode[] };

function checkedTree(raw: unknown) {
  const parsed = normalizeMindmap(raw);
  if (!parsed) throw new Error('Die Mindmap ist beschädigt.');
  return parsed;
}

function Tree({ node, selectedId, onSelect, depth = 0 }: {
  node: MindmapNode; selectedId: string; onSelect: (node: MindmapNode) => void; depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <View style={styles.branch}>
      <View style={styles.nodeRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: node.id === selectedId }}
          accessibilityLabel={depth ? node.text : `Thema, ${node.text}`}
          onPress={() => onSelect(node)}
          style={styles.node}
        >
          <AppText variant={depth ? 'body' : 'section'} tone={node.id === selectedId ? 'accent' : 'default'}>{node.text}</AppText>
        </Pressable>
        {node.children.length > 0 && (
          <Button title={expanded ? 'Einklappen' : 'Ausklappen'} variant="plain" onPress={() => setExpanded(!expanded)} />
        )}
      </View>
      {expanded && node.children.length > 0 && (
        <View style={styles.children}>
          {node.children.map((child) => <Tree key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />)}
        </View>
      )}
    </View>
  );
}

export function MindmapScreen({ userId }: { userId: string }) {
  const router = useRouter();
  const action = useToolAction();
  const requireAccount = useAccountGuard();
  const [list, setList] = useState<MapSummary[]>([]);
  const [current, setCurrent] = useState<OpenMap>();
  const [selectedId, setSelectedId] = useState('');
  const [nodeText, setNodeText] = useState('');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [instruction, setInstruction] = useState('');
  const [status, setStatus] = useState<Status>();
  const [statusError, setStatusError] = useState('');
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(true);
  const [listAttempt, setListAttempt] = useState(0);
  const [statusAttempt, setStatusAttempt] = useState(0);
  const selection = current ? findNode(current.root, selectedId) : null;
  const dirty = Boolean(current && current.original !== current.root);
  usePreventRemove(dirty, ({ repeat }) => {
    void confirmAction('Änderungen verwerfen?', 'Die offenen Änderungen an dieser Mindmap gehen verloren.', 'Verwerfen', true)
      .then((ok) => { if (ok) repeat(); });
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    listAllRows<MindmapRow>(tableIds.mindmaps, [
      Query.equal('userId', userId), Query.orderDesc('$createdAt'), Query.select(['$id', 'topic', 'day']),
    ], requireAccount).then((rows) => {
      if (active) { setList(rows); setListError(''); }
    }).catch((reason: unknown) => {
      if (active) setListError(errorText(reason));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [listAttempt, requireAccount, userId]);

  useEffect(() => {
    let active = true;
    executeFunction<Status>(functionIds.mindmap, { action: 'status' })
      .then((value) => { if (active) { setStatus(value); setStatusError(''); } })
      .catch((reason: unknown) => { if (active) setStatusError(errorText(reason)); });
    return () => { active = false; };
  }, [statusAttempt]);

  function select(node: MindmapNode) {
    setSelectedId(node.id);
    setNodeText(node.text);
  }

  function open(summary: MapSummary, root: MindmapNode) {
    setCurrent({ summary, original: root, root, past: [], future: [] });
    select(root);
  }

  async function discardIfNeeded() {
    return !dirty || await confirmAction('Änderungen verwerfen?', 'Die offenen Änderungen an dieser Mindmap gehen verloren.', 'Verwerfen', true);
  }

  function selectMap(summary: MapSummary) {
    void action.run(async () => {
      if (summary.$id === current?.summary.$id || !await discardIfNeeded()) return;
      requireAccount();
      const row = await tablesDB.getRow<MindmapRow>({ databaseId, tableId: tableIds.mindmaps, rowId: summary.$id });
      open(summary, checkedTree(JSON.parse(row.data)));
    });
  }

  function changeRoot(root: MindmapNode, selected: MindmapNode) {
    setCurrent((value) => value ? { ...value, root, past: [...value.past, value.root].slice(-40), future: [] } : value);
    select(selected);
  }

  function create() {
    if (!topic.trim()) return;
    void action.run(async () => {
      if (!await discardIfNeeded() || !await consentToGemini('Dein Thema mit Notizen')) return;
      try {
        requireAccount();
        const result = await executeFunction<MapResult>(functionIds.mindmap, { action: 'create', topic: topic.trim(), notes: notes.trim() });
        const summary = { $id: result.id, topic: result.topic, day: result.day };
        open(summary, checkedTree(result.map));
        setList((value) => [summary, ...value.filter((entry) => entry.$id !== summary.$id)]);
        setTopic('');
        setNotes('');
        setStatus(result);
      } catch (reason) {
        setStatusAttempt((attempt) => attempt + 1);
        throw reason;
      }
    });
  }

  function refine() {
    if (!current || !instruction.trim()) return;
    void action.run(async () => {
      if (!await consentToGemini('Deine Mindmap und die Änderungsanweisung')) return;
      try {
        requireAccount();
        const result = await executeFunction<Status & { map: unknown }>(functionIds.mindmap, {
          action: 'refine', instruction: instruction.trim(), map: current.root,
        });
        const root = { ...checkedTree(result.map), text: current.root.text };
        changeRoot(root, root);
        setInstruction('');
        setStatus(result);
      } catch (reason) {
        setStatusAttempt((attempt) => attempt + 1);
        throw reason;
      }
    });
  }

  function save() {
    if (!current || !dirty) return;
    void action.run(async () => {
      const summary = { ...current.summary, topic: current.root.text };
      requireAccount();
      await tablesDB.updateRow({ databaseId, tableId: tableIds.mindmaps, rowId: summary.$id, data: { data: JSON.stringify(current.root), topic: summary.topic } });
      setCurrent({ ...current, summary, original: current.root });
      setList((value) => value.map((entry) => entry.$id === summary.$id ? summary : entry));
    });
  }

  function removeMap() {
    if (!current || !status || current.summary.day === status.day) return;
    void action.run(async () => {
      if (!await confirmAction('Mindmap löschen?', `„${current.summary.topic}“ wird aus deinem Konto gelöscht.`, 'Löschen', true)) return;
      requireAccount();
      await tablesDB.deleteRow({ databaseId, tableId: tableIds.mindmaps, rowId: current.summary.$id });
      setList((value) => value.filter((entry) => entry.$id !== current.summary.$id));
      setCurrent(undefined);
    });
  }

  function add(asSibling: boolean) {
    if (!current || !selection) return;
    try {
      const { root, node } = appendNode(current.root, selection, asSibling);
      changeRoot(root, node);
      action.setError('');
    } catch (reason) {
      action.setError(errorText(reason));
    }
  }

  function rename() {
    if (!current || !selection || !nodeText.trim()) return;
    const node = { ...selection.node, text: nodeText.trim().replace(/\s+/g, ' ') };
    changeRoot(updateNode(current.root, node.id, () => node), node);
  }

  function relocate(direction: -1 | 1 | 0) {
    if (!current || !selection?.parent) return;
    const { parent, index, node } = selection;
    const position = index + direction;
    if (position < 0 || position >= parent.children.length) return;
    const children = parent.children.filter((child) => child.id !== node.id);
    if (direction) children.splice(position, 0, node);
    changeRoot(updateNode(current.root, parent.id, () => ({ ...parent, children })), direction ? node : parent);
  }

  function history(redo: boolean) {
    if (!current) return;
    const root = redo ? current.future[0] : current.past.at(-1);
    if (!root) return;
    setCurrent({
      ...current, root,
      past: redo ? [...current.past, current.root] : current.past.slice(0, -1),
      future: redo ? current.future.slice(1) : [current.root, ...current.future],
    });
    select(root);
  }

  return (
    <Screen title="Mindmap-Generator" description="Sammle Ideen zu einem Thema und bearbeite die Mindmap in deinem Konto.">
      {status && <AppText tone="muted">Heute · {status.usage.created}/{status.usage.maxCreated} Mindmaps · {status.usage.edits}/{status.usage.maxEdits} KI-Änderungen</AppText>}
      {statusError !== '' && <ErrorState message={statusError} onRetry={() => setStatusAttempt((value) => value + 1)} />}
      {action.error !== '' && <ErrorState message={action.error} />}
      <Card>
        <AppText variant="section">Neue Mindmap</AppText>
        <Field label="Thema" value={topic} onChangeText={setTopic} maxLength={120} editable={!action.busy} />
        <Field label="Notizen (optional)" value={notes} onChangeText={setNotes} maxLength={500} multiline editable={!action.busy} />
        <Button title="Mindmap erstellen" onPress={create} disabled={action.busy || !topic.trim() || Boolean(status && status.usage.created >= status.usage.maxCreated)} />
      </Card>
      <Card>
        <AppText variant="section">Deine Mindmaps</AppText>
        {loading && <LoadingState title="Mindmaps werden geladen" />}
        {listError !== '' && <ErrorState message={listError} onRetry={() => setListAttempt((value) => value + 1)} />}
        {!loading && listError === '' && list.length === 0 && <EmptyState title="Noch keine Mindmap" />}
        {list.map((entry) => (
          <Button key={entry.$id} title={`${entry.topic} · ${entry.day}`} variant={entry.$id === current?.summary.$id ? 'primary' : 'secondary'} disabled={action.busy} onPress={() => selectMap(entry)} />
        ))}
      </Card>
      {current && (
        <>
          <Card>
            <Tree key={current.summary.$id} node={current.root} selectedId={selectedId} onSelect={select} />
            <Field label="Knotentext" value={nodeText} onChangeText={setNodeText} maxLength={80} editable={!action.busy} />
            <View style={styles.actions}>
              <Button title="Text übernehmen" variant="secondary" disabled={action.busy || !selection || !nodeText.trim()} onPress={rename} />
              <Button title="Unterpunkt" variant="secondary" disabled={action.busy || !selection} onPress={() => add(false)} />
              <Button title="Nebenpunkt" variant="secondary" disabled={action.busy || !selection?.parent} onPress={() => add(true)} />
              <Button title="Hoch" variant="plain" disabled={action.busy || !selection?.parent || selection.index === 0} onPress={() => relocate(-1)} />
              <Button title="Runter" variant="plain" disabled={action.busy || !selection?.parent || selection.index === selection.parent.children.length - 1} onPress={() => relocate(1)} />
              <Button title="Knoten entfernen" variant="plain" disabled={action.busy || !selection?.parent} onPress={() => relocate(0)} />
              <Button title="Rückgängig" variant="plain" disabled={action.busy || !current.past.length} onPress={() => history(false)} />
              <Button title="Wiederholen" variant="plain" disabled={action.busy || !current.future.length} onPress={() => history(true)} />
            </View>
            <Button title={dirty ? 'Mindmap speichern' : 'Gespeichert'} onPress={save} disabled={action.busy || !dirty} />
          </Card>
          {status && current.summary.day === status.day && (
            <Card>
              <Field label="Mit KI ändern" value={instruction} onChangeText={setInstruction} multiline maxLength={500} editable={!action.busy} />
              <Button title="KI-Änderung anwenden" variant="secondary" onPress={refine} disabled={action.busy || !instruction.trim() || status.usage.edits >= status.usage.maxEdits} />
            </Card>
          )}
          <Card>
            <Button title="Als PDF teilen" variant="secondary" disabled={action.busy} onPress={() => void action.run(async () => {
              await sharePdf(`<!doctype html><meta charset="utf-8"><pre style="white-space:pre-wrap;font:16px/1.5 system-ui">${escapeHtml(formatTree(current.root))}</pre>`, 'Mindmap teilen');
            })} />
            <Button title="In Goodnotes-Tool übernehmen" variant="secondary" disabled={action.busy} onPress={() => {
              putHandoff(formatTree(current.root), current.root.text);
              router.push('/tools/goodnotes');
            }} />
            {status && current.summary.day !== status.day && <Button title="Mindmap löschen" variant="danger" disabled={action.busy} onPress={removeMap} />}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  branch: { gap: 3 },
  nodeRow: { flexDirection: 'row', alignItems: 'center' },
  node: { minHeight: 44, justifyContent: 'center', flex: 1 },
  children: { paddingLeft: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
