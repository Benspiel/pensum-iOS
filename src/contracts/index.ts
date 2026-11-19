export type ToolAccess = Readonly<{ tester: boolean; kiTester: boolean; admin: boolean }>;

export const noToolAccess: ToolAccess = Object.freeze({ tester: false, kiTester: false, admin: false });

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  registeredAt: string;
  prefs: Readonly<Record<string, unknown>>;
}

export type PensumErrorCode =
  | 'offline'
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid'
  | 'not-found'
  | 'conflict'
  | 'rate-limit'
  | 'cancelled'
  | 'storage'
  | 'server'
  | 'unknown';

export class PensumError extends Error {
  constructor(
    public readonly code: PensumErrorCode,
    message: string,
    public readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'PensumError';
  }
}

export type SessionState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'account'; user: SessionUser; connection: 'online' | 'offline' }
  | { status: 'error'; error: PensumError };

export type { KeyValueStore, RowsApi, SaveStatus, StoreDeps, StoreKind, TableIds } from '../features/shared/ports';
