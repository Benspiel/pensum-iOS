/* Konto – Benachrichtigungen: Erinnerungen zum Lernen (Karteikarten) und zur täglichen Mindmap, je mit Uhrzeit.
 * Wird als Inhalt eines BottomSheets gezeigt. Speichern passiert bei jeder Änderung; die Berechtigung fragt iOS erst beim Einschalten. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { haptic } from '../ui';
import { AppText, Button } from '../ui';
import { spacing, usePensumTheme } from '../theme';
import {
  DEFAULT_PUSH_PREFS, hourLabel, loadDevice, pushStatus, removeDevice, saveDevice, stepHour, type PushPrefs, type PushStatus,
} from '../notifications';

type Topic = 'cards' | 'mindmap';
const TOPICS: { id: Topic; title: string; text: string; hour: 'cardsHour' | 'mindmapHour' }[] = [
  { id: 'cards', title: 'Karteikarten lernen', text: 'Eine tägliche Erinnerung, deine Karten zu wiederholen.', hour: 'cardsHour' },
  { id: 'mindmap', title: 'Tägliche Mindmap', text: 'Hinweis, dass du heute wieder eine Mindmap erstellen kannst.', hour: 'mindmapHour' },
];

export function NotificationSettings({ userId, onChange }: { userId: string; onChange?: (prefs: PushPrefs | null) => void }) {
  const { colors } = usePensumTheme();
  const [prefs, setPrefs] = useState<PushPrefs | null>(null);
  const [status, setStatus] = useState<PushStatus>('undetermined');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef<PushPrefs | null>(null);
  const report = useRef(onChange);
  report.current = onChange;

  useEffect(() => {
    let active = true;
    (async () => {
      const [state, device] = await Promise.all([pushStatus(), loadDevice()]);
      if (!active) return;
      setStatus(state);
      latest.current = device;
      setPrefs(device);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const store = useCallback(async (next: PushPrefs | null) => {
    setBusy(true);
    setError('');
    const previous = latest.current;
    latest.current = next;
    setPrefs(next);
    if (next === null || (!next.cards && !next.mindmap)) {
      await removeDevice();
      latest.current = null;
      setPrefs(null);
      report.current?.(null);
    } else {
      const result = await saveDevice(userId, next);
      if ('error' in result) {
        latest.current = previous;
        setPrefs(previous);
        setError(result.error);
        haptic('error');
      } else {
        report.current?.(next);
      }
    }
    setStatus(await pushStatus());
    setBusy(false);
  }, [userId]);

  const toggle = (topic: Topic, on: boolean) => {
    const base = latest.current ?? { ...DEFAULT_PUSH_PREFS, cards: false, mindmap: false };
    void store({ ...base, [topic]: on });
  };
  const shift = (key: 'cardsHour' | 'mindmapHour', dir: 1 | -1) => {
    const base = latest.current;
    if (!base) return;
    void store({ ...base, [key]: stepHour(base[key], dir) });
  };

  if (loading) return <AppText tone="muted">Einstellungen werden geladen …</AppText>;

  return (
    <View style={styles.wrap}>
      {status === 'denied' ? (
        <AppText variant="bodySm" tone="muted">
          Mitteilungen sind für Pensum in den iOS-Einstellungen ausgeschaltet. Erlaube sie dort unter Einstellungen › Pensum › Mitteilungen.
        </AppText>
      ) : (
        <AppText variant="bodySm" tone="muted">Pensum schickt dir nur, was du hier einschaltest, einmal am Tag zur gewählten Uhrzeit.</AppText>
      )}
      {TOPICS.map((topic) => {
        const on = prefs?.[topic.id] === true;
        return (
          <View key={topic.id} style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.head}>
              <View style={styles.copy}>
                <AppText variant="label">{topic.title}</AppText>
                <AppText variant="caption" tone="muted">{topic.text}</AppText>
              </View>
              <Switch
                value={on}
                disabled={busy || status === 'denied'}
                accessibilityLabel={topic.title}
                onValueChange={(value) => { haptic('select'); toggle(topic.id, value); }}
                trackColor={{ true: colors.ink }}
              />
            </View>
            {on && prefs ? (
              <View style={styles.time}>
                <AppText variant="bodySm" tone="muted">Uhrzeit</AppText>
                <View style={styles.stepper}>
                  <Button title="−" size="sm" variant="secondary" accessibilityLabel="Eine Stunde früher" disabled={busy} onPress={() => shift(topic.hour, -1)} style={styles.step} />
                  <AppText variant="h4" style={styles.hour} accessibilityLiveRegion="polite">{hourLabel(prefs[topic.hour])}</AppText>
                  <Button title="+" size="sm" variant="secondary" accessibilityLabel="Eine Stunde später" disabled={busy} onPress={() => shift(topic.hour, 1)} style={styles.step} />
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
      {error ? <AppText variant="bodySm" style={{ color: colors.danger }}>{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: 16, borderCurve: 'continuous' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, gap: 2 },
  time: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  step: { minWidth: 44 },
  hour: { minWidth: 96, textAlign: 'center' },
});
