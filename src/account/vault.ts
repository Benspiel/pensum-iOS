import * as SecureStore from 'expo-secure-store';
import { PensumError, type SessionUser } from '../contracts';
import type { SessionCredential } from './transport';

const sessionKey = 'pensum.auth.session.v1';
const oauthKey = 'pensum.auth.oauth.v1';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
/* Im Browser gibt es keinen Schlüsselbund: dort liegt die Anmeldung wie auf der Website im localStorage dieses Browsers. */
const web = process.env.EXPO_OS === 'web';

export interface SavedSession extends SessionCredential {
  profile?: Omit<SessionUser, 'prefs'>;
}

interface OAuthChallenge {
  nonce: string;
  endsAt: number;
}

async function read<T>(key: string): Promise<T | null> {
  try {
    const value = web ? window.localStorage.getItem(key) : await SecureStore.getItemAsync(key, options);
    return value ? JSON.parse(value) as T : null;
  } catch (error) {
    throw new PensumError('storage', 'Der sichere Gerätespeicher ist gerade nicht verfügbar.', undefined, { cause: error });
  }
}

async function write(key: string, value: object | null): Promise<void> {
  try {
    if (web) {
      if (value) window.localStorage.setItem(key, JSON.stringify(value));
      else window.localStorage.removeItem(key);
    } else if (value) await SecureStore.setItemAsync(key, JSON.stringify(value), options);
    else await SecureStore.deleteItemAsync(key, options);
  } catch (error) {
    throw new PensumError('storage', 'Der sichere Gerätespeicher konnte nicht aktualisiert werden.', undefined, { cause: error });
  }
}

export const loadCredential = () => read<SavedSession>(sessionKey);
export const saveCredential = (credential: SavedSession | null) => write(sessionKey, credential);
export const loadOAuthChallenge = () => read<OAuthChallenge>(oauthKey);
export const saveOAuthChallenge = (challenge: OAuthChallenge | null) => write(oauthKey, challenge);
