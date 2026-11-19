import { useRef, useState } from 'react';
import { asPensumError, statusCode } from '../backend/errors';
import { PensumError } from '../contracts';
import { AppText } from '../ui';

export function useAccountAction() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; message: string } | null>(null);

  async function run(task: () => Promise<void>, success?: string) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await task();
      if (success) setNotice({ error: false, message: success });
    } catch (error) {
      setNotice({ error: true, message: accountErrorMessage(error) });
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return { busy, notice, run, reset: () => setNotice(null) };
}

function accountErrorMessage(error: unknown): string {
  if (error instanceof PensumError) return error.message;
  const type = error && typeof error === 'object' && 'type' in error && typeof error.type === 'string'
    ? error.type : '';
  if (type === 'general_unknown_origin') return 'Die iOS-App muss zuerst in Appwrite als Apple-Plattform registriert werden.';
  if (type === 'user_invalid_credentials' || type === 'user_blocked') return 'E-Mail oder Passwort ist falsch.';
  if (type === 'user_invalid_token' || type === 'user_invalid_code') return 'Der Link oder Code ist ungültig oder abgelaufen.';
  if (type === 'user_password_recently_used') return 'Wähle ein Passwort, das du noch nicht verwendet hast.';
  if (statusCode(error) === 409) return 'Zu dieser E-Mail gibt es schon ein Konto.';
  return asPensumError(error).message;
}

export function Notice({ notice }: { notice: { error: boolean; message: string } | null }) {
  if (!notice) return null;
  return (
    <AppText accessibilityRole="alert" aria-live="polite" tone={notice.error ? 'danger' : 'default'}>
      {notice.message}
    </AppText>
  );
}
