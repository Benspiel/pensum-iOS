import assert from 'node:assert/strict';
import test from 'node:test';
import * as S from '../state';
import * as T from '../tree';

const must = <V,>(value: V | null | undefined): V => { assert.ok(value); return value; };
const sample = () => must(T.sanitize({ id: 'r', text: 'Thema', children: [
  { id: 'a', text: 'A', children: [{ id: 'a1', text: 'A1' }, { id: 'a2', text: 'A2' }] },
  { id: 'b', text: 'B' },
] }));

/* ---------- Ändern und Rückgängig ---------- */

test('applyChange: Verlauf, Auswahl, leeren Wiederholen-Zweig', () => {
  let s = S.openEditor(sample());
  assert.equal(s.selectedId, 'r');
  let r = S.applyChange(s, T.addChild(s.root, 'b'), { now: 1000 });
  assert.ok(r.changed);
  s = r.state;
  assert.equal(s.past.length, 1);
  assert.equal(T.find(s.root, s.selectedId)?.node.text, 'Neuer Punkt');
  s = S.stepHistory(s, 'undo');
  assert.equal(T.countNodes(s.root), 5);
  assert.equal(s.future.length, 1);
  assert.equal(s.selectedId, 'r', 'der neue Knoten existiert nicht mehr: Auswahl springt aufs Thema');
  s = S.stepHistory(s, 'redo');
  assert.equal(T.countNodes(s.root), 6);
  assert.equal(s.future.length, 0);
  r = S.applyChange(S.stepHistory(s, 'undo'), T.addChild(s.root, 'a'), { now: 2000 });
  assert.equal(r.state.future.length, 0, 'neue Änderung leert Wiederholen');
});

test('applyChange: Fehler und „nichts zu tun“ ändern den Verlauf nicht', () => {
  const s = S.openEditor(sample());
  const err = S.applyChange(s, T.remove(s.root, 'r'));
  assert.equal(err.changed, false);
  assert.match(err.state.error, /Thema/);
  assert.equal(err.state.past.length, 0);
  const noop = S.applyChange(s, T.move(s.root, 'a', -1));
  assert.equal(noop.changed, false);
  assert.equal(noop.state.error, '', 'error: null löscht die Meldung');
  assert.equal(S.stepHistory(s, 'undo'), s);
  assert.equal(S.stepHistory(s, 'redo'), s);
});

test('Zusammenfassen: Tippen im selben Feld innerhalb von 1,5 s ergibt einen Schritt', () => {
  let s = S.openEditor(sample());
  const type = (text: string, now: number, key = 'text:a') => {
    s = S.applyChange(s, T.rename(s.root, 'a', text), { coalesce: key, select: false, now }).state;
  };
  type('Ab', 1000); type('Abc', 1400); type('Abcd', 2500);
  assert.equal(s.past.length, 1, 'alle drei gehören zusammen (je unter 1,5 s Abstand)');
  assert.equal(JSON.parse(must(s.past[0])).children[0].text, 'A');
  type('Abcde', 4500); // über 1,5 s Pause: neuer Schritt
  assert.equal(s.past.length, 2);
  type('Anders', 4600, 'text:b'); // anderes Feld: neuer Schritt
  assert.equal(s.past.length, 3);
  s = S.applyChange(s, T.addChild(s.root, 'r'), { now: 4700 }).state; // Ändern ohne Schlüssel beendet das Zusammenfassen
  type('X', 4800, 'text:b');
  assert.equal(s.past.length, 5);
  s = S.stepHistory(s, 'undo');
  assert.equal(s.coalesceKey, null);
});

test('Verlauf ist auf 60 Schritte begrenzt', () => {
  let s = S.openEditor(sample());
  for (let i = 0; i < 70; i++) s = S.applyChange(s, T.rename(s.root, 'a', 'n' + i), { now: i * 5000 }).state;
  assert.equal(s.past.length, S.HISTORY_MAX);
  for (let i = 0; i < 100; i++) s = S.stepHistory(s, 'undo');
  assert.equal(s.past.length, 0);
  assert.equal(s.future.length, S.HISTORY_MAX);
});

test('KI-Ergebnis: Thema bleibt, Auswahl aufs Thema, Schritt zum Rückgängigmachen', () => {
  let s = S.openEditor(sample());
  s = S.applyChange(s, T.rename(s.root, 'r', 'Mein Thema'), { select: false }).state;
  const map = must(T.sanitize({ text: 'KI-Titel', children: [{ text: 'neu' }] }));
  const r = S.applyAiMap(s, map);
  assert.equal(r.state.root.text, 'Mein Thema');
  assert.equal(r.state.root.children[0]?.text, 'neu');
  assert.equal(r.state.selectedId, r.state.root.id);
  assert.equal(S.stepHistory(r.state, 'undo').root.children.length, 2);
});

/* ---------- Ein-/Ausklappen ---------- */

test('toggleFold: nur Äste mit Unterpunkten, Auswahl wandert auf den Ast', () => {
  let s = S.openEditor(sample());
  assert.equal(S.toggleFold(s, 'r'), s, 'das Thema lässt sich nicht einklappen');
  assert.equal(S.toggleFold(s, 'b'), s, 'ohne Unterpunkte nichts zu tun');
  s = S.selectNode(s, 'a1');
  s = S.toggleFold(s, 'a');
  assert.ok(s.collapsed.has('a'));
  assert.equal(s.selectedId, 'a');
  s = S.toggleFold(s, 'a');
  assert.equal(s.collapsed.size, 0);
});

test('Auswahl eines verborgenen Knotens klappt die Vorfahren auf', () => {
  let s = S.foldAll(S.openEditor(sample()));
  assert.deepEqual([...s.collapsed], ['a']);
  s = S.selectNode(s, 'a2');
  assert.equal(s.collapsed.has('a'), false);
  assert.equal(S.selectNode(s, 'gibt-es-nicht'), s);
});

test('foldAll / unfoldAll und Werkzeugzustand', () => {
  let s = S.openEditor(sample());
  let t = S.toolState(s);
  assert.equal(t.canFoldAll, true);
  assert.equal(t.canUnfoldAll, false);
  assert.equal(t.canAddSibling, false, 'Thema hat keinen Nebenpunkt');
  assert.equal(t.canRemove, false);
  assert.equal(t.canFoldNode, false);
  s = S.selectNode(s, 'a');
  t = S.toolState(s);
  assert.deepEqual([t.canAddChild, t.canAddSibling, t.canRemove, t.canMoveUp, t.canMoveDown, t.canFoldNode], [true, true, true, false, true, true]);
  s = S.foldAll(s);
  assert.equal(s.selectedId, 'r');
  t = S.toolState(S.selectNode(s, 'a'));
  assert.equal(t.folded, true);
  assert.equal(t.canUnfoldAll, true);
  assert.equal(S.unfoldAll(s).collapsed.size, 0);
  assert.equal(S.toolState(S.unfoldAll(s)).canUnfoldAll, false);
  assert.equal(S.toolState(S.selectNode(S.openEditor(sample()), 'b')).canMoveDown, false);
});

test('große Mindmaps starten mit eingeklappten Ästen ab Ebene 3', () => {
  const big = must(T.sanitize({ text: 'r', children: Array.from({ length: 6 }, (_, i) => ({ text: 'a' + i, children: Array.from({ length: 4 }, (_, j) => ({ text: `b${i}${j}`, children: [{ text: 'c' }, { text: 'd' }] })) })) }));
  assert.equal(S.openEditor(big).collapsed.size, 24);
});

/* ---------- Speichern ---------- */

function fakeTimers() {
  const jobs = new Map<number, { fn: () => void; at: number }>();
  let id = 0, now = 0;
  return {
    timers: { set: (fn: () => void, ms: number) => { jobs.set(++id, { fn, at: now + ms }); return id; }, clear: (h: unknown) => { jobs.delete(h as number); } },
    advance(ms: number) {
      now += ms;
      for (const [key, job] of [...jobs]) if (job.at <= now) { jobs.delete(key); job.fn(); }
    },
    pending: () => jobs.size,
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('Saver: speichert nach 700 ms Ruhe, nur den letzten Stand', async () => {
  const clock = fakeTimers(), saved: string[] = [], states: S.SaveStatus[] = [];
  const saver = S.createSaver({ save: async (id, root) => { saved.push(id + ':' + root.text); }, onStatus: (s) => states.push(s), timers: clock.timers });
  const mk = (text: string) => must(T.sanitize({ text }));
  saver.schedule('m1', mk('eins'));
  clock.advance(500);
  saver.schedule('m1', mk('zwei'));
  clock.advance(500);
  assert.deepEqual(saved, []);
  clock.advance(300);
  await tick();
  assert.deepEqual(saved, ['m1:zwei']);
  assert.equal(saver.status, 'saved');
  assert.deepEqual(states, ['saving', 'saved']);
});

test('Saver: Fehler zeigen „error“ und wiederholen nach 5 s', async () => {
  const clock = fakeTimers();
  let fail = true, calls = 0;
  const saver = S.createSaver({ save: async () => { calls++; if (fail) throw new Error('offline'); }, timers: clock.timers });
  saver.schedule('m1', must(T.sanitize({ text: 'x' })));
  clock.advance(700);
  await tick();
  assert.equal(saver.status, 'error');
  assert.equal(S.saveStateText('error', true), 'Speichern fehlgeschlagen. Wird erneut versucht.');
  fail = false;
  clock.advance(4999);
  await tick();
  assert.equal(calls, 1);
  clock.advance(1);
  await tick();
  assert.equal(calls, 2);
  assert.equal(saver.status, 'saved');
});

test('Saver: flush wartet auf laufendes Speichern und verwechselt Mindmaps nicht', async () => {
  const clock = fakeTimers(), saved: string[] = [];
  let release: () => void = () => {};
  const saver = S.createSaver({
    save: (id, root) => new Promise<void>((resolve) => { release = () => { saved.push(id + ':' + root.text); resolve(); }; }),
    timers: clock.timers,
  });
  saver.schedule('m1', must(T.sanitize({ text: 'alt' })));
  const first = saver.flush();
  await tick();
  saver.schedule('m1', must(T.sanitize({ text: 'neuer' })));
  const second = saver.flush();
  release();
  await tick();
  release();
  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.deepEqual(saved, ['m1:alt', 'm1:neuer']);
});

test('Saver: drop verwirft Offenes (Löschen) und dispose stoppt Wiederholungen', async () => {
  const clock = fakeTimers();
  let calls = 0;
  const saver = S.createSaver({ save: async () => { calls++; throw new Error('x'); }, timers: clock.timers });
  saver.schedule('m1', must(T.sanitize({ text: 'x' })));
  saver.drop('m1');
  assert.equal(clock.pending(), 0);
  clock.advance(10000);
  await tick();
  assert.equal(calls, 0);
  saver.schedule('m2', must(T.sanitize({ text: 'y' })));
  clock.advance(700);
  await tick();
  assert.equal(calls, 1);
  saver.dispose();
  assert.equal(clock.pending(), 0);
  clock.advance(10000);
  await tick();
  assert.equal(calls, 1);
});

/* ---------- Zoom und Texte ---------- */

test('Zoom: Schritte, Grenzen und Einpassen wie im Web', () => {
  assert.equal(S.stepZoom(1, 1), 1.15);
  assert.equal(S.clampZoom(9), 2.5);
  assert.equal(S.stepZoom(0.3, -1), 0.25);
  // breit, aber flach: passt in die Breite
  assert.equal(S.fitZoom(1000, 600, 360, 400), 0.35);
  // sehr hoch: Höhe zählt nur bis 55 %
  assert.equal(S.fitZoom(300, 2000, 360, 400), 0.55);
  assert.equal(S.fitZoom(200, 200, 600, 600), 1);
  assert.equal(S.fitZoom(5000, 5000, 100, 100), 0.25);
});

test('Anzeigetexte', () => {
  const usage = { created: 1, maxCreated: 1, edits: 2, maxEdits: 3 };
  assert.deepEqual(S.usageBadges(usage), ['Mindmap heute: 1 von 1', 'KI-Änderungen heute: 2 von 3']);
  assert.equal(S.canCreateToday(usage), false);
  assert.equal(S.canCreateToday(undefined), false);
  assert.equal(S.canCreateToday({ ...usage, created: 0 }), true);
  assert.equal(S.dayLabel('2026-03-09'), '09.03.2026');
  assert.equal(S.mapOptionLabel({ day: '2026-03-10', topic: 'Beatles' }, '2026-03-10'), 'Heute · Beatles');
  assert.equal(S.mapOptionLabel({ day: '2026-03-09', topic: '' }, '2026-03-10'), '09.03.2026 · Mindmap');
  assert.equal(S.aiButtonLabel({ busy: false, today: true, usage }), 'Mit KI ändern (1 übrig)');
  assert.equal(S.aiButtonLabel({ busy: true, today: true, usage }), 'KI arbeitet …');
  assert.equal(S.aiButtonLabel({ busy: false, today: false, usage }), 'Mit KI ändern');
  assert.match(S.aiInfoText({ hasMap: true, today: true, usage }), /noch 1 von 3 Änderungen frei/);
  assert.match(S.aiInfoText({ hasMap: true, today: true, usage: { ...usage, edits: 3 } }), /alle KI-Änderungen verbraucht/);
  assert.match(S.aiInfoText({ hasMap: true, today: false, usage }), /nur für die Mindmap von heute/);
  assert.equal(S.aiInfoText({ hasMap: false, today: true, usage }), '');
  assert.equal(S.saveStateText('saving', true), 'Speichert …');
  assert.equal(S.saveStateText('saved', false), '');
  assert.equal(S.topicOf(must(T.sanitize({ text: 'x'.repeat(80) }))), 'x'.repeat(80));
  assert.equal(S.exportBase(must(T.sanitize({ text: 'A/B: C' })), '2026-03-10'), 'A-B- C 2026-03-10');
});
