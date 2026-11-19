import assert from 'node:assert/strict';
import test from 'node:test';
import { appendNode, countNodes, findNode, formatTree, normalizeMindmap } from '../src/features/mindmap/tree';

test('Mindmap aus einer Web-Zeile öffnen, fehlende IDs ersetzen und Äste unverändert übernehmen', () => {
  const root = normalizeMindmap({ id: 'root', text: '  Mathe  ', children: [
    { id: 'topic', text: 'Geometrie', children: [{ id: 'topic', text: 'Dreieck' }] },
    { id: 'empty', text: '  ' },
  ] });
  assert.ok(root);
  assert.equal(root.id, 'root');
  assert.equal(countNodes(root), 3);
  const child = findNode(root, 'topic');
  assert.ok(child);
  assert.equal(child.depth, 1);
  assert.notEqual(child.node.children[0]?.id, 'topic');
  assert.equal(formatTree(root), 'Mathe\n  • Geometrie\n    • Dreieck');

  const updated = appendNode(root, child, true);
  assert.equal(countNodes(updated.root), 4);
  assert.equal(countNodes(root), 3);
  assert.equal(updated.root.children[1]?.id, updated.node.id);
});

test('Mindmap übernimmt die Tiefen- und Astgrenzen der Function', () => {
  let branch = { text: 'Ende', children: [] as unknown[] };
  for (let level = 6; level > 0; level--) {
    branch = { text: String(level), children: [branch] };
  }
  const root = normalizeMindmap({ text: 'Start', children: [branch, ...Array.from({ length: 15 }, () => ({ text: 'Ast' }))] });
  assert.ok(root);
  assert.equal(root.children.length, 10);
  assert.equal(formatTree(root).includes('Ende'), false);
  const target = findNode(root, root.id);
  assert.ok(target);
  assert.throws(() => appendNode(root, target, false), /kein weiterer Knoten/);
});
