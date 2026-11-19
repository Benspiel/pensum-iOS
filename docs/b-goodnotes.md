# Goodnotes-Tool in der iOS-App

Stand: Web `770dbe4`. Code: `src/features/goodnotes/**`, Route `app/tools/goodnotes.tsx`. Herkunft und Lizenzen der gebündelten Teile: `docs/THIRD-PARTY.md`.

## Aufbau

- Die Tinten-Engine aus dem Web (`ink-engine.js`, aus Inkly, MIT, Autor: Auftraggeber) läuft **unverändert und offline** in einer lokalen `react-native-webview`. Es gibt keinen Website-Fallback und kein CDN. Eingebettet sind die Engine, jsPDF 4.2.1, JSZip, die Papier-Vorlagen (`templates.js`) und sechs Handschrift-Schriften (OFL).
- `scripts/build-goodnotes-host.mjs` erzeugt daraus `host-html.generated.ts`. Nach einer Änderung an Engine-Dateien neu bauen.
- Die native Hülle (`screen.tsx`) übernimmt Eingabe (Text, Schrift, Papier, Tinte, Regler), die Wahl einer eigenen Vorlage (`expo-document-picker`) sowie Speichern und Teilen (`expo-file-system`, `expo-sharing`).
- Die Brücke läuft über `postMessage` (`protocol.ts`): `render` liefert je Seite ein Vorschaubild, `export-pdf` und `export-goodnotes` liefern die Dateien als Base64. Jede Anfrage hat ein Zeitlimit, und ein Absturz der WebView wird abgefangen (`request-queue.ts`, `useWebViewChannel.ts`).

## Eigene Handschrift

- Die Zeichenfläche ist eine zweite lokale WebView (`engine/pad-bridge.js`, `HandPad.tsx`), die Bedienung ist nativ.
- Speicher (`hand-store.ts`): im Gastmodus über `KeyValueStore`, im Konto in der Tabelle `handwriting` (Zeilen-ID = Benutzer-ID, Feld `glyphs`, Upsert: Update, bei 404 Create). Gastimport beim ersten Login mit Rückfrage; bei Fehlern bleibt der Gast-Eintrag erhalten.

## Übergabe aus „Abschreiben“

`src/features/shared/handoff.ts`: Der Text liegt nur im Arbeitsspeicher, wird einmal gelesen und verfällt nach 10 Minuten. `/tools/goodnotes` liest und leert die Übergabe beim Öffnen.

## Abweichungen vom Web

- Die Vorschau besteht aus Bildern statt einem Live-Canvas.
- Datei-Import und -Export laufen über iOS-Dialoge (Dateiauswahl, Teilen).
- Die Regler sind −/+ statt Schieber.
- Ein Export ist nicht byte-gleich zum Web, weil die Engine Zufallsanteile nutzt. Verglichen werden Struktur und Seitenzahl.

## Noch ungeprüft (nur auf dem Gerät möglich)

WKWebView-Verhalten (Schriften, Touch im Zeichenfeld, Speicher), Teilen und „In Goodnotes öffnen“, Dauer und Speicher bei mehreren Seiten. Siehe `docs/b-abnahme-testplan.md`. Vor einer Veröffentlichung sind die Rechte an den Papier-Vorlagen in `templates.js` zu klären.

## Spiele

Bewusst nicht Teil der iOS-App (Entscheidung des Auftraggebers).
