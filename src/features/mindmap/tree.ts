/* Mindmap – Baum und Bearbeiten (rein, ohne React/Expo; läuft unter `npm test`).
 * Web-Quelle: tools/mindmap/tree.js (Abschnitt „Baum“), Web-Commit 1612dc2. Knoten: { id, text, children }.
 * Die Grenzen entsprechen denen der Function (functions/mindmap/lib.js). Alle Änderungen arbeiten auf einer Kopie
 * und liefern { root, selectId } oder { error }. */
export interface MindmapNode {
  id: string;
  text: string;
  children: MindmapNode[];
}

export const MAP = { nodes: 80, depth: 5, children: 10, text: 80 } as const;

let counter = 0;
export const newId = (): string => 'm' + Date.now().toString(36) + (counter++).toString(36) + Math.random().toString(36).slice(2, 5);

const cleanText = (value: unknown): string => String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, MAP.text);

/** Gespeicherte oder empfangene Daten in einen gültigen Baum verwandeln (oder null). */
export function sanitize(raw: unknown): MindmapNode | null {
  const seen = new Set<string>();
  let count = 0;
  const walk = (value: unknown, depth: number): MindmapNode | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || count >= MAP.nodes) return null;
    const record = value as Record<string, unknown>;
    const text = cleanText(record.text);
    if (!text) return null;
    count++;
    const given = record.id;
    const id = typeof given === 'string' && given && given.length <= 40 && !seen.has(given) ? given : newId();
    seen.add(id);
    const node: MindmapNode = { id, text, children: [] };
    if (depth < MAP.depth && Array.isArray(record.children)) {
      for (const child of record.children.slice(0, MAP.children)) {
        const kid = walk(child, depth + 1);
        if (kid) node.children.push(kid);
      }
    }
    return node;
  };
  return walk(raw, 0);
}

export function parse(json: string): MindmapNode | null {
  try { return sanitize(JSON.parse(json)); } catch { return null; }
}

export function clone(root: MindmapNode): MindmapNode {
  return { id: root.id, text: root.text, children: root.children.map(clone) };
}

export const countNodes = (node: MindmapNode): number => 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);

export interface NodeHit {
  node: MindmapNode;
  parent: MindmapNode | null;
  index: number;
  depth: number;
}

export function find(root: MindmapNode, id: string, parent: MindmapNode | null = null, index = 0, depth = 0): NodeHit | null {
  if (root.id === id) return { node: root, parent, index, depth };
  for (let i = 0; i < root.children.length; i++) {
    const hit = find(root.children[i]!, id, root, i, depth + 1);
    if (hit) return hit;
  }
  return null;
}

export type EditResult = { root: MindmapNode; selectId: string; error?: undefined } | { error: string | null; root?: undefined; selectId?: undefined };

export function addChild(root: MindmapNode, id: string, text = 'Neuer Punkt'): EditResult {
  const next = clone(root);
  const hit = find(next, id);
  if (!hit) return { error: 'Knoten nicht gefunden.' };
  if (countNodes(next) >= MAP.nodes) return { error: `Mehr als ${MAP.nodes} Knoten sind nicht möglich.` };
  if (hit.depth >= MAP.depth) return { error: `Tiefer als ${MAP.depth} Ebenen geht es nicht.` };
  if (hit.node.children.length >= MAP.children) return { error: `Ein Knoten kann höchstens ${MAP.children} Unterpunkte haben.` };
  const node: MindmapNode = { id: newId(), text, children: [] };
  hit.node.children.push(node);
  return { root: next, selectId: node.id };
}

export function addSibling(root: MindmapNode, id: string, text = 'Neuer Punkt'): EditResult {
  const next = clone(root);
  const hit = find(next, id);
  if (!hit) return { error: 'Knoten nicht gefunden.' };
  if (!hit.parent) return { error: 'Neben dem Thema in der Mitte gibt es keinen weiteren Knoten. Füge einen Unterpunkt hinzu.' };
  if (countNodes(next) >= MAP.nodes) return { error: `Mehr als ${MAP.nodes} Knoten sind nicht möglich.` };
  if (hit.parent.children.length >= MAP.children) return { error: `Ein Knoten kann höchstens ${MAP.children} Unterpunkte haben.` };
  const node: MindmapNode = { id: newId(), text, children: [] };
  hit.parent.children.splice(hit.index + 1, 0, node);
  return { root: next, selectId: node.id };
}

export function rename(root: MindmapNode, id: string, text: unknown): EditResult {
  const next = clone(root);
  const hit = find(next, id);
  if (!hit) return { error: 'Knoten nicht gefunden.' };
  const clean = cleanText(text);
  if (!clean && !hit.parent) return { error: 'Das Thema darf nicht leer sein.' };
  hit.node.text = String(text == null ? '' : text).slice(0, MAP.text); // beim Tippen Leerzeichen am Ende erlauben
  return { root: next, selectId: id };
}

export function remove(root: MindmapNode, id: string): EditResult {
  const next = clone(root);
  const hit = find(next, id);
  if (!hit) return { error: 'Knoten nicht gefunden.' };
  if (!hit.parent) return { error: 'Das Thema in der Mitte kann man nicht löschen.' };
  hit.parent.children.splice(hit.index, 1);
  const near = hit.parent.children[hit.index] ?? hit.parent.children[hit.index - 1] ?? hit.parent;
  return { root: next, selectId: near.id };
}

/** dir = -1 (nach oben) oder 1 (nach unten) unter den Geschwistern. Schon am Rand: { error: null } (nichts zu tun, kein Fehler). */
export function move(root: MindmapNode, id: string, dir: -1 | 1): EditResult {
  const next = clone(root);
  const hit = find(next, id);
  if (!hit || !hit.parent) return { error: 'Das Thema in der Mitte lässt sich nicht verschieben.' };
  const to = hit.index + dir;
  if (to < 0 || to >= hit.parent.children.length) return { error: null };
  const list = hit.parent.children;
  [list[hit.index], list[to]] = [list[to]!, list[hit.index]!];
  return { root: next, selectId: id };
}

/** Alle Vorfahren eines Knotens (ohne ihn selbst), vom Thema abwärts. */
export function ancestors(root: MindmapNode, id: string): string[] {
  const path: string[] = [];
  const walk = (node: MindmapNode): boolean => {
    if (node.id === id) return true;
    for (const child of node.children) if (walk(child)) { path.unshift(node.id); return true; }
    return false;
  };
  return walk(root) ? path : [];
}

/** Bei großen Mindmaps starten die Äste ab der dritten Ebene eingeklappt, damit man den Überblick behält. */
export function autoCollapse(root: MindmapNode, limit = 45): Set<string> {
  const set = new Set<string>();
  if (countNodes(root) <= limit) return set;
  const walk = (node: MindmapNode, depth: number) => {
    if (depth === 2 && node.children.length) set.add(node.id);
    else node.children.forEach((child) => walk(child, depth + 1));
  };
  walk(root, 0);
  return set;
}

/** Alle Knoten mit Unterpunkten ab Ebene `fromDepth` (für „Alles einklappen“). */
export function branchIds(root: MindmapNode, fromDepth = 1): string[] {
  const out: string[] = [];
  const walk = (node: MindmapNode, depth: number) => {
    if (depth >= fromDepth && node.children.length) out.push(node.id);
    node.children.forEach((child) => walk(child, depth + 1));
  };
  walk(root, 0);
  return out;
}

/** Eingerückte Textfassung (für „In Goodnotes-Tool übernehmen“). */
export function formatTree(root: MindmapNode, level = 0): string {
  return ['  '.repeat(level) + (level ? '• ' : '') + root.text, ...root.children.map((node) => formatTree(node, level + 1))].join('\n');
}

/* ---- Namen aus der ersten App-Fassung ---- */
export const normalizeMindmap = sanitize;
export const findNode = find;

/** Wie addChild/addSibling, aber mit Ausnahme statt Fehlerwert (Form der ersten App-Fassung, von tests/function-contract.test.ts genutzt). */
export function appendNode(root: MindmapNode, target: NodeHit, asSibling: boolean): { root: MindmapNode; node: MindmapNode } {
  const result = asSibling ? addSibling(root, target.node.id) : addChild(root, target.node.id);
  const hit = result.root ? find(result.root, result.selectId) : null;
  if (!result.root || !hit) throw new Error('An dieser Stelle ist kein weiterer Knoten möglich.');
  return { root: result.root, node: hit.node };
}
