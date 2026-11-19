/* Planer ↔ Karteikarten: Verknüpfung einer Klausur mit einem Lernstapel.
 * Web-Quelle: tools/planer/planer.js (examCard, ~Zeile 112–124; Pensum, Web-Commit 770dbe4).
 *
 * Der Planer-Kern kennt die Karteikarten nicht: Die Oberfläche reicht eine Liste einfacher Stapel-Zusammenfassungen herein.
 * Regeln (wie im Web):
 *   - Ein Eintrag ohne deckId hat keinen Link.
 *   - Eine verwaiste deckId (Stapel gelöscht, aus einem anderen Konto/Gastspeicher, Liste noch nicht geladen) ergibt keinen Link;
 *     der Eintrag behält die deckId unverändert (Web ändert sie nicht), der Link erscheint wieder, sobald der Stapel da ist.
 *   - Stapel-IDs gelten nur innerhalb ihres Speichers: Beim Übernehmen von Gast-Einträgen ins Konto wird deckId geleert
 *     (siehe mergeGuestItems in core.ts). */

export type DeckSummary = { id: string; name: string; cardCount: number };

/** Der verknüpfte Stapel eines Eintrags, oder null (keine Verknüpfung oder verwaiste deckId). */
export function resolveDeck(item: { deckId?: string | null }, decks: readonly DeckSummary[]): DeckSummary | null {
  const id = item.deckId;
  if (!id) return null;
  return decks.find((d) => d.id === id) ?? null;
}

/** Ziel des Links „Karteikarten lernen“ in der App (Expo Router): Route /tools/karteikarten, Query-Parameter `deck`.
 *  (Das Web nutzt dafür das Fragment `#deck=<id>`.) */
export function deckLinkHref(deckId: string): string {
  return `/tools/karteikarten?deck=${encodeURIComponent(deckId)}`;
}
