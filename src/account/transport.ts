import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';
import { client } from '../backend';
import { bundleIdentifier, endpoint, projectId } from '../backend/config';
import { asPensumError, httpError } from '../backend/errors';
import { PensumError } from '../contracts';
import { readSessionCookie } from './session-cookie';

export interface SessionCredential {
  secret: string;
  userId: string;
  expiresAt: string;
}

/**
 * SDK 1.3.0 uses the platform cookie jar and only reads X-Fallback-Cookies on web.
 * Mint sessions with Expo's credential-free fetch so Keychain is the only
 * persisted credential and an offline logout can remove the local copy.
 */
export async function createNativeSession(
  path: '/account/sessions/email' | '/account/sessions/token',
  payload: Record<string, string>,
): Promise<SessionCredential> {
  try {
    const response = await fetch(`${endpoint}${path}`, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        ...client.getHeaders(),
        'X-Appwrite-Session': '',
        'X-Appwrite-Project': projectId,
        Origin: `appwrite-${Platform.OS}://${bundleIdentifier}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const detail = await response.json().catch(() => null);
    if (!response.ok) {
      const message = detail?.type === 'general_unknown_origin'
        ? 'Die iOS-App muss zuerst in Appwrite als Apple-Plattform registriert werden.'
        : detail?.type === 'user_invalid_credentials' || detail?.type === 'user_blocked'
          ? 'E-Mail oder Passwort ist falsch.'
          : detail?.type === 'user_invalid_token' || detail?.type === 'user_invalid_code'
            ? 'Der Code ist ungültig oder abgelaufen.'
            : undefined;
      throw httpError(response.status, message);
    }
    const secret = readSessionCookie(projectId, response.headers.get('x-fallback-cookies'));
    if (!secret || typeof detail?.userId !== 'string' || !Number.isFinite(Date.parse(detail?.expire))) {
      throw new PensumError('server', 'Pensum konnte die Sitzung auf diesem Gerät nicht sichern.');
    }
    return { secret, userId: detail.userId, expiresAt: detail.expire };
  } catch (error) {
    throw asPensumError(error);
  }
}
