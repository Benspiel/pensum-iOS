import { appwriteCallbackScheme } from '../backend/config';

export type AuthLink =
  | { kind: 'oauth'; nonce: string; userId: string; secret: string }
  | { kind: 'oauth-failure'; nonce: string }
  | { kind: 'recover' | 'verify'; userId: string; secret: string };

export type EmailAuthLink = Extract<AuthLink, { kind: 'recover' | 'verify' }>;

export function callbackUrl(path: 'oauth' | 'recover' | 'verify'): string {
  return `${appwriteCallbackScheme}://auth/${path}`;
}

/** Accept only the routes this app generated. Malformed or duplicate credentials are rejected. */
export function parseAuthLink(input: string): AuthLink | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (url.protocol !== `${appwriteCallbackScheme}:` || url.username || url.password ||
      url.port || url.hash) return null;
  const path = url.hostname ? `/${url.hostname}${url.pathname}` : url.pathname;
  const query = url.searchParams;
  if (['userId', 'secret', 'nonce', 'failed'].some((key) => query.getAll(key).length > 1)) return null;

  const userId = query.get('userId') ?? '';
  const secret = query.get('secret') ?? '';
  const validUserId = /^[a-z0-9][a-z0-9._-]{0,35}$/i.test(userId);
  const validSecret = secret.length > 0 && secret.length <= 4096 && !/\s/.test(secret);
  if (path === '/auth/oauth') {
    const nonce = query.get('nonce') ?? '';
    if (!/^[a-f0-9-]{36}$/i.test(nonce)) return null;
    if (query.get('failed') === '1') return { kind: 'oauth-failure', nonce };
    return validUserId && validSecret ? { kind: 'oauth', nonce, userId, secret } : null;
  }
  if (!validUserId || !validSecret) return null;
  if (path === '/auth/recover') return { kind: 'recover', userId, secret };
  if (path === '/auth/verify') return { kind: 'verify', userId, secret };
  return null;
}
