import assert from 'node:assert/strict';
import test from 'node:test';
import { splitMessage } from '../message-parts';

test('a lösung block becomes its own window between the surrounding text', () => {
  const parts = splitMessage('Hier ist der Weg.\n```lösung\nx = 4\n```\nFertig.');
  assert.deepEqual(parts, [
    { kind: 'text', text: 'Hier ist der Weg.' },
    { kind: 'solution', text: 'x = 4' },
    { kind: 'text', text: 'Fertig.' },
  ]);
});

test('other code blocks stay text without fence lines', () => {
  assert.deepEqual(splitMessage('```js\nlet a = 1;\n```'), [{ kind: 'text', text: 'let a = 1;' }]);
});

test('loesung spelling and empty blocks are handled', () => {
  assert.deepEqual(splitMessage('```Loesung\n42\n```'), [{ kind: 'solution', text: '42' }]);
  assert.deepEqual(splitMessage('```lösung\n\n```'), []);
});
