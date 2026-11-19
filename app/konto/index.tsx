import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Keyboard, Linking, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { account } from '../../src/backend';
import { googleAuthEnabled } from '../../src/backend/config';
import { PensumError, type SessionUser } from '../../src/contracts';
import { Notice, useAccountAction } from '../../src/account/forms';
import {
  clearAccountContents, getAccountDevices, requireAccountScope, shareAccountExport,
} from '../../src/account/management';
import { type AccountScope, type EmailCode, useSession } from '../../src/account/session';
import { AppText, Button, Card, ErrorState, Field, LoadingState, Screen, Segmented, ThemeSelector, type SegmentedOption } from '../../src/ui';

const guestTabs = [
  { id: 'login', label: 'Anmeldung' },
  { id: 'app', label: 'App', accessibilityLabel: 'App und Rechtliches' },
] as const;

const accountTabs = [
  { id: 'profile', label: 'Profil' },
  { id: 'access', label: 'Zugang', accessibilityLabel: 'Zugang und Geräte' },
  { id: 'data', label: 'Daten' },
  { id: 'app', label: 'App', accessibilityLabel: 'App und Rechtliches' },
] as const;

function AccountTabs<T extends string>({ options, value, onChange, busy }: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  busy: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const scrollable = fontScale > 1;
  const tabs = (
    <Segmented label="Kontobereiche" role="tablist" fill={!scrollable}
      options={busy ? options.map((option) => ({ ...option, disabled: true })) : options}
      value={value} onChange={onChange} />
  );
  return scrollable ? <ScrollView horizontal keyboardShouldPersistTaps="handled">{tabs}</ScrollView> : tabs;
}

const legalPages = [
  { title: 'Datenschutz', url: 'https://pensum-omega.vercel.app/datenschutz/' },
  { title: 'Nutzungsbedingungen', url: 'https://pensum-omega.vercel.app/nutzungsbedingungen/' },
  { title: 'Impressum', url: 'https://pensum-omega.vercel.app/impressum/' },
] as const;

function LegalLinks() {
  const action = useAccountAction();
  return (
    <Card>
      {legalPages.map(({ title, url }) => (
        <Button key={url} title={title} variant="plain" disabled={action.busy}
          onPress={() => void action.run(() => Linking.openURL(url))} />
      ))}
      <Notice notice={action.notice} />
    </Card>
  );
}

function AppSettings() {
  return <><ThemeSelector /><LegalLinks /></>;
}

export default function AccountScreen() {
  const { state, scope, refresh, logout } = useSession();
  if (state.status === 'loading') return <Screen title="Konto"><LoadingState title="Konto wird geprüft …" /></Screen>;
  if (state.status === 'error') return (
    <Screen title="Konto">
      <ErrorState message={state.error.message} onRetry={() => void refresh()} />
      <Button title="Als Gast fortfahren" variant="secondary" onPress={() => void logout({ discardUnsaved: true }).catch(() => undefined)} />
      <AppSettings />
    </Screen>
  );
  if (state.status === 'account' && scope) {
    return <AccountDetails key={scope.userId} user={state.user} scope={scope} offline={state.connection === 'offline'} />;
  }
  return <GuestAccount />;
}

function GuestAccount() {
  const router = useRouter();
  const session = useSession();
  const action = useAccountAction();
  const [tab, setTab] = useState<typeof guestTabs[number]['id']>('login');
  const [registering, setRegistering] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState<EmailCode | null>(null);
  const [secret, setSecret] = useState('');
  const submit = () => void action.run(async () => {
    if (registering && !ageConfirmed) return;
    const input = { email: email.trim(), password };
    const result = registering ? await session.register({ ...input, name }) : await session.signIn(input);
    setPassword('');
    if (result.kind === 'code') setCode(result.code);
  });

  if (code) return (
    <Screen title="E-Mail bestätigen" description={`Gib den sechsstelligen Code für ${code.email} ein.`}>
      <Card>
        <Notice notice={code.deliveryFailed
          ? { error: true, message: 'Die E-Mail konnte nicht gesendet werden. Fordere einen neuen Code an.' }
          : null}
        />
        <Field label="Bestätigungscode" value={secret} onChangeText={setSecret} inputMode="numeric"
          textContentType="oneTimeCode" maxLength={8} autoCorrect={false} />
        <Button title="E-Mail bestätigen" loading={action.busy} disabled={secret.replace(/\s/g, '').length !== 6}
          onPress={() => void action.run(() => session.confirmCode(code, secret))} />
        <Button title="Code erneut senden" variant="secondary" disabled={action.busy}
          onPress={() => void action.run(async () => { setCode(await session.resendCode(code)); setSecret(''); })} />
        <Button title="Zurück zur Anmeldung" variant="plain" disabled={action.busy}
          onPress={() => { setCode(null); setSecret(''); action.reset(); }} />
        <Notice notice={action.notice} />
      </Card>
    </Screen>
  );

  function selectTab(next: typeof tab) {
    if (tab === next || action.busy) return;
    Keyboard.dismiss();
    setPassword('');
    setTab(next);
  }

  return (
    <Screen title="Konto" description={tab === 'login' ? 'Melde dich an, um deine Lerndaten auf deinen Geräten zu nutzen.' : undefined}>
      <AccountTabs options={guestTabs} value={tab} onChange={selectTab} busy={action.busy} />
      {tab === 'login' ? (
        <>
          <Card>
            <AppText variant="section">{registering ? 'Konto erstellen' : 'Anmelden'}</AppText>
            {registering ? <Field label="Name (optional)" value={name} onChangeText={setName} textContentType="name" maxLength={128} /> : null}
            <Field label="E-Mail" value={email} onChangeText={setEmail} keyboardType="email-address"
              textContentType="emailAddress" autoCorrect={false} autoCapitalize="none" />
            <Field label="Passwort" value={password} onChangeText={setPassword} secureTextEntry
              textContentType={registering ? 'newPassword' : 'password'} autoCapitalize="none" autoCorrect={false} />
            {registering && (
              <View style={styles.ageConfirmation}>
                <AppText style={styles.ageLabel}>Ich bin mindestens 16 Jahre alt.</AppText>
                <Switch accessibilityLabel="Ich bin mindestens 16 Jahre alt" value={ageConfirmed}
                  disabled={action.busy} onValueChange={setAgeConfirmed} />
              </View>
            )}
            <Button title={registering ? 'Konto erstellen' : 'Anmelden'} loading={action.busy}
              disabled={!email.trim() || password.length < (registering ? 8 : 1) || (registering && !ageConfirmed)} onPress={submit} />
            <Button title={registering ? 'Zur Anmeldung' : 'Konto erstellen'} disabled={action.busy} variant="secondary"
              onPress={() => { setRegistering(!registering); setAgeConfirmed(false); setPassword(''); action.reset(); }} />
            <Button title="Passwort vergessen?" variant="plain" disabled={action.busy}
              onPress={() => router.push('/auth/recover')} />
            {googleAuthEnabled ? <Button title="Mit Google anmelden" variant="secondary" disabled={action.busy}
              onPress={() => Alert.alert('Mit Google anmelden', 'Ein neues Pensum-Konto ist ab 16 Jahren möglich.', [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Weiter', onPress: () => void action.run(session.signInWithGoogle) },
              ])} /> : null}
            <Notice notice={action.notice ?? (session.oauthError ? { error: true, message: session.oauthError.message } : null)} />
          </Card>
          <Card>
            <AppText variant="section">Gastmodus</AppText>
            <AppText tone="muted">Gastdaten werden auf diesem Gerät gespeichert.</AppText>
            <Button title="Werkzeuge öffnen" variant="secondary" disabled={action.busy} onPress={() => router.replace('/')} />
          </Card>
        </>
      ) : <AppSettings />}
    </Screen>
  );
}

function ask(title: string, message: string, button: string, confirmed: () => void) {
  Alert.alert(title, message, [
    { text: 'Abbrechen', style: 'cancel' },
    { text: button, style: 'destructive', onPress: confirmed },
  ]);
}

function AccountDetails({ user, scope, offline }: { user: SessionUser; scope: AccountScope; offline: boolean }) {
  const router = useRouter();
  const session = useSession();
  const action = useAccountAction();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletion, setDeletion] = useState('');
  const [devices, setDevices] = useState<Awaited<ReturnType<typeof getAccountDevices>> | null>(null);
  const [tab, setTab] = useState<typeof accountTabs[number]['id']>('profile');
  const disabled = offline || action.busy;
  function selectTab(next: typeof tab) {
    if (next === tab || action.busy) return;
    Keyboard.dismiss();
    setOldPassword('');
    setNewPassword('');
    setDeletion('');
    action.reset();
    setTab(next);
  }
  async function logout(everywhere = false) {
    try {
      await session.logout({ everywhere });
    } catch (error) {
      if (!(error instanceof PensumError) || error.code !== 'storage' || !scope.isCurrent()) throw error;
      ask('Trotzdem abmelden?', error.message + ' Beim Abmelden können diese Änderungen verloren gehen.', 'Trotzdem abmelden',
        () => void action.run(() => session.logout({ everywhere, discardUnsaved: true })));
    }
  }
  const endOtherDevices = async () => {
    const currentDevices = await getAccountDevices(scope);
    for (const device of currentDevices.filter((device) => !device.current)) {
      requireAccountScope(scope);
      await account.deleteSession({ sessionId: device.$id });
    }
    setDevices(await getAccountDevices(scope));
  };

  return (
    <Screen title="Konto" description={user.email}>
      <AccountTabs options={accountTabs} value={tab} onChange={selectTab} busy={action.busy} />
      {tab !== 'app' && offline && (
        <ErrorState title="Offline" message="Kontoeinstellungen brauchen eine Internetverbindung."
          onRetry={() => void session.refresh()} />
      )}
      {tab !== 'app' && <Notice notice={action.notice} />}
      {tab === 'profile' && (
        <>
          <Card>
            <AppText variant="section">{user.name || 'Mein Konto'}</AppText>
            <AppText tone="muted">{user.emailVerified ? 'E-Mail bestätigt' : 'E-Mail noch nicht bestätigt'}</AppText>
            {!user.emailVerified ? <Button title="Bestätigungslink senden" variant="secondary" disabled={disabled}
              onPress={() => void action.run(session.requestEmailVerification, 'Bestätigungslink gesendet.')} /> : null}
            <Button title="Abmelden" variant="secondary" disabled={action.busy}
              onPress={() => void action.run(() => logout())} />
          </Card>
          <Card>
            <AppText variant="section">Profil</AppText>
            <Field label="Name" value={name} onChangeText={setName} textContentType="name" maxLength={128} />
            <Button title="Name speichern" variant="secondary" disabled={disabled || name.trim() === user.name}
              onPress={() => void action.run(async () => {
                requireAccountScope(scope);
                await account.updateName({ name: name.trim() || 'Pensum' });
                await session.refresh();
              }, 'Name gespeichert.')} />
          </Card>
        </>
      )}
      {tab === 'access' && (
        <>
          <Card>
            <AppText variant="section">Zugangsdaten</AppText>
            <Field label="E-Mail-Adresse" value={email} onChangeText={setEmail} keyboardType="email-address"
              autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" />
            <Field label="Aktuelles Passwort" value={oldPassword} onChangeText={setOldPassword} secureTextEntry
              textContentType="password" autoCapitalize="none" autoCorrect={false} />
            <Button title="E-Mail-Adresse ändern" variant="secondary"
              disabled={disabled || !oldPassword || !email.trim() || email.trim() === user.email}
              onPress={() => void action.run(async () => {
                requireAccountScope(scope);
                await account.updateEmail({ email: email.trim(), password: oldPassword });
                setOldPassword('');
                await session.refresh();
              }, 'E-Mail-Adresse geändert. Bestätige deine neue Adresse.')} />
            <Field label="Neues Passwort" value={newPassword} onChangeText={setNewPassword} secureTextEntry
              textContentType="newPassword" autoCapitalize="none" autoCorrect={false} />
            <Button title="Passwort ändern" variant="secondary" disabled={disabled || !oldPassword || newPassword.length < 8}
              onPress={() => void action.run(async () => {
                requireAccountScope(scope);
                await account.updatePassword({ password: newPassword, oldPassword });
                setOldPassword('');
                setNewPassword('');
              }, 'Passwort geändert.')} />
          </Card>
          <Card>
            <AppText variant="section">Geräte</AppText>
            <Button title={devices ? 'Sitzungen aktualisieren' : 'Sitzungen anzeigen'} variant="secondary" disabled={disabled}
              onPress={() => void action.run(async () => { setDevices(await getAccountDevices(scope)); })} />
            {devices?.map((device) => (
              <Card key={device.$id}>
                <AppText>{[device.clientName, device.osName].filter(Boolean).join(' · ') || 'Unbekanntes Gerät'}
                  {device.current ? ' (dieses Gerät)' : ''}</AppText>
                <AppText variant="caption" tone="muted">{new Date(device.$createdAt).toLocaleString('de-DE')}</AppText>
                {device.current ? null : (
                  <Button title="Sitzung beenden" variant="plain" disabled={disabled}
                    onPress={() => void action.run(async () => {
                      requireAccountScope(scope);
                      await account.deleteSession({ sessionId: device.$id });
                      setDevices(await getAccountDevices(scope));
                    }, 'Sitzung beendet.')} />
                )}
              </Card>
            ))}
            {devices?.some((device) => !device.current) ? (
              <Button title="Andere Geräte abmelden" variant="secondary" disabled={disabled}
                onPress={() => void action.run(endOtherDevices, 'Andere Geräte abgemeldet.')} />
            ) : null}
            <Button title="Überall abmelden" variant="secondary" disabled={disabled}
              onPress={() => ask('Überall abmelden?', 'Alle aktiven Sitzungen dieses Kontos werden beendet.', 'Überall abmelden',
                () => void action.run(() => logout(true)))} />
          </Card>
        </>
      )}
      {tab === 'data' && (
        <>
          <Card>
            <AppText variant="section">Daten</AppText>
            <Button title="Kontodaten als JSON teilen" variant="secondary" disabled={disabled}
              onPress={() => void action.run(() => shareAccountExport(scope, user))} />
            <Button title="Lerninhalte im Konto löschen" variant="danger" disabled={disabled}
              onPress={() => ask('Lerninhalte löschen?', 'Deine Fächer, Noten, Mindmaps, Karten, Planereinträge und dein Handschrift-Profil werden gelöscht.', 'Inhalte löschen',
                () => void action.run(() => clearAccountContents(scope), 'Lerninhalte gelöscht.'))} />
          </Card>
          <Card>
            <AppText variant="section">Konto löschen</AppText>
            <AppText tone="muted">Dein Konto und die zugehörigen Daten werden dauerhaft gelöscht.</AppText>
            <Field label="Zur Bestätigung LÖSCHEN eingeben" value={deletion} onChangeText={setDeletion}
              autoCapitalize="characters" maxLength={12} />
            <Button title="Konto endgültig löschen" variant="danger"
              disabled={disabled || deletion.trim().toUpperCase() !== 'LÖSCHEN'}
              onPress={() => ask('Konto endgültig löschen?', 'Dein Konto und seine Daten werden endgültig gelöscht.', 'Endgültig löschen',
                () => void action.run(async () => {
                  if (deletion.trim().toUpperCase() !== 'LÖSCHEN') throw new PensumError('invalid', 'Bestätige die Löschung.');
                  await session.deleteAccount();
                  router.replace('/');
                }))} />
          </Card>
        </>
      )}
      {tab === 'app' && <AppSettings />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ageConfirmation: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ageLabel: { flex: 1 },
});
