import { useRef, useState } from 'react';
import { Alert } from 'react-native';

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Die Aktion ist fehlgeschlagen. Versuch es erneut.';
}

export function confirmAction(title: string, message: string, label: string, destructive = false) {
  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: 'Abbrechen', style: 'cancel', onPress: () => resolve(false) },
      { text: label, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export function consentToGemini(description: string) {
  return confirmAction(
    'Inhalt an Google Gemini senden?',
    `${description} wird für diese Anfrage über Pensum an Google Gemini gesendet. Entferne vorher Namen und andere persönliche Angaben.`,
    'Zustimmen und senden',
  );
}

export function useToolAction() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return { busy, error, setError, run };
}
