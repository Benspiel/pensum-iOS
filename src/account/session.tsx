import 'react-native-url-polyfill/auto';

import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { type Models, OAuthProvider } from 'react-native-appwrite';
import { account, client, executeFunction, functionIds, ID, Query, teams } from '../backend';
import { googleAuthEnabled, teamIds } from '../backend/config';
import { asPensumError, statusCode } from '../backend/errors';
import {
  noToolAccess, PensumError, type SessionState, type SessionUser, type ToolAccess,
} from '../contracts';
import { type AuthLink, callbackUrl, type EmailAuthLink, parseAuthLink } from './links';
import { clearAccountExportCache } from './management';
import { createNativeSession, type SessionCredential } from './transport';
import {
  loadCredential, loadOAuthChallenge, type SavedSession, saveCredential, saveOAuthChallenge,
} from './vault';

export interface EmailCode {
  userId: string;
  email: string;
  deliveryFailed?: boolean;
}

export type SignInResult = { kind: 'account' } | { kind: 'code'; code: EmailCode };
type AuthInput = { email: string; password: string };
export interface AccountScope {
  readonly userId: string;
  isCurrent(): boolean;
}

interface SessionContextValue {
  state: SessionState;
  access: ToolAccess;
  scope: AccountScope | null;
  emailLink: EmailAuthLink | null;
  oauthError: PensumError | null;
  refresh(): Promise<void>;
  signIn(input: AuthInput): Promise<SignInResult>;
  register(input: AuthInput & { name: string }): Promise<SignInResult>;
  resendCode(code: EmailCode): Promise<EmailCode>;
  confirmCode(code: EmailCode, secret: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  startRecovery(email: string): Promise<string>;
  finishRecovery(userId: string, secret: string, password: string): Promise<void>;
  requestRecoveryLink(email: string): Promise<void>;
  finishEmailLink(link: EmailAuthLink, password?: string): Promise<void>;
  requestEmailVerification(): Promise<void>;
  dismissEmailLink(): void;
  updatePrefs(patch: Record<string, unknown>): Promise<void>;
  logout(): Promise<void>;
  deleteAccount(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function profile(model: Models.User<Models.Preferences>): SessionUser {
  return {
    id: model.$id,
    name: model.name,
    email: model.email,
    emailVerified: model.emailVerification,
    registeredAt: model.registration,
    prefs: model.prefs,
  };
}

async function readAccess(): Promise<ToolAccess> {
  const found = new Set<string>();
  let cursor: string | undefined;
  for (;;) {
    const { teams: page } = await teams.list({
      queries: [Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
    });
    for (const team of page) found.add(team.$id);
    const last = page.at(-1);
    if (page.length < 100 || !last) break;
    cursor = last.$id;
  }
  return {
    tester: found.has(teamIds.tester),
    kiTester: found.has(teamIds.kiTester),
    admin: found.has(teamIds.admin),
  };
}

function requireCode(secret: string): string {
  const normalized = secret.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) {
    throw new PensumError('invalid', 'Gib den sechsstelligen Code aus der E-Mail ein.');
  }
  return normalized;
}

function currentUserChanged(): PensumError {
  return new PensumError('unauthenticated', 'Diese Sitzung ist abgelaufen. Melde dich erneut an.');
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [access, setAccess] = useState<ToolAccess>(noToolAccess);
  const [scope, setScope] = useState<AccountScope | null>(null);
  const [emailLink, setEmailLink] = useState<EmailAuthLink | null>(null);
  const [oauthError, setOAuthError] = useState<PensumError | null>(null);

  const credential = useRef<SavedSession | null>(null);
  const activeScope = useRef<AccountScope | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const handledOAuthNonce = useRef<string | null>(null);

  // Serialize changes to the shared SDK credential and its SecureStore record.
  const exclusive = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.current.then(operation);
    queue.current = result.catch(() => undefined);
    return result;
  }, []);

  const publish = useCallback((next: SessionState, nextAccess: ToolAccess = noToolAccess) => {
    const userId = next.status === 'account' ? next.user.id : null;
    if (userId !== (activeScope.current?.userId ?? null)) {
      const nextScope: AccountScope | null = userId
        ? { userId, isCurrent: () => activeScope.current === nextScope }
        : null;
      activeScope.current = nextScope;
      setScope(nextScope);
    }
    setAccess(nextAccess);
    setState(next);
  }, []);

  const clearSession = useCallback(async (revoke: boolean) => {
    const request = revoke && credential.current
      ? account.deleteSession({ sessionId: 'current' }).catch(() => undefined)
      : undefined;
    credential.current = null;
    client.setSession('');
    // Invalidate pending account writes and results before revoking the stored credential.
    activeScope.current = null;
    setEmailLink(null);
    setOAuthError(null);
    clearAccountExportCache();
    try {
      await saveCredential(null);
      await saveOAuthChallenge(null);
      setScope(null);
      publish({ status: 'guest' });
    } catch (error) {
      setScope(null);
      publish({ status: 'error', error: asPensumError(error) });
      throw error;
    } finally {
      // Remote revocation does not delay signing out of the device when offline.
      void request;
    }
  }, [publish]);

  const restore = useCallback(async () => {
    try {
      const stored = credential.current ?? await loadCredential();
      if (!stored) {
        publish({ status: 'guest' });
        return;
      }
      if (!stored.secret || !stored.userId || !(Date.parse(stored.expiresAt) > Date.now())) {
        await clearSession(false);
        return;
      }

      client.setSession(stored.secret);
      credential.current = stored;
      let user: SessionUser;
      try {
        user = profile(await account.get());
      } catch (error) {
        const normalized = asPensumError(error);
        if (normalized.status === 401) {
          await clearSession(false);
          return;
        }
        if (normalized.code === 'offline' && stored.profile?.id === stored.userId) {
          publish({ status: 'account', connection: 'offline', user: { ...stored.profile, prefs: {} } });
          return;
        }
        throw normalized;
      }
      if (user.id !== stored.userId) {
        await clearSession(true);
        throw currentUserChanged();
      }

      const { prefs: _prefs, ...cachedProfile } = user;
      if (JSON.stringify(stored.profile) !== JSON.stringify(cachedProfile)) {
        const updated = { ...stored, profile: cachedProfile };
        await saveCredential(updated);
        credential.current = updated;
      }
      const roles = await readAccess().catch(() => noToolAccess);
      publish({ status: 'account', user, connection: 'online' }, roles);
    } catch (error) {
      client.setSession('');
      publish({ status: 'error', error: asPensumError(error) });
    }
  }, [clearSession, publish]);

  const refresh = useCallback(() => exclusive(restore), [exclusive, restore]);

  useEffect(() => {
    clearAccountExportCache();
    void refresh();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const sendCode = useCallback(async ({ userId, email }: EmailCode): Promise<EmailCode> => {
    try {
      const token = await account.createEmailToken({ userId, email });
      return { userId: token.userId, email };
    } catch {
      return { userId, email, deliveryFailed: true };
    }
  }, []);

  const requireGuest = useCallback(() => {
    if (credential.current || activeScope.current) {
      throw new PensumError('conflict', 'Melde dich zuerst von deinem aktuellen Konto ab.');
    }
  }, []);

  const useNewCredential = useCallback(async (next: SessionCredential): Promise<SessionUser> => {
    client.setSession(next.secret);
    credential.current = next;
    try {
      const user = profile(await account.get());
      if (user.id !== next.userId) throw currentUserChanged();
      return user;
    } catch (error) {
      await clearSession(true);
      throw error;
    }
  }, [clearSession]);

  const finishSignIn = useCallback(async (user: SessionUser) => {
    const current = credential.current;
    if (!current || current.userId !== user.id) throw currentUserChanged();
    const { prefs: _prefs, ...cachedProfile } = user;
    const saved = { ...current, profile: cachedProfile };
    try {
      await saveCredential(saved);
    } catch (error) {
      await clearSession(true);
      throw error;
    }
    credential.current = saved;
    const roles = await readAccess().catch(() => noToolAccess);
    publish({ status: 'account', user, connection: 'online' }, roles);
  }, [clearSession, publish]);

  const signInInternal = useCallback(async ({ email, password }: AuthInput): Promise<SignInResult> => {
    requireGuest();
    const user = await useNewCredential(await createNativeSession('/account/sessions/email', {
      email: email.trim(), password,
    }));
    if (!user.emailVerified) {
      await clearSession(true);
      return { kind: 'code', code: await sendCode({ userId: user.id, email: user.email }) };
    }
    await finishSignIn(user);
    return { kind: 'account' };
  }, [clearSession, finishSignIn, requireGuest, sendCode, useNewCredential]);

  const signIn = useCallback((input: AuthInput) => exclusive(() => signInInternal(input)),
    [exclusive, signInInternal]);

  const register = useCallback((input: AuthInput & { name: string }) => exclusive(async (): Promise<SignInResult> => {
    requireGuest();
    const email = input.email.trim();
    const userId = ID.unique();
    try {
      await account.create({ userId, email, password: input.password, name: input.name.trim() || undefined });
    } catch (error) {
      if (statusCode(error) !== 409) throw error;
      try {
        return await signInInternal(input);
      } catch (loginError) {
        if (statusCode(loginError) === 401) throw error;
        throw loginError;
      }
    }
    return { kind: 'code', code: await sendCode({ userId, email }) };
  }), [exclusive, requireGuest, sendCode, signInInternal]);

  const resendCode = useCallback((code: EmailCode) => exclusive(async () => {
    requireGuest();
    return sendCode(code);
  }), [exclusive, requireGuest, sendCode]);

  const confirmCode = useCallback((code: EmailCode, secret: string) => exclusive(async () => {
    requireGuest();
    const user = await useNewCredential(await createNativeSession('/account/sessions/token', {
      userId: code.userId, secret: requireCode(secret),
    }));
    if (!user.emailVerified) {
      await clearSession(true);
      throw new PensumError('invalid', 'Die E-Mail-Adresse konnte noch nicht bestätigt werden.');
    }
    await finishSignIn(user);
  }), [clearSession, exclusive, finishSignIn, requireGuest, useNewCredential]);

  const finishOAuth = useCallback((link: Extract<AuthLink, { kind: 'oauth' | 'oauth-failure' }>) =>
    exclusive(async () => {
      if (handledOAuthNonce.current === link.nonce) return;
      const challenge = await loadOAuthChallenge();
      if (!challenge || challenge.nonce !== link.nonce || challenge.endsAt < Date.now()) {
        throw new PensumError('invalid', 'Diese Google-Anmeldung ist abgelaufen. Starte sie erneut.');
      }
      requireGuest();
      await saveOAuthChallenge(null);
      handledOAuthNonce.current = link.nonce;
      if (link.kind === 'oauth-failure') {
        throw new PensumError('cancelled', 'Die Google-Anmeldung wurde nicht abgeschlossen.');
      }
      const user = await useNewCredential(await createNativeSession('/account/sessions/token', {
        userId: link.userId, secret: link.secret,
      }));
      if (!user.emailVerified) {
        await clearSession(true);
        throw new PensumError('invalid', 'Google hat keine bestätigte E-Mail-Adresse übertragen.');
      }
      await finishSignIn(user);
    }), [clearSession, exclusive, finishSignIn, requireGuest, useNewCredential]);

  const acceptLink = useCallback((url: string) => {
    const link = parseAuthLink(url);
    if (!link) return;
    if (link.kind === 'oauth' || link.kind === 'oauth-failure') {
      if (!googleAuthEnabled) return;
      void finishOAuth(link).catch((error) => setOAuthError(asPensumError(error)));
    } else {
      setEmailLink(link);
    }
  }, [finishOAuth]);

  useEffect(() => {
    let active = true;
    void Linking.getInitialURL().then((url) => {
      if (url && active) acceptLink(url);
    }).catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => acceptLink(url));
    return () => {
      active = false;
      subscription.remove();
    };
  }, [acceptLink]);

  const signInWithGoogle = useCallback(async () => {
    if (!googleAuthEnabled) {
      throw new PensumError('forbidden', 'Google-Anmeldung ist für diesen Build nicht aktiviert.');
    }
    const nonce = Crypto.randomUUID();
    const base = callbackUrl('oauth');
    const loginUrl = await exclusive(async () => {
      requireGuest();
      setOAuthError(null);
      await saveOAuthChallenge({ nonce, endsAt: Date.now() + 10 * 60_000 });
      // Appwrite 2.3 preserves callback query parameters. The separate OAuth
      // state SDK parameter is not implemented by this self-hosted version.
      return account.createOAuth2Token({
        provider: OAuthProvider.Google,
        success: `${base}?nonce=${nonce}`,
        failure: `${base}?nonce=${nonce}&failed=1`,
      });
    });

    if (!loginUrl) throw new PensumError('server', 'Google-Anmeldung konnte nicht gestartet werden.');
    try {
      const result = await WebBrowser.openAuthSessionAsync(String(loginUrl), base, {
        preferEphemeralSession: true,
      });
      if (result.type !== 'success') {
        throw new PensumError('cancelled', 'Die Google-Anmeldung wurde abgebrochen.');
      }

      const link = parseAuthLink(result.url);
      if (link?.kind !== 'oauth' && link?.kind !== 'oauth-failure') {
        throw new PensumError('invalid', 'Die Google-Anmeldung hat keinen gültigen Rücksprung gesendet.');
      }
      if (link.nonce !== nonce) throw new PensumError('invalid', 'Der Rücksprung gehört zu einer anderen Anmeldung.');
      await finishOAuth(link);
    } finally {
      await exclusive(async () => {
        const pending = await loadOAuthChallenge();
        if (pending?.nonce === nonce) await saveOAuthChallenge(null);
      });
    }
  }, [exclusive, finishOAuth, requireGuest]);

  const startRecovery = useCallback((email: string) => exclusive(async () => {
    requireGuest();
    return (await account.createRecoveryOTP({ email: email.trim() })).userId;
  }), [exclusive, requireGuest]);

  const finishRecovery = useCallback((userId: string, secret: string, password: string) => exclusive(async () => {
    requireGuest();
    await account.updateRecoveryOTP({ userId, secret: requireCode(secret), password });
  }), [exclusive, requireGuest]);

  const requestRecoveryLink = useCallback((email: string) => exclusive(async () => {
    requireGuest();
    await account.createRecovery({ email: email.trim(), url: callbackUrl('recover') });
  }), [exclusive, requireGuest]);

  const finishEmailLink = useCallback((link: EmailAuthLink, password?: string) => exclusive(async () => {
    if (link.kind === 'recover') {
      if (!password || password.length < 8) throw new PensumError('invalid', 'Gib mindestens acht Zeichen ein.');
      if (credential.current && credential.current.userId !== link.userId) throw currentUserChanged();
      await account.updateRecovery({ userId: link.userId, secret: link.secret, password });
      if (credential.current) await clearSession(true);
    } else {
      if (credential.current && credential.current.userId !== link.userId) throw currentUserChanged();
      await account.updateEmailVerification({ userId: link.userId, secret: link.secret });
      if (credential.current) await restore();
    }
    setEmailLink(null);
  }), [clearSession, exclusive, restore]);

  const requestEmailVerification = useCallback(() => exclusive(async () => {
    if (!activeScope.current) throw currentUserChanged();
    await account.createEmailVerification({ url: callbackUrl('verify') });
  }), [exclusive]);

  const dismissEmailLink = useCallback(() => setEmailLink(null), []);

  const updatePrefs = useCallback((patch: Record<string, unknown>) => exclusive(async () => {
    if (!activeScope.current) throw currentUserChanged();
    const current = await account.get();
    await account.updatePrefs({ prefs: { ...current.prefs, ...patch } });
    await restore();
  }), [exclusive, restore]);

  const logout = useCallback(() => exclusive(() => clearSession(true)), [clearSession, exclusive]);

  const deleteAccount = useCallback(() => exclusive(async () => {
    if (!activeScope.current) throw currentUserChanged();
    const result = await executeFunction<{ ok: boolean }>(functionIds.deleteAccount, {});
    if (!result?.ok) throw new PensumError('server', 'Das Konto konnte nicht vollständig gelöscht werden.');
    await clearSession(false);
  }), [clearSession, exclusive]);

  const value = useMemo<SessionContextValue>(() => ({
    state, access, scope, emailLink, oauthError, refresh, signIn, register, resendCode, confirmCode,
    signInWithGoogle, startRecovery, finishRecovery, requestRecoveryLink, finishEmailLink,
    requestEmailVerification, dismissEmailLink, updatePrefs, logout, deleteAccount,
  }), [state, access, scope, emailLink, oauthError, refresh, signIn, register, resendCode, confirmCode,
    signInWithGoogle, startRecovery, finishRecovery, requestRecoveryLink, finishEmailLink,
    requestEmailVerification, dismissEmailLink, updatePrefs, logout, deleteAccount]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const session = useContext(SessionContext);
  if (!session) throw new Error('SessionProvider fehlt.');
  return session;
}
