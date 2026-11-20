/* Team (Admin) – festes Bento-Raster wie auf der Website (tools/admin): Kennzahlen, 7-Tage-Balken, Rangliste, Teams, „Wer nutzt was“. */
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { executeFunction, functionIds } from '../../backend';
import { getTool, tools } from '../../navigation/tools';
import { radius, spacing, squircleRadius, usePensumTheme } from '../../theme';
import { AppText, Button, ErrorState, Field, LoadingState, Screen } from '../../ui';
import { confirmAction } from '../appwrite-tools/actions';
import { errorText } from '../appwrite-tools/actions';
import { barHeights, berlinToday, clock, dayAgo, fmt, pct, weekday, type Count } from './format';

type Stats = {
  generatedAt: string;
  users: Record<'total' | 'verified' | 'new7' | 'active7', Count>;
  teams: Record<'tester' | 'kiTester' | 'admin', Count>;
  visits: {
    total: Count; last7: Count; today: Count;
    series: { day: string; count: Count }[];
    byTool: { tool: string; total: Count; last7: Count }[];
  };
  content: Record<string, Count>;
};
type Person = { id: string; name: string; email: string; lastDay: string | null; total: number; tools: Record<string, number> };
type People = { days: number; truncated: boolean; list: Person[] };

const WIDE_MIN = 700;
const ICONS = {
  users: { ios: 'person.2', android: 'group', web: 'group' },
  chart: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
  rank: { ios: 'trophy', android: 'emoji_events', web: 'emoji_events' },
  pulse: { ios: 'waveform.path.ecg', android: 'monitor_heart', web: 'monitor_heart' },
  plus: { ios: 'person.badge.plus', android: 'person_add', web: 'person_add' },
  shield: { ios: 'checkmark.shield', android: 'verified_user', web: 'verified_user' },
  box: { ios: 'shippingbox', android: 'inventory_2', web: 'inventory_2' },
} satisfies Record<string, SymbolViewProps['name']>;

function Widget({ title, icon, note, flex, children }: {
  title: string; icon: keyof typeof ICONS; note?: string; flex?: number; children: ReactNode;
}) {
  const { colors } = usePensumTheme();
  return (
    <View accessible={false} style={[styles.widget, { backgroundColor: colors.surface }, flex !== undefined && { flex }]}>
      <View style={styles.widgetHead}>
        <View style={[styles.widgetIcon, { backgroundColor: colors.canvas }]}>
          <SymbolView name={ICONS[icon]} tintColor={colors.ink} size={17} weight="semibold" />
        </View>
        <AppText variant="label" numberOfLines={1} accessibilityRole="header" style={styles.widgetTitle}>{title}</AppText>
        {note ? <AppText variant="caption" tone="muted">{note}</AppText> : null}
      </View>
      {children}
    </View>
  );
}

function Big({ value, label, size = 40 }: { value: Count | undefined; label: string; size?: number }) {
  return (
    <View style={styles.big} accessible accessibilityLabel={`${fmt(value)} ${label}`}>
      <AppText variant="h1" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: size, lineHeight: Math.round(size * 1.1) }}>{fmt(value)}</AppText>
      <AppText variant="caption" tone="muted">{label}</AppText>
    </View>
  );
}

function Meter({ percent, large }: { percent: number; large?: boolean }) {
  const { colors } = usePensumTheme();
  return (
    <View style={[styles.meter, large && styles.meterLarge, { backgroundColor: colors.canvas }]}>
      <View style={[styles.meterFill, { width: `${percent}%`, backgroundColor: colors.ink }]} />
    </View>
  );
}

function Bars({ series }: { series: Stats['visits']['series'] }) {
  const { colors } = usePensumTheme();
  const heights = barHeights(series.map((d) => d.count));
  return (
    <View
      style={styles.bars}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Besuche der letzten 7 Tage: ${series.map((d) => `${weekday(d.day)} ${fmt(d.count)}`).join(', ')}`}
    >
      {series.map((d, i) => {
        const today = i === series.length - 1;
        return (
          <View key={d.day} style={styles.bar}>
            <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.barNumber}>{fmt(d.count)}</AppText>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { height: `${heights[i] ?? 0}%`, backgroundColor: today ? colors.ink : colors.faint }]} />
            </View>
            <AppText variant="caption" tone={today ? 'default' : 'muted'} style={today && styles.barToday}>{weekday(d.day)}</AppText>
          </View>
        );
      })}
    </View>
  );
}

function Rows({ rows }: { rows: [string, Count][] }) {
  const { colors } = usePensumTheme();
  return (
    <View>
      {rows.map(([name, value], i) => (
        <View key={name} style={[styles.listRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
          <AppText style={styles.listName} numberOfLines={1}>{name}</AppText>
          <AppText variant="h4" style={styles.listValue}>{fmt(value)}</AppText>
        </View>
      ))}
    </View>
  );
}

function Ranking({ byTool }: { byTool: Stats['visits']['byTool'] }) {
  const { colors } = usePensumTheme();
  const top = Math.max(0, ...byTool.map((r) => r.last7 ?? 0));
  return (
    <View style={styles.rank}>
      {byTool.map((row, i) => {
        const tool = getTool(row.tool);
        return (
          <View key={row.tool} style={styles.rankRow}>
            <AppText variant="caption" tone="muted" style={styles.rankPos}>{i + 1}</AppText>
            <View style={[styles.rankIcon, { backgroundColor: colors.canvas }]}>
              {tool ? <SymbolView name={tool.symbol} tintColor={colors.ink} size={17} weight="semibold" /> : null}
            </View>
            <View style={styles.rankMain}>
              <View style={styles.rankLine}>
                <AppText variant="label" numberOfLines={1} style={styles.rankName}>{tool?.title ?? row.tool}</AppText>
                <AppText variant="label">{fmt(row.last7)} <AppText variant="caption" tone="muted">/ {fmt(row.total)} gesamt</AppText></AppText>
              </View>
              <Meter percent={pct(row.last7 ?? 0, top)} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PeopleWidget({ people }: { people: People }) {
  const { colors } = usePensumTheme();
  const [filter, setFilter] = useState('');
  const today = berlinToday();
  const used = tools.filter((tool) => people.list.some((p) => p.tools[tool.id]));
  const rows = useMemo(() => people.list
    .filter((p) => !filter || p.tools[filter])
    .sort((a, b) => (filter ? (b.tools[filter] ?? 0) - (a.tools[filter] ?? 0) : 0) || b.total - a.total)
    .slice(0, 200), [people, filter]);

  return (
    <Widget title="Wer nutzt was" icon="users" note={`${people.days} Tage`}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {[{ id: '', title: 'Alle Tools' }, ...used].map((tool) => {
          const on = tool.id === filter;
          return (
            <Pressable
              key={tool.id || 'all'}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setFilter(tool.id)}
              style={[styles.filterChip, { backgroundColor: on ? colors.ink : colors.canvas }]}
            >
              <AppText variant="bodySm" style={{ color: on ? colors.canvas : colors.ink }}>{tool.title}</AppText>
            </Pressable>
          );
        })}
      </ScrollView>
      <AppText variant="caption" tone="muted">
        {fmt(rows.length)} von {fmt(people.list.length)} Nutzern{people.truncated ? ' (Liste gekürzt)' : ''}
      </AppText>
      {rows.length === 0 ? (
        <AppText variant="bodySm" tone="muted">Noch keine Aufrufe in diesem Zeitraum.</AppText>
      ) : rows.map((p, i) => {
        const label = p.name || p.email || 'Ohne Namen';
        return (
          <View key={p.id} style={[styles.person, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <View style={styles.personTop}>
              <View style={[styles.avatar, { backgroundColor: colors.canvas }]}>
                <AppText variant="label">{(Array.from(label)[0] ?? '?').toUpperCase()}</AppText>
              </View>
              <View style={styles.who}>
                <AppText variant="label" numberOfLines={1}>{label}</AppText>
                {p.name && p.email ? <AppText variant="caption" tone="muted" numberOfLines={1}>{p.email}</AppText> : null}
              </View>
              <AppText variant="caption" tone="muted">{dayAgo(p.lastDay, today)}</AppText>
            </View>
            <View style={styles.chips}>
              {Object.entries(p.tools).sort((a, b) => b[1] - a[1]).map(([id, n]) => {
                const on = id === filter;
                return (
                  <View key={id} style={[styles.chip, { backgroundColor: on ? colors.ink : colors.canvas }]}>
                    <AppText variant="caption" style={{ color: on ? colors.canvas : colors.ink }}>{getTool(id)?.title ?? id} {fmt(n)}</AppText>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </Widget>
  );
}

/** Mitteilung an alle Geräte senden (Function push-send, nur Team „Admin“). Erst zählen, dann nach Rückfrage senden. */
function BroadcastWidget() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const ready = title.trim().length > 0 && body.trim().length > 0;

  async function run(dryRun: boolean) {
    setBusy(true);
    setError('');
    setResult('');
    try {
      const reply = await executeFunction<{ recipients: number; removed?: number }>(functionIds.pushSend, { title: title.trim(), body: body.trim(), dryRun });
      if (dryRun) setResult(`Die Mitteilung würde ${fmt(reply.recipients)} Geräte erreichen.`);
      else { setResult(`Gesendet an ${fmt(reply.recipients)} Geräte.`); setTitle(''); setBody(''); }
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!ready || busy) return;
    if (await confirmAction('Mitteilung an alle senden?', `„${title.trim()}“ geht sofort an alle Geräte mit Benachrichtigungen.`, 'Senden', true)) await run(false);
  }

  return (
    <Widget title="Mitteilung senden" icon="plus" note="an alle Geräte">
      <Field label="Titel" value={title} onChangeText={setTitle} maxLength={60} editable={!busy} placeholder="z. B. Neue Funktion" />
      <Field label="Text" value={body} onChangeText={setBody} maxLength={240} multiline editable={!busy} placeholder="Kurze Nachricht, höchstens 240 Zeichen" />
      {error ? <AppText variant="bodySm" style={{ color: '#d93025' }}>{error}</AppText> : null}
      {result ? <AppText variant="bodySm" tone="muted">{result}</AppText> : null}
      <View style={styles.broadcastActions}>
        <Button title="Empfänger zählen" variant="secondary" disabled={!ready || busy} onPress={() => void run(true)} style={styles.half} />
        <Button title="Senden" haptic="send" loading={busy} disabled={!ready} onPress={() => void send()} style={styles.half} />
      </View>
    </Widget>
  );
}

export function AdminScreen() {
  const [stats, setStats] = useState<Stats>();
  const [people, setPeople] = useState<People>();
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_MIN;
  const { colors } = usePensumTheme();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    executeFunction<{ stats: Stats }>(functionIds.adminStats, {})
      .then((value) => {
        if (!active) return;
        setStats(value.stats);
        setPeopleLoading(true);
        setPeopleError('');
        // Wie auf der Website lädt „Wer nutzt was“ nach dem Raster nach (liest alle Aufrufe und braucht länger).
        return executeFunction<{ people: People }>(functionIds.adminStats, { action: 'people' })
          .then((result) => { if (active) setPeople(result.people); })
          .catch((reason: unknown) => { if (active) setPeopleError(errorText(reason)); })
          .finally(() => { if (active) setPeopleLoading(false); });
      })
      .catch((reason: unknown) => { if (active) setError(errorText(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  const reload = () => setAttempt((value) => value + 1);
  const row = (children: ReactNode, key: string) => <View key={key} style={[styles.row, wide && styles.rowWide]}>{children}</View>;

  return (
    <Screen wide title="Team" description="Plattformzahlen und Werkzeugnutzung für die letzten Tage.">
      {stats ? (
        <View style={styles.headRow}>
          <AppText variant="caption" tone="muted">Stand {clock(stats.generatedAt)} Uhr</AppText>
          <Button title="Aktualisieren" size="sm" variant="secondary" symbol={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }} onPress={reload} disabled={loading} />
        </View>
      ) : null}
      {loading && !stats && <LoadingState title="Plattformzahlen werden geladen" />}
      {error !== '' && <ErrorState message={error} onRetry={reload} />}
      {stats && (
        <View style={styles.grid}>
          {row([
            <Widget key="users" flex={1} title="Nutzer" icon="users">
              <Big value={stats.users.total} label="Konten insgesamt" />
              <View style={styles.split}>
                <Meter percent={pct(stats.users.verified, stats.users.total)} large />
                <AppText variant="caption" tone="muted">{fmt(stats.users.verified)} mit bestätigter E-Mail ({pct(stats.users.verified, stats.users.total)} %)</AppText>
              </View>
            </Widget>,
            <Widget key="visits" flex={1} title="Tool-Aufrufe" icon="chart" note="7 Tage">
              <View style={styles.bigRow}>
                <Big value={stats.visits.last7} label="in 7 Tagen" size={30} />
                <Big value={stats.visits.today} label="heute" size={30} />
                <Big value={stats.visits.total} label="gesamt" size={30} />
              </View>
              <Bars series={stats.visits.series} />
            </Widget>,
          ], 'r1')}
          {row([
            <Widget key="rank" flex={2} title="Beliebteste Tools" icon="rank" note="Aufrufe in 7 Tagen">
              <Ranking byTool={stats.visits.byTool} />
            </Widget>,
            <View key="side" style={[styles.side, wide && { flex: 1 }, !wide && styles.sideNarrow]}>
              <Widget flex={1} title="Aktiv" icon="pulse">
                <Big value={stats.users.active7} label="Nutzer in 7 Tagen" size={34} />
                <AppText variant="caption" tone="muted">{pct(stats.users.active7, stats.users.total)} % aller Konten</AppText>
              </Widget>
              <Widget flex={1} title="Neu" icon="plus">
                <Big value={stats.users.new7} label="Konten in 7 Tagen" size={34} />
                <AppText variant="caption" tone="muted">{fmt(stats.users.total)} insgesamt</AppText>
              </Widget>
            </View>,
          ], 'r2')}
          {row([
            <Widget key="teams" flex={1} title="Teams" icon="shield">
              <Rows rows={[['Admin', stats.teams.admin], ['Ki-Tester', stats.teams.kiTester], ['Tester', stats.teams.tester]]} />
            </Widget>,
            <Widget key="content" flex={1} title="Angelegt" icon="box">
              <View style={styles.groups}>
                {([
                  ['Notenrechner', [['Noten', stats.content.grades ?? null]]],
                  ['Karteikarten', [['Stapel', stats.content.decks ?? null], ['Karten', stats.content.cards ?? null]]],
                  ['Mindmap', [['Mindmaps', stats.content.mindmaps ?? null]]],
                  ['Planer', [['Einträge', stats.content.planner ?? null]]],
                  ['KI-Chat', [['Chats', stats.content.chats ?? null], ['Nachrichten', stats.content.messages ?? null]]],
                ] as [string, [string, Count][]][]).map(([group, items]) => (
                  <View key={group}>
                    <AppText variant="caption" tone="muted" style={styles.groupName}>{group.toLocaleUpperCase('de-DE')}</AppText>
                    <Rows rows={items} />
                  </View>
                ))}
              </View>
            </Widget>,
          ], 'r3')}
          <BroadcastWidget />
          {people ? <PeopleWidget people={people} /> : (
            <View style={[styles.widget, styles.wait, { backgroundColor: colors.surface }]}>
              {peopleLoading ? <LoadingState title="Nutzerliste wird geladen …" /> : null}
              {peopleError !== '' ? <ErrorState message={peopleError} onRetry={reload} /> : null}
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  broadcastActions: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  grid: { gap: spacing.md },
  row: { gap: spacing.md },
  rowWide: { flexDirection: 'row', alignItems: 'stretch' },
  side: { gap: spacing.md },
  sideNarrow: { flexDirection: 'row' },
  widget: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.card, borderCurve: 'continuous', minWidth: 0 },
  widgetHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  widgetIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: squircleRadius(32), borderCurve: 'continuous' },
  widgetTitle: { flex: 1, minWidth: 0 },
  big: { gap: 2, minWidth: 0 },
  bigRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  split: { gap: spacing.sm, marginTop: 'auto' },
  meter: { height: 6, overflow: 'hidden', borderRadius: radius.pill },
  meterLarge: { height: 10 },
  meterFill: { height: '100%', borderRadius: radius.pill },
  bars: { flexDirection: 'row', gap: spacing.xs, height: 130, marginTop: 'auto' },
  bar: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barNumber: { height: 16 },
  barTrack: { flex: 1, width: '100%', maxWidth: 28, justifyContent: 'flex-end' },
  barFill: { width: '100%', minHeight: 2, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  barToday: { fontWeight: '600' },
  rank: { gap: spacing.md },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rankPos: { width: 18, textAlign: 'right' },
  rankIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: squircleRadius(34), borderCurve: 'continuous' },
  rankMain: { flex: 1, minWidth: 0, gap: 6 },
  rankLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  rankName: { flexShrink: 1 },
  listRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 9 },
  listName: { flexShrink: 1 },
  listValue: { fontSize: 17 },
  groups: { gap: spacing.md },
  groupName: { fontWeight: '600', letterSpacing: 0.4 },
  filterRow: { gap: spacing.sm, paddingVertical: 2 },
  filterChip: { minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  person: { gap: spacing.sm, paddingVertical: spacing.md },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: squircleRadius(36), borderCurve: 'continuous' },
  who: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 36 + spacing.sm },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  wait: { minHeight: 140, alignItems: 'center', justifyContent: 'center' },
});
