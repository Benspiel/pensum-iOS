/** Appwrite hides session secrets from client response bodies and puts them in this HTTP header. */
export function readSessionCookie(projectId: string, header: string | null): string | null {
  if (!header) return null;
  try {
    const key = `a_session_${projectId}`;
    const cookies: unknown = JSON.parse(header);
    if (!cookies || typeof cookies !== 'object' || !(key in cookies)) return null;
    const value = (cookies as Record<string, unknown>)[key];
    return typeof value === 'string' && /^[A-Za-z0-9+/=_-]{1,1024}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}
