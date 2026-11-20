import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Notice, useAccountAction } from '../../src/account/forms';
import { useSession } from '../../src/account/session';
import { AppText, Button, Card, Field, LoadingState, Screen } from '../../src/ui';

export default function RecoverScreen() {
  const router = useRouter();
  const session = useSession();
  const action = useAccountAction();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [finished, setFinished] = useState(false);
  const submitting = !!userId;
  const signedIn = session.state.status === 'account';
  const canRecover = session.state.status === 'guest';
  const goToAccount = () => {
    session.dismissEmailLink();
    router.replace('/konto');
  };

  function sendCode() {
    void action.run(async () => {
      setUserId(await session.startRecovery(email));
      setCode('');
    }, 'Wenn für diese Adresse ein Konto besteht, wird ein Code per E-Mail zugestellt.');
  }

  function finish() {
    void action.run(async () => {
      if (userId) await session.finishRecovery(userId, code, password);
      setPassword('');
      setCode('');
      setFinished(true);
    });
  }

  return (
    <Screen title="Passwort zurücksetzen">
      {session.state.status === 'loading' ? <LoadingState /> : null}
      {signedIn && !canRecover ? (
        <Card>
          <AppText>Melde dich vor dem Zurücksetzen vom aktuellen Konto ab.</AppText>
          <Button title="Zum Konto" onPress={goToAccount} />
        </Card>
      ) : null}
      {canRecover ? (
        <Card>
          {finished ? <>
            <AppText>Dein Passwort wurde geändert.</AppText>
            <Button title="Zur Anmeldung" onPress={goToAccount} />
          </> : submitting ? <>
            <Field label="Sechsstelliger Code" value={code} onChangeText={setCode}
              textContentType="oneTimeCode" inputMode="numeric" maxLength={8} />
            <Field label="Neues Passwort" value={password} onChangeText={setPassword} secureTextEntry
              autoCapitalize="none" autoCorrect={false} textContentType="newPassword" />
            <Button title="Passwort speichern" loading={action.busy}
              disabled={password.length < 8 || code.replace(/\s/g, '').length !== 6} onPress={finish} />
            <Button title="Code erneut senden" variant="secondary" disabled={action.busy} onPress={sendCode} />
          </> : <>
            <AppText>Fordere einen Code für deine E-Mail-Adresse an.</AppText>
            <Field label="E-Mail" value={email} onChangeText={setEmail} keyboardType="email-address"
              textContentType="emailAddress" autoCorrect={false} autoCapitalize="none" />
            <Button title="Code senden" loading={action.busy} disabled={!email.trim()} onPress={sendCode} />
          </>}
          <Notice notice={action.notice} />
          {finished ? null : <Button title="Zurück zur Anmeldung" variant="plain" disabled={action.busy} onPress={goToAccount} />}
        </Card>
      ) : null}
      {session.state.status === 'error' ? (
        <Card>
          <AppText tone="danger">{session.state.error.message}</AppText>
          <Button title="Zum Konto" onPress={goToAccount} />
        </Card>
      ) : null}
    </Screen>
  );
}
