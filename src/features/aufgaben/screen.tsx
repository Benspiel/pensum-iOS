import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { documents } from '../../../modules/pensum-documents';
import { executeFunction, functionIds } from '../../backend';
import { useAccountGuard } from '../appwrite-tools/account-scope';
import { radius, spacing } from '../../theme';
import { AppText, Button, Card, ErrorState, Field, Screen } from '../../ui';
import { consentToGemini, errorText, useToolAction } from '../appwrite-tools/actions';
import { pickPhoto, prepareImage, removeTemporaryFile, type ImageSource } from '../appwrite-tools/images';
import { putHandoff } from '../shared/handoff';

type Usage = { runs: number; maxRuns: number };
type Status = { usage: Usage };
type FieldAnswer = { id: string | number; label: string; text: string; box: [number, number, number, number] };
type Worksheet = ImageSource & { rendered?: boolean };
type SelectedPdf = { uri: string; name: string; page: number; pages: number };

export function AufgabenScreen() {
  const router = useRouter();
  const action = useToolAction();
  const requireAccount = useAccountGuard();
  const [sheet, setSheet] = useState<Worksheet | null>(null);
  const [pdf, setPdf] = useState<SelectedPdf>();
  const [fields, setFields] = useState<FieldAnswer[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [usage, setUsage] = useState<Usage>();
  const [statusError, setStatusError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [handwritten, setHandwritten] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(0);
  const pdfUri = pdf?.uri;
  const renderedUri = sheet?.rendered ? sheet.uri : undefined;

  useEffect(() => {
    let active = true;
    executeFunction<Status>(functionIds.aufgaben, { action: 'status' })
      .then((value) => { if (active) { setUsage(value.usage); setStatusError(''); } })
      .catch((reason: unknown) => { if (active) setStatusError(errorText(reason)); });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => () => { if (pdfUri) removeTemporaryFile(pdfUri); }, [pdfUri]);
  useEffect(() => () => { if (renderedUri) removeTemporaryFile(renderedUri); }, [renderedUri]);

  function replaceSheet(value: Worksheet, selectedPdf?: SelectedPdf) {
    setPdf(selectedPdf);
    setSheet(value);
    setFields([]);
    setSkipped([]);
  }

  function choosePhoto(source: 'camera' | 'library') {
    void action.run(async () => {
      const photo = await pickPhoto(source);
      if (photo) replaceSheet(photo);
    });
  }

  function choosePdf() {
    void action.run(async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      const file = result.assets?.[0];
      if (!file) return;
      try {
        if (file.size !== undefined && file.size > 25 * 1024 * 1024) throw new Error('Das PDF ist größer als 25 MB.');
        const native = documents();
        const pages = await native.pdfPageCount(file.uri);
        const image = await native.renderPDFPage(file.uri, 1);
        replaceSheet({ ...image, rendered: true }, { uri: file.uri, name: file.name, page: 1, pages });
      } catch (reason) {
        removeTemporaryFile(file.uri);
        throw reason;
      }
    });
  }

  function selectPage(page: number) {
    if (!pdf || page < 1 || page > pdf.pages) return;
    void action.run(async () => {
      const rendered = await documents().renderPDFPage(pdf.uri, page);
      replaceSheet({ ...rendered, rendered: true }, { ...pdf, page });
    });
  }

  function solve() {
    if (!sheet) return;
    void action.run(async () => {
      if (!await consentToGemini('Das ausgewählte Arbeitsblatt')) return;
      const image = await prepareImage(sheet, 2000);
      try {
        requireAccount();
        const result = await executeFunction<Status & { fields: FieldAnswer[]; skipped: string[] }>(
          functionIds.aufgaben, { action: 'solve', image: image.base64 },
        );
        setUsage(result.usage);
        setFields(result.fields);
        setSkipped(result.skipped);
      } catch (reason) {
        setAttempt((value) => value + 1);
        throw reason;
      }
    });
  }

  function share(asPdf: boolean) {
    if (!sheet) return;
    void action.run(async () => {
      if (!await Sharing.isAvailableAsync()) throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
      const uri = await documents().exportWorksheet(sheet.uri, fields.map(({ box, text }) => ({ box, text })), handwritten, asPdf);
      try {
        await Sharing.shareAsync(uri, { mimeType: asPdf ? 'application/pdf' : 'image/png', dialogTitle: 'Arbeitsblatt teilen' });
      } finally {
        removeTemporaryFile(uri);
      }
    });
  }

  return (
    <Screen title="Aufgaben" description="Lass Vorschläge für ein Arbeitsblatt erstellen und prüfe die Antworten vor dem Export.">
      {usage && <AppText tone="muted">Durchläufe heute · {usage.runs} von {usage.maxRuns}</AppText>}
      {statusError !== '' && <ErrorState message={statusError} onRetry={() => setAttempt((value) => value + 1)} />}
      {action.error !== '' && <ErrorState message={action.error} />}
      <Card>
        <AppText variant="section">Arbeitsblatt</AppText>
        <View style={styles.actions}>
          <Button title="Foto aufnehmen" variant="secondary" disabled={action.busy} onPress={() => choosePhoto('camera')} />
          <Button title="Foto wählen" variant="secondary" disabled={action.busy} onPress={() => choosePhoto('library')} />
          <Button title="PDF wählen" variant="secondary" disabled={action.busy} onPress={choosePdf} />
        </View>
        {pdf && (
          <>
            <AppText tone="muted">{pdf.name} · Seite {pdf.page} von {pdf.pages}</AppText>
            {pdf.pages > 1 && (
              <View style={styles.actions}>
                <Button title="Vorherige Seite" variant="plain" haptic="select" disabled={action.busy || pdf.page === 1} onPress={() => selectPage(pdf.page - 1)} />
                <Button title="Nächste Seite" variant="plain" haptic="select" disabled={action.busy || pdf.page === pdf.pages} onPress={() => selectPage(pdf.page + 1)} />
              </View>
            )}
          </>
        )}
        {sheet && (
          <View
            style={[styles.preview, { aspectRatio: sheet.width / sheet.height }]}
            onLayout={({ nativeEvent }) => setPreviewWidth(nativeEvent.layout.width)}
          >
            <Image source={{ uri: sheet.uri }} style={StyleSheet.absoluteFill} resizeMode="stretch" accessibilityLabel="Ausgewähltes Arbeitsblatt" />
            {fields.map(({ id, box: [top, left, bottom, right], text }) => (
              <View accessible={false} key={id} pointerEvents="none" style={{
                position: 'absolute', left: `${left / 10}%`, top: `${top / 10}%`,
                width: `${(right - left) / 10}%`, height: `${(bottom - top) / 10}%`, overflow: 'hidden',
              }}>
                <AppText accessible={false} allowFontScaling={false} style={{
                  color: '#1d3f9e', fontSize: Math.max(5, Math.min(previewWidth * 0.027, (bottom - top) * previewWidth * sheet.height / sheet.width / 1300)),
                  lineHeight: undefined, ...(handwritten ? { fontFamily: 'BradleyHandITCTT-Bold' } : {}),
                }} adjustsFontSizeToFit>
                  {text}
                </AppText>
              </View>
            ))}
          </View>
        )}
        <Button title="Vorschläge erstellen" haptic="send" loading={action.busy} disabled={!sheet || Boolean(usage && usage.runs >= usage.maxRuns)} onPress={solve} />
      </Card>
      {fields.length > 0 && (
        <Card>
          <AppText variant="section">Antworten überarbeiten</AppText>
          {fields.map((field, index) => (
            <Field key={field.id} label={field.label || `Antwort ${index + 1}`} value={field.text} multiline maxLength={800} editable={!action.busy}
              onChangeText={(text) => setFields((value) => value.map((answer) => answer.id === field.id ? { ...answer, text } : answer))} />
          ))}
          {skipped.length > 0 && <AppText tone="muted">{skipped.join('\n')}</AppText>}
          <View style={styles.actions}>
            <Button title="Normale Schrift" variant={handwritten ? 'secondary' : 'primary'} haptic="select" onPress={() => setHandwritten(false)} disabled={action.busy} />
            <Button title="Handschriftstil" variant={handwritten ? 'primary' : 'secondary'} haptic="select" onPress={() => setHandwritten(true)} disabled={action.busy} />
          </View>
          <View style={styles.actions}>
            <Button title="PDF teilen" variant="secondary" haptic="send" onPress={() => share(true)} disabled={action.busy} />
            <Button title="Bild teilen" variant="secondary" haptic="send" onPress={() => share(false)} disabled={action.busy} />
          </View>
          <Button title="Antworttexte in Goodnotes-Tool übernehmen" variant="secondary" disabled={action.busy} onPress={() => {
            putHandoff(fields.map((field) => field.text).filter((text) => text.trim()).join('\n'), 'Arbeitsblatt');
            router.push('/tools/goodnotes');
          }} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  /** Vorschau wie eine Fläche der App: Radius 16, Inhalt beschnitten */
  preview: {
    width: '100%', alignSelf: 'center', maxWidth: 640,
    borderRadius: radius.field, borderCurve: 'continuous', overflow: 'hidden',
  },
});
