import { useLocalSearchParams } from 'expo-router';

import KarteikartenScreen from '../../src/features/karteikarten/screen';

/** Route /tools/karteikarten – optional ?deck=<stapel-id> (Link aus dem Planer). */
export default function KarteikartenRoute() {
  const { deck } = useLocalSearchParams<{ deck?: string | string[] }>();
  return <KarteikartenScreen deckParam={deck} />;
}
