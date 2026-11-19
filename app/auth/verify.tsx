import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Notice, useAccountAction } from '../../src/account/forms';
import { useSession } from '../../src/account/session';
import { AppText, Button, Card, LoadingState, Screen } from '../../src/ui';

export default function VerifyScreen() {
  const router = useRouter();
  const session = useSession();
  const action = useAccountAction();
  const [finished, setFinished] = useState(false);
  const link = session.emailLink?.kind === 'verify' ? session.emailLink : null;

  return (
    <Screen title="E-Mail bestätigen">
      {session.state.status === 'loading' ? <LoadingState /> : (
        <Card>
          <AppText>{finished ? 'Deine E-Mail ist bestätigt.'
            : link ? 'Bestätige die E-Mail-Adresse für dein Konto.' : 'Öffne den Bestätigungslink aus der E-Mail.'}</AppText>
          {link && !finished ? <Button title="E-Mail bestätigen" loading={action.busy}
            onPress={() => void action.run(async () => { await session.finishEmailLink(link); setFinished(true); })} /> : null}
          <Button title="Zum Konto" variant="secondary" disabled={action.busy}
            onPress={() => { session.dismissEmailLink(); router.replace('/konto'); }} />
          <Notice notice={action.notice} />
        </Card>
      )}
    </Screen>
  );
}
