/* Spiele – reine Helfer ohne Oberfläche (auch in Tests nutzbar).
 * Web-Quelle: tools/spiele/util.js (Pensum, Web-Commit 770dbe4), 1:1 übernommen und typisiert. */

/** Zufallsfunktion mit Startwert (für Tests und reproduzierbare Rätsel). */
export const seeded = (seed = 1): (() => number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Mischt eine Liste (Fisher–Yates) und gibt eine neue zurück. */
export function shuffle<T>(list: readonly T[], rng: () => number = Math.random): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const x = a[i] as T;
    a[i] = a[j] as T;
    a[j] = x;
  }
  return a;
}

/** Größte Skalierung, bei der ein Spiel (w × h) komplett in die Fläche (areaW × areaH) passt. max begrenzt die Vergrößerung (1 = nie größer als das Original). */
export function fitScale(w: number, h: number, areaW: number, areaH: number, max = Infinity): number {
  if (!(w > 0 && h > 0 && areaW > 0 && areaH > 0)) return 1;
  return Math.min(max, areaW / w, areaH / h);
}

/** Sekunden als m:ss. */
export const clock = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
