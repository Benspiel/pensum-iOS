import { useRouter } from 'expo-router';

import { Button, EmptyState, Screen } from '../src/ui';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen navigationTitle="Seite nicht gefunden">
      <EmptyState
        title="Seite nicht gefunden."
        message="Dieser Link führt zu keinem Pensum-Werkzeug."
        action={<Button title="Zur Übersicht" onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}
