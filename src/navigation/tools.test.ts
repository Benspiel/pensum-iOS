import assert from 'node:assert/strict';
import test from 'node:test';

import { noToolAccess } from '../contracts';
import { getTool, getToolAvailability, tools } from './tools';

test('the native catalog preserves the relative Web order for the iOS scope', () => {
  assert.deepEqual(tools.map(({ id }) => id), [
    'goodnotes', 'mindmap', 'kichat', 'aufgaben', 'abschreiben', 'karteikarten',
    'planer', 'videos', 'admin', 'notenrechner',
  ]);
  assert.equal(getTool('unbekannt'), undefined);
  assert.equal(getTool('spiele'), undefined);
  for (const id of ['mindmap', 'kichat', 'aufgaben', 'abschreiben', 'videos']) {
    assert.equal(getToolAvailability(getTool(id)!), 'hidden');
  }
});

test('guests can see public tools, see locked Tester previews and cannot see team tools', () => {
  for (const id of ['notenrechner', 'planer', 'karteikarten', 'goodnotes']) {
    assert.equal(getToolAvailability(getTool(id)!), 'available');
  }
  for (const id of ['admin']) {
    assert.equal(getToolAvailability(getTool(id)!), 'hidden');
  }
});

test('disabled AI tools stay hidden while Admin keeps its own access', () => {
  const tasks = getTool('aufgaben')!;
  const chat = getTool('kichat')!;
  const team = getTool('admin')!;

  assert.equal(getToolAvailability(tasks, { ...noToolAccess, tester: true }), 'hidden');
  assert.equal(getToolAvailability(chat, { ...noToolAccess, tester: true }), 'hidden');
  assert.equal(getToolAvailability(team, { ...noToolAccess, tester: true }), 'hidden');
  assert.equal(getToolAvailability(chat, { ...noToolAccess, kiTester: true }), 'hidden');
  assert.equal(getToolAvailability(team, { ...noToolAccess, kiTester: true }), 'hidden');
  assert.equal(getToolAvailability(team, { ...noToolAccess, admin: true }), 'available');
  assert.equal(getToolAvailability(chat, { ...noToolAccess, admin: true }), 'hidden');
});
