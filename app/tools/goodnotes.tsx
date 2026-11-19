import { useSession } from '../../src/account/session';
import GoodnotesScreen from '../../src/features/goodnotes/screen';

export default function GoodnotesRoute() {
  const { state } = useSession();
  const scope = state.status === 'account' ? `account:${state.user.id}` : 'guest';
  return <GoodnotesScreen key={scope} />;
}
