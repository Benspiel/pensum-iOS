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
});

test('guests can see public tools, see locked Tester previews and cannot see team tools', () => {
  for (const id of ['notenrechner', 'planer', 'karteikarten', 'goodnotes', 'abschreiben', 'mindmap']) {
    assert.equal(getToolAvailability(getTool(id)!), 'available');
  }
  for (const id of ['videos', 'aufgaben']) {
    assert.equal(getToolAvailability(getTool(id)!), 'locked');
  }
  for (const id of ['admin', 'kichat']) {
    assert.equal(getToolAvailability(getTool(id)!), 'hidden');
  }
});

test('Tester, Ki-Tester and Admin each unlock only their own tools', () => {
  const tasks = getTool('aufgaben')!;
  const chat = getTool('kichat')!;
  const team = getTool('admin')!;

  assert.equal(getToolAvailability(tasks, { ...noToolAccess, tester: true }), 'available');
  assert.equal(getToolAvailability(chat, { ...noToolAccess, tester: true }), 'hidden');
  assert.equal(getToolAvailability(team, { ...noToolAccess, tester: true }), 'hidden');
  assert.equal(getToolAvailability(chat, { ...noToolAccess, kiTester: true }), 'available');
  assert.equal(getToolAvailability(team, { ...noToolAccess, kiTester: true }), 'hidden');
  assert.equal(getToolAvailability(team, { ...noToolAccess, admin: true }), 'available');
  assert.equal(getToolAvailability(chat, { ...noToolAccess, admin: true }), 'hidden');
});
