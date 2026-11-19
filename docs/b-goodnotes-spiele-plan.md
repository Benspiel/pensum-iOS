# B4 – Plan Goodnotes-Tool und Spiele (iOS)

Stand: Web `770dbe4`. Quelle: `tools/goodnotes/*`, `tools/spiele/*`, `vendor/{jszip,jspdf}`, `vendor/fonts`.

## Goodnotes-Tool

Befund (Web):
- `ink-engine.js` (37 KB, aus Inkly, MIT, vom Auftraggeber) rendert Seiten auf `<canvas>` (Zhang-Suen-Skelettierung der Zeichen, Zeilenlayout), baut `.goodnotes` (ZIP via JSZip, Protobuf + LZ4 „bv41“) und PDF (jsPDF). Voraussetzung: `document.fonts`, Canvas 2D, `window.GOODI_TEMPLATES` (`templates.js`, 52 KB, Base64-Vorlagen), JSZip, jsPDF.
- Zustand: Vorlage/Handschrift-Variation lokal (`localStorage`); eigene Handschrift: Gast lokal, Konto Tabelle `handwriting` (Zeile = Benutzer-ID, Feld `glyphs`).
- Eingang: Übergabe aus „Abschreiben“ über `HANDOFF_KEY` (sessionStorage, 10 min gültig, einmal lesen).

Entscheidung (Vorschlag, braucht Freigabe A wegen Abhängigkeiten): **Engine läuft unverändert, aber lokal im App-Paket** in einer `react-native-webview`-Instanz (`source` = gebündeltes HTML, kein Netz, keine Website). Die native Hülle übernimmt Eingabe (Text, Papier, Schrift, Tinte), Dateiauswahl der eigenen Vorlage (`expo-document-picker`), Speichern und Teilen (`expo-file-system` + `expo-sharing`, iOS-Share-Sheet / „In Dateien sichern“ / Goodnotes öffnen). Brücke per `postMessage`: `render{text,settings}` → Vorschau-PNG je Seite; `export{kind:"pdf"|"goodnotes"}` → Base64 → Datei im Cache → Share-Sheet.
Begründung: Der Strichformat-Export ist die Kernleistung; eine native Skia-Neuimplementierung würde das Format riskant duplizieren. Die Engine bleibt byte-identisch zum Web (Test: Export-Hash gegen Web-Export mit gleichen Eingaben).
Kennzeichnung im Funktionsvergleich: „eingebettete Web-Engine, offline, kein Website-Fallback“. Unterschiede: Seitenvorschau als Bild statt Live-Canvas; Dateiimport/-export über iOS-Dialoge.
Eigene Handschrift (Zeichnen der Glyphen): Phase 2, native Zeichenfläche (Skia/Gesture) oder WebView-Seite derselben Engine; Speicher: Gast `KeyValueStore`, Konto Tabelle `handwriting` über `RowsApi` (upsert = update, bei 404 create).
Übergabe Abschreiben → Goodnotes: B portiert `makeHandoff/readHandoff` nach `src/features/shared/handoff.ts` (rein, TTL 10 min, einmal lesen; Speicher = In-Memory-Singleton statt sessionStorage). A nutzt dasselbe Modul in Abschreiben. Route: `/tools/goodnotes` liest und leert die Übergabe beim Öffnen.

Abhängigkeitswünsche (an A): `react-native-webview`, `expo-document-picker`, `expo-file-system`, `expo-sharing` (alle Expo-Go-fähig bzw. mit Dev-Build). Assets: `jszip.min.js`, `jspdf.umd.min.js`, `templates.js`, Schriften Caveat / Gochi Hand / Indie Flower samt Lizenzdateien (`vendor/fonts/*-LICENSE.txt`), `ink-engine.js` – Herkunft und Lizenz in `assets/THIRD-PARTY.md`.

Offene Prüfung: Hermes/WebView-Speicherlimit bei sehr großen Vorlagen; `document.fonts.load` im iOS-WKWebView mit lokal eingebetteten Schriften (Base64-@font-face).

## Spiele

Im Web ist `spiele` aktuell `soon` (ausgegraut, nicht klickbar). Die App spiegelt **denselben Veröffentlichungsstatus** („Kommt bald“), solange die Web-Registry so steht; kein Bauaufwand vor Release-Kandidat.
Vorbereitet (später): Vier gewinnt (`connect4.js`, reine Logik, nativ portierbar), Arcade (GH Arcade, MIT, Phaser 1,3 MB) und Schach (Worker, `LICENSE` vorhanden) als gebündelte WebViews wie beim Goodnotes-Tool. Lizenzen in `THIRD-PARTY.md` aufnehmen.
