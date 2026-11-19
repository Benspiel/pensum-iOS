/* Schreibzugriffe auf Appwrite: höchstens 3 gleichzeitig, bei Serverfehlern bis zu zweimal mit Pause wiederholen.
 * 1:1 aus tools/{notenrechner,planer,karteikarten}/store.js (dort je Datei einmal kopiert). */

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const isTransient = (e: any): boolean => !e || !e.code || e.code >= 500 || e.code === 429;

export interface LimitedOptions { okOn409?: boolean; okOn404?: boolean; }

export function createLimiter(max = 3, pauseMs = 1500) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async function limited<T>(op: () => Promise<T>, { okOn409 = false, okOn404 = false }: LimitedOptions = {}): Promise<T | undefined> {
    while (active >= max) await new Promise<void>((r) => waiting.push(r));
    active++;
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          return await op();
        } catch (e: any) {
          if (okOn409 && e && e.code === 409) return undefined; // der erste Versuch war doch angekommen
          if (okOn404 && e && e.code === 404) return undefined;
          if (attempt >= 2 || !isTransient(e)) throw e;
          await sleep(pauseMs * (attempt + 1));
        }
      }
    } finally {
      active--;
      const next = waiting.shift();
      if (next) next();
    }
  };
}
