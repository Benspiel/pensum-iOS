# Übergabe Rolle B: Notenrechner, Planer, Karteikarten, Goodnotes

Stand 19.11.2026, Code `codex/pensum-ios-integration` @ `d60418c`. Prüfplan: [b-abnahme-testplan.md](b-abnahme-testplan.md). Gerätetests laufen zuerst in Expo Go (LAN-Testserver, SDK 58).

## 1. Fertig und durch automatische Tests belegt

Echte Läufe am 19.11.2026 im Integrationsstand: `npm test` **279 von 279 grün**, `tsc --noEmit` ohne Fehler. Je Ordner (`npx tsx --test "src/features/<ordner>/**/*.test.ts"`):

| Werkzeug | Tests | Belegt (reine Logik, ohne Gerät) |
| --- | --- | --- |
| Notenrechner | 78 | Rechenlogik 1:1 aus dem Web, Zahlenformat, Speicher Gast/Konto, deduplizierter Gastimport, Speichern vor dem Abmelden |
| Planer | 74 | Gruppen/Countdown (5 Zeitzonen grün), Datumsformate, Speicher, Gastimport, Stapel-Link |
| Karteikarten | 73 | Level/Test, Speicher, Gastimport (max. 5 Stapel), Link, KI-Kartenlogik und Fehlercodes |
| Goodnotes | 33 (+2 in `tests/`) | Protokoll und Regler, Handschrift-Speicher, Zeitlimit/Absturz-Neustart der WebViews, jsPDF 4.2.1 samt Prüfsumme, Export mit aktuellem Text |
| Gemeinsam | 7 | Textübergabe an Goodnotes, Begrenzer |

Außerdem laut Statusdatei (Rolle A, nicht von mir erneut gelaufen): iOS-Hermes-Export, Expo Doctor 20/20, Metro liefert das iOS-Manifest. Browser-Nachweis der Goodnotes-Engine: PNG, `.goodnotes` (ZIP) und PDF werden erzeugt. Der Design-Branch lief zuletzt mit 287 Tests grün.

## 2. Nur auf dem Gerät prüfbar

Nichts davon ist bisher auf einem iPhone gelaufen. Die Testfälle stehen im Testplan:

- Alle Gast-/Konto-Flüsse mit Testkonten, Web ↔ App, Zwei-Konten-Trennung, Gastimport, Abmelden mit offener Änderung (N7–N18, P10–P12, K9–K11, Ü2, Ü5).
- Bedienung: Datumswähler, Haptik, Ausblend- und Wegfliegen-Effekt (P3, P4, K4), VoiceOver, dynamische Schrift, Dark Mode (N19, P14, K13, G14).
- Goodnotes: Schriften im WKWebView, Touch im Zeichenfeld, Teilen-Menü, Öffnen in Goodnotes, Konto-Upsert der Handschrift (G3, G5–G7, G15–G22), WebView-Zeitlimit und -Absturz (G24).
- KI-Karten mit echtem Ki-Tester-Konto, Einverständnis, Foto/PDF, Fehlerfälle (K15–K19).
- **Erst im signierten Build** (Expo Go kann es nicht): Direktlinks `pensum://` und Appwrite-Rücksprünge (K12b, Ü4), Neustart im Flugmodus (N8b, K8b, P16), Zeitmessung G12, Berechtigungstexte, das native Dokumentmodul `PensumDocuments` (nur Werkzeug „Aufgaben“, Rolle A).

## 3. Bekannte Einschränkungen und Abweichungen zum Web

- **Spiele** sind bewusst nicht Teil der App (Entscheidung des Auftraggebers).
- Gastimport dedupliziert (Web legt Kopien an) und löscht Gastdaten erst nach bestätigtem Speichern. Vor dem Abmelden wird gespeichert; scheitert das, fragt die Kontoseite „Trotzdem abmelden?“.
- Planer-Link zu Karteikarten nutzt `?deck=<id>` statt `#deck=<id>`. Datum im Planer: nativer Wähler statt Datumsfeld.
- Goodnotes: Vorschau als Bild statt Live-Canvas; Regler per −/+ statt Schieberegler; kein Vorab-Dialog bei mehreren `.goodnotes`-Dateien (je Seite ein Teilen-Menü); eigene Vorlage nur für die offene Sitzung; Übergabe aus anderen Werkzeugen nur im Arbeitsspeicher (10 Minuten, einmal).
- Wie im Web: Eine Note im Notenrechner, deren Anlegen im Konto scheitert, wird nicht automatisch nachgeschrieben. Planer und Karteikarten wiederholen nach 8 s. Nur der Notenrechner lädt beim Zurückkehren in die App neu.
- Karteikarten-KI nur für Ki-Tester; alle anderen sehen „Kommt bald“. Nur mit Mocks getestet.
- In Expo Go zeigen Berechtigungsdialoge Expo-Go-Texte, und App-Links gehen nicht (siehe Testplan, Abschnitt „Expo Go“).
- Die Testplan-Prüfung betrifft die Funktion, nicht das neue Design (Branch `codex/pensum-ios-b-design`).

## 4. Externe Blocker

Quelle: `PENSUM-IOS-STATUS.md` (Rolle A) und `THIRD-PARTY.md`.

- **Apple-Developer-Team und Signierung:** Die Apple-Anmeldung klappt, aber für das verwendete Konto gibt es kein aktives Apple-Developer-Team. Kein iPhone ist registriert, es gibt keinen iOS-Build und kein TestFlight. Auf Windows gibt es weder Xcode noch Simulator. Das Swift-Modul `PensumDocuments` wurde deshalb nie kompiliert.
- **Testkonten:** Zwei bestätigte Testkonten (T1, T2), ein Konto im Team `ki-tester` und eines im Team `tester` fehlen noch, ebenso eine Zwei-Konten-Abnahme mit Web. Der Auftraggeber legt sie an; Zugangsdaten gehören nicht in Dateien.
- **Papier-Vorlagen** `src/features/goodnotes/engine/templates.js`: Rechte an den Goodnotes-Hüllen müssen vor einer Veröffentlichung geklärt werden.
- **Erklärvideos:** Die Appwrite-Function `lehrer-schmidt` fehlt im produktiven Projekt, das Werkzeug ist deshalb gesperrt (Rolle A, nicht B).
- Google-Anmeldung ist standardmäßig aus; vor dem App Store ist Apple-Richtlinie 4.8 zu klären (Rolle A).

## 5. Fehler melden und im Code ansetzen

Meldung bitte als Liste: **Werkzeug**, **Schritt** (Testplan-ID, z. B. „P4“), **erwartet**, **tatsächlich** (Text oder Bildschirmfoto, keine echten Daten), **Gerät und iOS-Version** (plus Expo Go oder Build), **Gast oder Konto** (T1, T2, T3).

| Werkzeug | Ordner | Einstieg |
| --- | --- | --- |
| Notenrechner | `src/features/notenrechner/` | Oberfläche `screen.tsx`, `useNotenrechner.ts`; Logik `core.ts`, `model.ts`, `ui-model.ts`; Speicher `store.ts`, `import.ts` |
| Planer | `src/features/planer/` | `screen.tsx`, `controller.ts`; Logik `core.ts`, `model.ts`; Speicher `store.ts`, `import.ts`; Link `links.ts` |
| Karteikarten | `src/features/karteikarten/` | `screen.tsx`, `hooks.ts`, `components/`; Logik `core.ts`, `session-model.ts`, `ops.ts`; Speicher `store.ts`; KI `ki/` |
| Goodnotes | `src/features/goodnotes/` | `screen.tsx`, `HandPad.tsx`, `useHand.ts`, `hand-store.ts`; WebView `request-queue.ts`, `useWebViewChannel.ts`; Engine `engine/` (nach Änderungen `node scripts/build-goodnotes-host.mjs`) |

Gemeinsam: `src/features/shared/` (Speicher-Ports, Textübergabe), Konto und Abmelden `src/account/session.tsx`, Speicheradapter `src/storage/`. Tests laufen mit `npm test`.
