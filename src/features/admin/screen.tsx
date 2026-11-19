import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { executeFunction, functionIds } from '../../backend';
import { getTool, tools } from '../../navigation/tools';
import { useAccountGuard } from '../appwrite-tools/account-scope';
import { AppText, Button, Card, EmptyState, ErrorState, Field, LoadingState, Screen } from '../../ui';
import { errorText, useToolAction } from '../appwrite-tools/actions';

type Count = number | null;
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

const labels: Record<string, string> = {
  decks: 'Stapel', cards: 'Karten', mindmaps: 'Mindmaps', chats: 'Chats', messages: 'Nachrichten', planner: 'Planereinträge', grades: 'Noten',
};
const displayCount = (value: Count | undefined) => value == null ? 'Keine Daten' : value.toLocaleString('de-DE');

function Stat({ title, value }: { title: string; value: Count | undefined }) {
  return (
    <View style={styles.row}>
      <AppText style={styles.label}>{title}</AppText>
      <AppText tone="muted">{displayCount(value)}</AppText>
    </View>
  );
}

export function AdminScreen() {
  const [stats, setStats] = useState<Stats>();
  const [people, setPeople] = useState<People>();
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const action = useToolAction();
  const requireAccount = useAccountGuard();

  useEffect(() => {
    let active = true;
    setLoading(true);
    executeFunction<{ stats: Stats }>(functionIds.adminStats, {})
      .then((value) => { if (active) { setStats(value.stats); setError(''); } })
      .catch((reason: unknown) => { if (active) setError(errorText(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  const search = filter.trim().toLocaleLowerCase('de-DE');
  const toolFilter = tools.find((tool) => tool.title.toLocaleLowerCase('de-DE') === search || tool.id === search);
  const filteredPeople = people?.list.filter((person) =>
    !search || (toolFilter ? Boolean(person.tools[toolFilter.id]) : [person.name, person.email].some((value) => value.toLocaleLowerCase('de-DE').includes(search))),
  );

  return (
    <Screen title="Team" description="Plattformzahlen und Werkzeugnutzung für die letzten Tage.">
      {loading && <LoadingState title="Plattformzahlen werden geladen" />}
      {error !== '' && <ErrorState message={error} onRetry={() => setAttempt((value) => value + 1)} />}
      {stats && (
        <>
          <Card>
            <AppText variant="section">Konten</AppText>
            <Stat title="Gesamt" value={stats.users.total} />
            <Stat title="Bestätigt" value={stats.users.verified} />
            <Stat title="Neu in 7 Tagen" value={stats.users.new7} />
            <Stat title="Aktiv in 7 Tagen" value={stats.users.active7} />
          </Card>
          <Card>
            <AppText variant="section">Werkzeugaufrufe</AppText>
            <Stat title="Heute" value={stats.visits.today} />
            <Stat title="Letzte 7 Tage" value={stats.visits.last7} />
            <Stat title="Gesamt" value={stats.visits.total} />
            {stats.visits.series.map(({ day, count }) => <Stat key={day} title={day} value={count} />)}
          </Card>
          <Card>
            <AppText variant="section">Werkzeuge · letzte 7 Tage</AppText>
            {stats.visits.byTool.map(({ tool, last7 }) => <Stat key={tool} title={getTool(tool)?.title ?? tool} value={last7} />)}
          </Card>
          <Card>
            <AppText variant="section">Teams und Inhalte</AppText>
            <Stat title="Tester" value={stats.teams.tester} />
            <Stat title="KI-Tester" value={stats.teams.kiTester} />
            <Stat title="Admin" value={stats.teams.admin} />
            {Object.entries(stats.content).map(([key, value]) => <Stat key={key} title={labels[key] ?? key} value={value} />)}
          </Card>
        </>
      )}
      <Card>
        <AppText variant="section">Wer nutzt was</AppText>
        <Button title="Nutzungsübersicht laden" variant="secondary" loading={action.busy} onPress={() => void action.run(async () => {
          requireAccount();
          const value = await executeFunction<{ people: People }>(functionIds.adminStats, { action: 'people' });
          setPeople(value.people);
        })} />
        {action.error !== '' && <ErrorState message={action.error} />}
        {people && (
          <>
            <AppText tone="muted">Letzte {people.days} Tage{people.truncated ? ' · Serverlimit erreicht' : ''}</AppText>
            <Field label="Nach Name, E-Mail oder Werkzeug filtern" value={filter} onChangeText={setFilter} autoCapitalize="none" />
            {!filteredPeople?.length && <EmptyState title="Keine passenden Einträge" />}
            {filteredPeople?.map((person) => (
              <View key={person.id} style={styles.person}>
                <AppText variant="label">{person.name || person.email}</AppText>
                {!!person.name && <AppText tone="muted">{person.email}</AppText>}
                <AppText tone="muted">{displayCount(person.total)} Aufrufe{person.lastDay ? ` · zuletzt ${person.lastDay}` : ''}</AppText>
                <AppText>{Object.entries(person.tools).map(([id, count]) => `${getTool(id)?.title ?? id} ${count}`).join(' · ')}</AppText>
              </View>
            ))}
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  label: { flexShrink: 1 },
  person: { gap: 6, paddingVertical: 10 },
});
