import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

import { useSession } from '../account/session';
import { Button, EmptyState, ErrorState, LoadingState, Screen } from '../ui';
import { getTool, getToolAvailability, type ToolId } from './tools';

export function ToolGate({ id, children }: { id: ToolId; children: ReactNode }) {
  const router = useRouter();
  const { state, access } = useSession();
  const tool = getTool(id);
  if (!tool) return null;

  if (tool.access !== 'public' && state.status === 'loading') {
    return <Screen navigationTitle="Werkzeug"><LoadingState title="Zugriff wird geprüft …" /></Screen>;
  }
  if (tool.access !== 'public' && state.status === 'error') {
    return (
      <Screen navigationTitle="Werkzeug">
        <ErrorState title="Zugriff konnte nicht geprüft werden." message="Prüfe die Verbindung und öffne dein Konto erneut." />
        <Button title="Zum Konto" onPress={() => router.push('/konto')} />
      </Screen>
    );
  }

  const availability = getToolAvailability(tool, access);
  if (availability === 'hidden') {
    return (
      <Screen navigationTitle="Werkzeug">
        <EmptyState title="Werkzeug nicht verfügbar." message="Dieser Link ist mit deinem aktuellen Zugang nicht verfügbar." />
      </Screen>
    );
  }
  if (availability === 'locked' || tool.implementation === 'unavailable') {
    const message = availability === 'locked'
      ? 'Dieses Werkzeug ist für das Tester-Team freigeschaltet.'
      : 'Dieses Werkzeug ist in der iOS-Version noch nicht verfügbar.';
    return (
      <Screen navigationTitle={tool.title}>
        <EmptyState title="Werkzeug nicht verfügbar." message={message} />
      </Screen>
    );
  }

  return children;
}
