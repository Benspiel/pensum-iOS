// Pensum tools/mindmap/tree.js @ 770dbe4, adapted to a typed immutable native tree.
export interface MindmapNode {
  id: string;
  text: string;
  children: MindmapNode[];
}

const limits = { nodes: 80, depth: 5, children: 10, text: 80 };
let sequence = 0;

function newNodeId() {
  return 'm' + Date.now().toString(36) + (sequence++).toString(36) + Math.random().toString(36).slice(2, 5);
}

export function normalizeMindmap(raw: unknown): MindmapNode | null {
  const ids = new Set<string>();
  function read(value: unknown, depth: number): MindmapNode | null {
    if (!value || typeof value !== 'object' || ids.size >= limits.nodes || !('text' in value)) return null;
    const text = typeof value.text === 'string' ? value.text.replace(/\s+/g, ' ').trim().slice(0, limits.text) : '';
    if (!text) return null;
    const id = 'id' in value && typeof value.id === 'string' && value.id.length > 0 &&
      value.id.length <= 40 && !ids.has(value.id) ? value.id : newNodeId();
    ids.add(id);
    const children: MindmapNode[] = [];
    if (depth < limits.depth && 'children' in value && Array.isArray(value.children)) {
      for (const item of value.children.slice(0, limits.children)) {
        const child = read(item, depth + 1);
        if (child) children.push(child);
      }
    }
    return { id, text, children };
  }
  return read(raw, 0);
}

type NodePosition = { node: MindmapNode; depth: number; parent: MindmapNode | null; index: number };

export function findNode(root: MindmapNode, id: string, depth = 0, parent: MindmapNode | null = null, index = 0): NodePosition | null {
  if (root.id === id) return { node: root, depth, parent, index };
  for (const [position, child] of root.children.entries()) {
    const hit = findNode(child, id, depth + 1, root, position);
    if (hit) return hit;
  }
  return null;
}

export function countNodes(root: MindmapNode): number {
  return 1 + root.children.reduce((sum, node) => sum + countNodes(node), 0);
}

export function updateNode(root: MindmapNode, id: string, update: (node: MindmapNode) => MindmapNode): MindmapNode {
  if (root.id === id) return update(root);
  return { ...root, children: root.children.map((node) => updateNode(node, id, update)) };
}

export function appendNode(root: MindmapNode, target: NodePosition, asSibling: boolean) {
  const container = asSibling ? target.parent : target.node;
  const depth = asSibling ? target.depth : target.depth + 1;
  if (!container || depth > limits.depth || container.children.length >= limits.children || countNodes(root) >= limits.nodes) {
    throw new Error('An dieser Stelle ist kein weiterer Knoten möglich.');
  }
  const node = { id: newNodeId(), text: 'Neuer Punkt', children: [] };
  const position = asSibling ? target.index + 1 : container.children.length;
  return {
    node,
    root: updateNode(root, container.id, (parent) => ({
      ...parent,
      children: [...parent.children.slice(0, position), node, ...parent.children.slice(position)],
    })),
  };
}

export function formatTree(root: MindmapNode, level = 0): string {
  return ['  '.repeat(level) + (level ? '• ' : '') + root.text, ...root.children.map((node) => formatTree(node, level + 1))].join('\n');
}
