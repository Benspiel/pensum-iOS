import { appwriteCallbackScheme } from '../src/backend/config';

const authRoutes = new Set(['/auth/verify', '/auth/recover', '/auth/oauth']);

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  const address = path.split(/[?#]/, 1)[0] ?? '';
  const separator = address.indexOf('://');
  const scheme = separator < 0 ? '' : address.slice(0, separator).toLowerCase();

  if (!scheme || scheme === appwriteCallbackScheme || scheme === 'pensum') {
    const location = separator < 0 ? address : address.slice(separator + 3);
    const route = location.startsWith('/') ? location : '/' + location;

    // Der SessionProvider verarbeitet die originale Linking-URL direkt. Expo Router
    // bekommt nur den Pfad und hält weder Secrets noch Einmalcodes im Navigationszustand.
    if (authRoutes.has(route)) return route;
    if (scheme === appwriteCallbackScheme) return '/konto';
  }

  return path;
}
