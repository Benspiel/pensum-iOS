import { PensumError, type PensumErrorCode } from '../contracts';

const errorCopy: Record<PensumErrorCode, string> = {
  offline: 'Keine Verbindung zu Pensum. Prüfe deine Internetverbindung.',
  unauthenticated: 'Bitte melde dich an.',
  forbidden: 'Für dein Konto fehlt die erforderliche Berechtigung.',
  invalid: 'Prüfe deine Eingaben und versuch es noch einmal.',
  'not-found': 'Der Eintrag wurde nicht gefunden.',
  conflict: 'Der Eintrag existiert bereits.',
  'rate-limit': 'Zu viele Versuche. Warte kurz und versuch es noch einmal.',
  cancelled: 'Der Vorgang wurde abgebrochen.',
  storage: 'Die Daten konnten auf diesem Gerät nicht gespeichert werden.',
  server: 'Pensum ist vorübergehend nicht erreichbar. Versuch es später noch einmal.',
  unknown: 'Das hat nicht geklappt. Versuch es noch einmal.',
};

export function statusCode(error: unknown): number | undefined {
  if (error instanceof PensumError) return error.status;
  if (error && typeof error === 'object' && 'code' in error &&
      typeof error.code === 'number' && error.code >= 100) return error.code;
  return undefined;
}

function codeForStatus(status: number): PensumErrorCode {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate-limit';
  if (status >= 500) return 'server';
  if (status >= 400) return 'invalid';
  return 'unknown';
}

export function httpError(status: number, message?: string, cause?: unknown): PensumError {
  const code = codeForStatus(status);
  return new PensumError(code, message || errorCopy[code], status, { cause });
}

export function asPensumError(error: unknown): PensumError {
  if (error instanceof PensumError) return error;
  const status = statusCode(error);
  if (status !== undefined) return httpError(status, undefined, error);

  // React Native fetch rejects with TypeError, while the Appwrite service may wrap
  // a failed request in AppwriteException with code 0.
  const offline = error instanceof TypeError ||
    (error instanceof Error && /network request failed|fetch failed|timed? out|could not connect/i.test(error.message));
  const code = offline ? 'offline' : 'unknown';
  return new PensumError(code, errorCopy[code], undefined, { cause: error });
}
