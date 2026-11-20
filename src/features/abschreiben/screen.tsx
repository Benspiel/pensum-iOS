import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { executeFunction, functionIds } from '../../backend';
import { useAccountGuard } from '../appwrite-tools/account-scope';
import { radius } from '../../theme';
import { AppText, Button, Card, ErrorState, Field, Screen } from '../../ui';
import { consentToGemini, errorText, useToolAction } from '../appwrite-tools/actions';
import { pickPhoto, prepareImage, type ImageSource } from '../appwrite-tools/images';
import { putHandoff } from '../shared/handoff';

type Usage = { scans: number; maxScans: number };
type ScanStatus = { usage: Usage };

function suggestName(text: string) {
  const line = text.split('\n')
    .map((value) => value.replace(/^#+\s*/, '').replace(/^[-*]\s+/, '').trim())
    .find((value) => value && !/^\[.*\]$/.test(value));
  return line?.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40).trim() || 'Tafelbild';
}

export function AbschreibenScreen() {
  const router = useRouter();
  const action = useToolAction();
  const requireAccount = useAccountGuard();
  const [photo, setPhoto] = useState<ImageSource | null>(null);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [usage, setUsage] = useState<Usage>();
  const [statusError, setStatusError] = useState('');
  const [statusAttempt, setStatusAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    executeFunction<ScanStatus>(functionIds.abschreiben, { action: 'status' })
      .then((result) => { if (active) { setUsage(result.usage); setStatusError(''); } })
      .catch((reason: unknown) => { if (active) setStatusError(errorText(reason)); });
    return () => { active = false; };
  }, [statusAttempt]);

  function choosePhoto(source: 'camera' | 'library') {
    void action.run(async () => {
      const selected = await pickPhoto(source);
      if (selected) {
        setPhoto(selected);
        setText('');
        setCopied(false);
      }
    });
  }

  function scan() {
    if (!photo) return;
    void action.run(async () => {
      if (!await consentToGemini('Dein Tafelbild')) return;
      const image = await prepareImage(photo);
      try {
        requireAccount();
        const result = await executeFunction<ScanStatus & { text: string }>(
          functionIds.abschreiben, { action: 'scan', image: image.base64 },
        );
        setText(result.text);
        setCopied(false);
        setUsage(result.usage);
      } catch (reason) {
        setStatusAttempt((attempt) => attempt + 1);
        throw reason;
      }
    });
  }

  return (
    <Screen title="Abschreiben" description="Erkenne den Text auf einem Tafelbild und bearbeite ihn weiter.">
      {usage && <AppText tone="muted">Scans heute · {usage.scans} von {usage.maxScans}</AppText>}
      {statusError !== '' && (
        <ErrorState title="Tageslimit konnte nicht geladen werden" message={statusError} onRetry={() => setStatusAttempt((value) => value + 1)} />
      )}
      <Card>
        <AppText variant="section">Tafelbild</AppText>
        {photo && <Image source={{ uri: photo.uri }} style={[styles.preview, { aspectRatio: photo.width / photo.height }]} accessibilityLabel="Ausgewähltes Tafelbild" />}
        <View style={styles.actions}>
          <Button title="Foto aufnehmen" variant="secondary" disabled={action.busy} onPress={() => choosePhoto('camera')} />
          <Button title="Foto wählen" variant="secondary" disabled={action.busy} onPress={() => choosePhoto('library')} />
          {photo && <Button title="Entfernen" variant="plain" haptic="warn" disabled={action.busy} onPress={() => { setPhoto(null); setText(''); setCopied(false); }} />}
        </View>
        <Button title="Text erkennen" haptic="send" onPress={scan} loading={action.busy} disabled={!photo || Boolean(usage && usage.scans >= usage.maxScans)} />
      </Card>
      {action.error !== '' && <ErrorState message={action.error} />}
      {text !== '' && (
        <Card>
          <Field label="Erkannter Text" value={text} onChangeText={(value) => { setText(value); setCopied(false); }} multiline />
          <Button title={copied ? 'Kopiert' : 'Text kopieren'} variant="secondary" onPress={() => void action.run(async () => { await Clipboard.setStringAsync(text); setCopied(true); })} disabled={action.busy || !text.trim()} />
          <Button title="In Goodnotes-Tool übernehmen" onPress={() => { putHandoff(text, suggestName(text)); router.push('/tools/goodnotes'); }} disabled={action.busy || !text.trim()} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', maxHeight: 320, borderRadius: radius.field, borderCurve: 'continuous', resizeMode: 'contain' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
