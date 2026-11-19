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

export interface GradeSubject {
  id: string;
  name: string;
  schoolYear: string;
}

export interface GradeEntry {
  id: string;
  subjectId: string;
  label: string;
  value: number;
  system: 'note' | 'punkte';
  weight: number;
  half: 1 | 2;
}

export interface GradeData {
  subjects: GradeSubject[];
  grades: GradeEntry[];
}

export interface PlannerItem {
  id: string;
  kind: 'task' | 'exam';
  title: string;
  subject: string;
  date: string;
  note: string;
  done: boolean;
  deckId: string;
}

export interface PlannerData {
  items: PlannerItem[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  level: number;
}

export interface FlashcardDeck {
  id: string;
  name: string;
  mode: 'level' | 'all';
  cards: Flashcard[];
}

export interface FlashcardData {
  decks: FlashcardDeck[];
}

export interface ToolData {
  notenrechner: GradeData;
  planer: PlannerData;
  karteikarten: FlashcardData;
}

export type StoredTool = keyof ToolData;

export interface StoreImportResult {
  imported: number;
  remaining: number;
}

export interface ToolStore<K extends StoredTool> {
  readonly kind: 'guest' | 'cloud';
  readonly userId: string | null;
  load(): Promise<ToolData[K]>;
  save(data: ToolData[K]): Promise<void>;
  flush(): Promise<void>;
  guestCount(): Promise<number>;
  importGuest(): Promise<StoreImportResult>;
}

export type ToolStores = { [K in StoredTool]: ToolStore<K> };
