/* Mindmap – Zustandslogik des Editors (rein, ohne React/Expo): Auswahl, Ändern mit Rückgängig/Wiederholen (Zusammenfassen schneller
 * Tipp-Änderungen), Ein-/Ausklappen, verzögertes Speichern, Zoom und Anzeigetexte. Web-Quelle: tools/mindmap/mindmap.js
 * (applyChange, stepHistory, reveal, select, toggleFold, foldAll, saveSoon/flushSave, fitZoom, setZoom, renderPanels), Web-Commit 1612dc2. */
import * as T from './tree';

/* ---------- Editor-Zustand ---------- */

export const HISTORY_MAX = 60;
export const COALESCE_MS = 1500;

export interface EditorState {
  root: T.MindmapNode;
  selectedId: string;
  /** Rückgängig-Schritte als JSON (neueste zuletzt). */
  past: string[];
  future: string[];
  /** Eingeklappte Knoten: nur Ansicht, wird nicht gespeichert. */
  collapsed: ReadonlySet<string>;
  coalesceKey: string | null;
  coalesceAt: number;
  /** Meldung des letzten Bearbeitens ('' = keine). */
  error: string;
}

export function openEditor(root: T.MindmapNode): EditorState {
  return { root, selectedId: root.id, past: [], future: [], collapsed: T.autoCollapse(root), coalesceKey: null, coalesceAt: 0, error: '' };
}

/** Klappt alle Vorfahren eines Knotens auf, damit er sichtbar ist. */
export function reveal(collapsed: ReadonlySet<string>, root: T.MindmapNode, id: string): ReadonlySet<string> {
  if (!collapsed.size) return collapsed;
  const next = new Set(collapsed);
  for (const ancestor of T.ancestors(root, id)) next.delete(ancestor);
  return next;
}

export interface ChangeOptions {
  /** Gleiche Schlüssel kurz nacheinander ergeben nur einen Rückgängig-Schritt. */
  coalesce?: string | null;
  select?: boolean;
  now?: number;
}

/** Wendet das Ergebnis einer Baum-Änderung an. `changed` ist false bei Fehlern und bei „nichts zu tun“. */
export function applyChange(state: EditorState, result: T.EditResult, options: ChangeOptions = {}): { state: EditorState; changed: boolean } {
  if (result.error !== undefined) return { state: { ...state, error: result.error ?? '' }, changed: false };
  if (!result.root) return { state, changed: false };
  const { coalesce = null, select = true, now = Date.now() } = options;
  const merge = coalesce !== null && state.coalesceKey === coalesce && now - state.coalesceAt < COALESCE_MS;
  let past = state.past;
  if (!merge) past = [...past, JSON.stringify(state.root)].slice(-HISTORY_MAX);
  let selectedId = state.selectedId, collapsed = state.collapsed;
  if (select) {
    selectedId = result.selectId || state.selectedId;
    collapsed = reveal(collapsed, result.root, selectedId);
  }
  return { state: { ...state, root: result.root, selectedId, collapsed, past, future: [], coalesceKey: coalesce, coalesceAt: now, error: '' }, changed: true };
}

/** Ein Schritt zurück („undo“) oder vor („redo“). Die Auswahl springt aufs Thema, wenn der Knoten nicht mehr existiert. */
export function stepHistory(state: EditorState, direction: 'undo' | 'redo'): EditorState {
  const from = direction === 'undo' ? state.past : state.future;
  const last = from[from.length - 1];
  if (last === undefined) return state;
  const here = JSON.stringify(state.root);
  const root = T.parse(last) ?? state.root;
  const rest = from.slice(0, -1);
  return {
    ...state,
    root,
    selectedId: T.find(root, state.selectedId) ? state.selectedId : root.id,
    past: direction === 'undo' ? rest : [...state.past, here].slice(-HISTORY_MAX),
    future: direction === 'undo' ? [...state.future, here] : rest,
    coalesceKey: null,
    coalesceAt: 0,
    error: '',
  };
}

export function selectNode(state: EditorState, id: string): EditorState {
  if (!T.find(state.root, id)) return state;
  return { ...state, selectedId: id, collapsed: reveal(state.collapsed, state.root, id) };
}

export function toggleFold(state: EditorState, id: string): EditorState {
  const hit = T.find(state.root, id);
  if (!hit || !hit.parent || !hit.node.children.length) return state;
  const collapsed = new Set(state.collapsed);
  let selectedId = state.selectedId;
  if (collapsed.has(id)) collapsed.delete(id);
  else {
    collapsed.add(id);
    // liegt die Auswahl im eingeklappten Ast, wandert sie auf den Ast selbst
    if (selectedId !== id && T.find(hit.node, selectedId)) selectedId = id;
  }
  return { ...state, collapsed, selectedId };
}

export const foldAll = (state: EditorState): EditorState => ({ ...state, collapsed: new Set(T.branchIds(state.root)), selectedId: state.root.id });
export const unfoldAll = (state: EditorState): EditorState => (state.collapsed.size ? { ...state, collapsed: new Set() } : state);

/** Ersetzt den Baum durch das Ergebnis der KI; das Thema bleibt, wie der Nutzer es genannt hat. */
export function applyAiMap(state: EditorState, map: T.MindmapNode, now?: number): { state: EditorState; changed: boolean } {
  const root = { ...map, text: state.root.text || map.text };
  return applyChange(state, { root, selectId: root.id }, { now });
}

export interface ToolState {
  hasSelection: boolean;
  canAddChild: boolean;
  canAddSibling: boolean;
  canRemove: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canFoldNode: boolean;
  folded: boolean;
  canFoldAll: boolean;
  canUnfoldAll: boolean;
}

/** Welche Werkzeuge sind gerade möglich? (Web: renderTools) */
export function toolState(state: EditorState): ToolState {
  const sel = T.find(state.root, state.selectedId);
  const has = !!sel;
  return {
    hasSelection: has,
    canAddChild: has,
    canAddSibling: has && !!sel.parent,
    canRemove: has && !!sel.parent,
    canMoveUp: has && !!sel.parent && sel.index > 0,
    canMoveDown: has && !!sel.parent && sel.index < sel.parent.children.length - 1,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    canFoldNode: has && !!sel.parent && sel.node.children.length > 0,
    folded: has && state.collapsed.has(state.selectedId),
    canFoldAll: T.branchIds(state.root).length > 0,
    canUnfoldAll: state.collapsed.size > 0,
  };
}

/* ---------- Speichern: verzögert, mit Wiederholung (Web: saveSoon / flushSave) ---------- */

export const SAVE_DELAY_MS = 700;
export const SAVE_RETRY_MS = 5000;
export type SaveStatus = 'saved' | 'saving' | 'error';
export interface SaveTimers { set(fn: () => void, ms: number): unknown; clear(handle: unknown): void }

export interface Saver {
  /** Merkt den neuesten Stand einer Mindmap und speichert nach kurzer Ruhe. */
  schedule(id: string, root: T.MindmapNode): void;
  /** Sofort speichern und auf einen laufenden Speichervorgang warten. Gibt true zurück, wenn nichts mehr offen ist. */
  flush(): Promise<boolean>;
  /** Offenes für diese Mindmap verwerfen (z. B. nach dem Löschen). */
  drop(id: string): void;
  dispose(): void;
  readonly status: SaveStatus;
}

export function createSaver(o: {
  save(id: string, root: T.MindmapNode): Promise<void>;
  onStatus?(status: SaveStatus): void;
  timers?: SaveTimers;
}): Saver {
  const timers: SaveTimers = o.timers ?? { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };
  let pending: { id: string; root: T.MindmapNode } | null = null;
  let timer: unknown = null;
  let running: Promise<void> | null = null;
  let failed = false;
  let disposed = false;
  let last: SaveStatus = 'saved';

  const status = (): SaveStatus => (failed ? 'error' : pending || running ? 'saving' : 'saved');
  const notify = () => { const next = status(); if (next !== last) { last = next; o.onStatus?.(next); } };
  const clearTimer = () => { if (timer !== null) { timers.clear(timer); timer = null; } };
  const arm = (ms: number) => { clearTimer(); timer = timers.set(() => { timer = null; void flush(); }, ms); };

  async function runOnce(): Promise<void> {
    const job = pending;
    if (!job) return;
    pending = null;
    notify();
    try {
      await o.save(job.id, job.root);
      failed = false;
    } catch {
      failed = true;
      if (!pending) pending = job; // neuere Änderungen haben Vorrang vor dem fehlgeschlagenen Stand
      if (!disposed) arm(SAVE_RETRY_MS);
    }
  }

  async function flush(): Promise<boolean> {
    clearTimer();
    for (;;) {
      if (running) { await running; continue; }
      if (!pending) break;
      if (failed && disposed) break;
      running = runOnce().finally(() => { running = null; notify(); });
      await running;
      if (failed) break; // erneuter Versuch läuft über den Timer
    }
    notify();
    return !pending && !running && !failed;
  }

  return {
    schedule(id, root) {
      if (disposed) return;
      pending = { id, root };
      arm(SAVE_DELAY_MS);
      notify();
    },
    flush,
    drop(id) {
      if (pending?.id === id) { pending = null; clearTimer(); failed = false; }
      notify();
    },
    dispose() { disposed = true; clearTimer(); },
    get status() { return status(); },
  };
}

export const saveStateText = (status: SaveStatus, hasMap: boolean): string =>
  status === 'error' ? 'Speichern fehlgeschlagen. Wird erneut versucht.' : status === 'saving' ? 'Speichert …' : hasMap ? 'Gespeichert' : '';

/* ---------- Zoom (Web: setZoom, fitZoom) ---------- */

export const ZOOM = { min: 0.25, max: 2.5, step: 0.15, floorFit: 0.55 } as const;
export const clampZoom = (z: number): number => Math.min(ZOOM.max, Math.max(ZOOM.min, z));
export const stepZoom = (z: number, dir: 1 | -1): number => clampZoom(z + dir * ZOOM.step);

/** Passt in die Breite; in der Höhe wird nicht unter 55 % verkleinert (lieber senkrecht scrollen als unleserlich klein). */
export function fitZoom(mapW: number, mapH: number, viewW: number, viewH: number): number {
  const fitW = (viewW - 4) / mapW, fitH = (viewH - 4) / mapH;
  const z = Math.min(1, fitW, Math.max(fitH, ZOOM.floorFit));
  return Math.max(ZOOM.min, Math.floor(z * 20) / 20);
}

/* ---------- Texte (Web: renderUsage, renderPicker, renderPanels) ---------- */

export interface Usage { created: number; maxCreated: number; edits: number; maxEdits: number }

export const aiLeft = (usage: Usage | undefined): number => (usage ? usage.maxEdits - usage.edits : 0);
export const canCreateToday = (usage: Usage | undefined): boolean => !!usage && usage.created < usage.maxCreated;

export function dayLabel(day: string): string {
  const [y, m, d] = String(day).split('-');
  return y ? `${d}.${m}.${y}` : String(day);
}

export const mapOptionLabel = (m: { day: string; topic: string }, today: string | undefined): string =>
  `${m.day === today ? 'Heute' : dayLabel(m.day)} · ${m.topic || 'Mindmap'}`;

export function usageBadges(usage: Usage): string[] {
  return [`Mindmap heute: ${usage.created} von ${usage.maxCreated}`, `KI-Änderungen heute: ${usage.edits} von ${usage.maxEdits}`];
}

export function aiInfoText(o: { hasMap: boolean; today: boolean; usage?: Usage }): string {
  if (!o.hasMap) return '';
  const left = aiLeft(o.usage);
  if (!o.today) return 'KI-Änderungen gibt es nur für die Mindmap von heute. Diese hier kannst du von Hand bearbeiten.';
  if (left <= 0) return 'Du hast heute alle KI-Änderungen verbraucht. Morgen sind es wieder 3. Von Hand kannst du weiter ändern.';
  return `Beschreib in eigenen Worten, was geändert werden soll. Heute sind noch ${left} von ${o.usage?.maxEdits ?? 0} Änderungen frei.`;
}

export const aiButtonLabel = (o: { busy: boolean; today: boolean; usage?: Usage }): string =>
  o.busy ? 'KI arbeitet …' : o.today ? `Mit KI ändern (${Math.max(aiLeft(o.usage), 0)} übrig)` : 'Mit KI ändern';

/** Speichername der Zeile (Thema auf 120 Zeichen gekürzt, Web: flushSave). */
export const topicOf = (root: T.MindmapNode): string => root.text.trim().slice(0, 120) || 'Mindmap';

/** Dateiname des Exports (Web: fileBase, stamp). */
export const exportBase = (root: T.MindmapNode, day: string): string =>
  `${(root.text || 'Mindmap').trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'Mindmap'} ${day}`;
