/* Goodnotes-Tool – Anfragen an eine WebView mit Zeitlimit, Abbruch und Neustart-Regel.
 * Rein (keine React-/WebView-Importe), damit alles ohne Gerät testbar ist. Der Hook dazu: useWebViewChannel.ts. */

export const ENGINE_TIMEOUT_MS = 20_000;
export const EXPORT_TIMEOUT_MS = 60_000;
export const ENGINE_TIMEOUT_MESSAGE = "Die Engine antwortet nicht.";
export const ENGINE_RESTART_MESSAGE = "Die Engine wurde neu gestartet. Versuch es noch einmal.";
export const ENGINE_CLOSED_MESSAGE = "Die Engine ist nicht mehr aktiv.";
export const ENGINE_GIVEUP_MESSAGE = "Die Schreib-Engine ist mehrfach abgestürzt. Schließ das Tool und öffne es neu.";

/** Fehler einer Anfrage, die nicht von der Engine selbst beantwortet wurde. */
export class HostRequestError extends Error {
  constructor(message: string, readonly reason: "timeout" | "aborted" | "closed") {
    super(message);
    this.name = "HostRequestError";
  }
}

/** Export darf länger dauern (viele Seiten, JPEG/ZIP), alles andere soll schnell antworten. */
export const timeoutForType = (type: string): number => (type.startsWith("export-") ? EXPORT_TIMEOUT_MS : ENGINE_TIMEOUT_MS);

export interface TimerApi {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}
const realTimers: TimerApi = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };

export interface RequestQueue {
  /** Anfrage mit neuer ID senden. Antwort über resolve/reject, sonst Zeitlimit. */
  request(req: { type: string } & Record<string, unknown>): Promise<unknown>;
  /** Nachricht ohne Antwort (keine ID, kein Zeitlimit). Fehler beim Senden werden verschluckt. */
  notify(msg: Record<string, unknown>): void;
  /** Antwort zuordnen. false, wenn es die Anfrage nicht (mehr) gibt, z. B. nach dem Zeitlimit. */
  resolve(id: string, value: unknown): boolean;
  reject(id: string, error: Error): boolean;
  /** Alle offenen Anfragen mit Fehler beenden (z. B. WebView abgestürzt). Neue Anfragen bleiben möglich. */
  abortAll(error: Error): void;
  /** Aufräumen beim Unmount: offene Anfragen abbrechen, danach lehnt request() sofort ab. */
  dispose(): void;
  readonly size: number;
}

export function createRequestQueue(o: {
  send: (json: string) => void;
  newId: () => string;
  timeoutMs?: (type: string) => number;
  timers?: TimerApi;
}): RequestQueue {
  const timers = o.timers ?? realTimers;
  const timeoutMs = o.timeoutMs ?? timeoutForType;
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: unknown }>();
  let closed = false;

  const take = (id: string) => {
    const e = pending.get(id);
    if (!e) return null;
    pending.delete(id);
    timers.clear(e.timer);
    return e;
  };
  const abortAll = (error: Error) => {
    for (const id of [...pending.keys()]) take(id)?.reject(error);
  };

  return {
    request(req) {
      if (closed) return Promise.reject(new HostRequestError(ENGINE_CLOSED_MESSAGE, "closed"));
      const id = o.newId();
      return new Promise((resolve, reject) => {
        const timer = timers.set(() => { take(id)?.reject(new HostRequestError(ENGINE_TIMEOUT_MESSAGE, "timeout")); }, timeoutMs(req.type));
        pending.set(id, { resolve, reject, timer });
        try { o.send(JSON.stringify({ ...req, id })); }
        catch (e) { take(id); reject(e instanceof Error ? e : new Error(String(e))); }
      });
    },
    notify(msg) { try { o.send(JSON.stringify(msg)); } catch (_) { /* WebView weg: es gibt nichts zu tun */ } },
    resolve(id, value) { const e = take(id); if (!e) return false; e.resolve(value); return true; },
    reject(id, error) { const e = take(id); if (!e) return false; e.reject(error); return true; },
    abortAll,
    dispose() { closed = true; abortAll(new HostRequestError(ENGINE_CLOSED_MESSAGE, "closed")); },
    get size() { return pending.size; },
  };
}

/** Begrenzt Neustarts, damit eine dauerhaft abstürzende WebView nicht endlos neu lädt: höchstens `max` je `windowMs`. */
export function createRestartPolicy(o: { max?: number; windowMs?: number; now?: () => number } = {}) {
  const max = o.max ?? 3, windowMs = o.windowMs ?? 60_000, now = o.now ?? Date.now;
  let stamps: number[] = [];
  return {
    /** Neustart anmelden. true = erlaubt. */
    allow(): boolean {
      const t = now();
      stamps = stamps.filter((s) => t - s < windowMs);
      if (stamps.length >= max) return false;
      stamps.push(t);
      return true;
    },
  };
}

/** Ablauf bei Absturz der WebView: offene Anfragen abbrechen, „nicht bereit“ melden, neu starten (oder aufgeben). */
export function createHostSupervisor(o: {
  queue: () => RequestQueue;
  policy: { allow(): boolean };
  /** WebView neu laden (Schlüssel wechseln oder reload). */
  restart: () => void;
  /** ready = false, Zustand der Oberfläche zurücksetzen. */
  onDown: () => void;
  onGiveUp: () => void;
}) {
  return {
    handleTerminated(): boolean {
      o.queue().abortAll(new HostRequestError(ENGINE_RESTART_MESSAGE, "aborted"));
      o.onDown();
      if (o.policy.allow()) { o.restart(); return true; }
      o.onGiveUp();
      return false;
    },
  };
}

/** Datei im Cache entfernen; Fehler dürfen das Teilen nie beeinflussen. */
export function deleteQuietly(file: { exists: boolean; delete(): void } | null | undefined): boolean {
  try {
    if (file && file.exists) file.delete();
    return true;
  } catch (_) { return false; }
}
