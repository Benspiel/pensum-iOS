import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession } from '../../src/account/session';
import { AbschreibenScreen } from '../../src/features/abschreiben/screen';
import { AdminScreen } from '../../src/features/admin/screen';
import { AufgabenScreen } from '../../src/features/aufgaben/screen';
import { KiChatScreen } from '../../src/features/kichat/screen';
import { MindmapScreen } from '../../src/features/mindmap/screen';
import { VideosScreen } from '../../src/features/videos/screen';
import { ToolGate } from '../../src/navigation/tool-gate';
import { getTool, type Tool } from '../../src/navigation/tools';
import { Button, EmptyState, ErrorState, LoadingState, Screen } from '../../src/ui';

function AccountTool({ tool }: { tool: Tool }) {
  const router = useRouter();
  const { state, refresh } = useSession();
  if (state.status === 'loading') return <Screen title={tool.title}><LoadingState /></Screen>;
  if (state.status === 'error') return <Screen title={tool.title}><ErrorState message={state.error.message} onRetry={() => void refresh()} /></Screen>;
  if (state.status === 'guest') {
    return <Screen title={tool.title} description={tool.description}>
      <EmptyState title="Mit deinem Konto fortfahren" message="Melde dich an, um dieses Werkzeug zu verwenden." action={<Button title="Zum Konto" onPress={() => router.push('/konto')} />} />
    </Screen>;
  }
  if (state.connection === 'offline') {
    return <Screen title={tool.title}><ErrorState title="Keine Internetverbindung" message="Verbinde dich mit dem Internet, um dieses Werkzeug zu verwenden." onRetry={() => void refresh()} /></Screen>;
  }

  const key = state.user.id;
  switch (tool.id) {
    case 'abschreiben': return <AbschreibenScreen key={key} />;
    case 'admin': return <AdminScreen key={key} />;
    case 'aufgaben': return <AufgabenScreen key={key} />;
    case 'kichat': return <KiChatScreen key={key} userId={key} />;
    case 'mindmap': return <MindmapScreen key={key} userId={key} />;
    case 'videos': return <VideosScreen key={key} />;
    default: return <Screen title={tool.title}><EmptyState title="Werkzeug nicht verfügbar." /></Screen>;
  }
}

export default function ToolsRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const tool = getTool(id);
  if (!tool) return <Screen navigationTitle="Werkzeug"><EmptyState title="Werkzeug nicht gefunden." /></Screen>;
  return <ToolGate id={tool.id}><AccountTool tool={tool} /></ToolGate>;
}
