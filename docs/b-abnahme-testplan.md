# Abnahme-Testplan B: Notenrechner, Planer, Karteikarten, Goodnotes

Stand: Web `770dbe4` (Quelle nur gelesen), iOS-Branch `codex/pensum-ios-b-goodnotes`. Rolle B (Claude).

**Wichtig:** Alle Spalten „Testnachweis“ unten nennen nur automatische Tests (reine Logik, ohne Gerät) und den Browser-Nachweis der Goodnotes-Engine. **Nichts davon ist auf einem iPhone oder im Simulator geprüft.** Die Checkliste in Teil 1 ist dafür da. Ergebnisse dort eintragen (Datum, Gerät, iOS-Version, Build, Ergebnis).

**Datenschutz im Test:** Nur Testkonten und synthetische Daten (z. B. Fach „Testfach A“, Stapel „Teststapel“, Text „Lernzettel Test“). Keine echten Schul- oder Personendaten, keine Passwörter oder Schlüssel in dieses Dokument oder in Git.

## Vorbereitung

| Punkt | Soll |
| --- | --- |
| Zwei Testkonten **T1** und **T2** (E-Mail bestätigt), im Appwrite-Projekt `pensum` angelegt vom Auftraggeber | Zugangsdaten nur dem Tester, nie in Dateien |
| Gerät/Simulator | iPhone mit aktueller iOS-Version oder Simulator; Build-Art (Dev-Client/EAS) notieren |
| Website | Produktiv-URL oder lokal `npm run dev` im Web-Ordner, mit **T1** angemeldet (für Datenfluss Web ↔ App) |
| Zustand vor dem Test | App neu installiert, kein Konto angemeldet (Gast) |
| Netz | WLAN an; Flugmodus-Schalter bereit |

Legende: **G** = Gast, **K** = Konto (T1), **K2** = zweites Konto (T2).

## Teil 1: Checkliste manueller Test

### 1.1 Notenrechner

| Nr. | Schritt | Soll | Ergebnis |
| --- | --- | --- | --- |
| N1 | G: Tool öffnen | Titel „Notenrechner.“, Schuljahr/Halbjahr/System-Auswahl, Hinweis „Gast“, leere Liste oder Standardfächer | |
| N2 | G: Note „2,3“ bei einem Fach eintragen | Durchschnitt erscheint mit Komma („2,30“), Umrechner-Gegenwert plausibel | |
| N3 | G: ungültig „7“ (Noten) bzw. „16“ (Punkte) | Fehlertext unter der Zeile, Durchschnitt unverändert | |
| N4 | G: System auf Punkte wechseln | Noten werden umgerechnet angezeigt, Zahlentastatur | |
| N5 | G: Fach hinzufügen (leer / doppelt / gültig) | „Gib dem Fach einen Namen.“ / Dublettenmeldung / Fach erscheint | |
| N6 | G: Fach mit Note löschen | Rückfrage, danach weg samt Note | |
| N7 | G: App komplett beenden und neu starten | Fächer, Noten und Ansicht (Schuljahr, Halbjahr, System) sind da | |
| N8 | G: Flugmodus, Daten ändern | Funktioniert lokal ohne Fehler, nach Neustart erhalten | |
| N9 | K: anmelden | Hinweis „Konto“, Daten des Kontos (ggf. leer), Speicherstatus „Speichert … / Gespeichert“ | |
| N10 | K: Note ändern, sofort App in den Hintergrund | Beim Zurückkehren/Neustart ist die Änderung gespeichert (Cloud-Zeile in Appwrite oder Web prüfen) | |
| N11 | K: Flugmodus, Note ändern, Flugmodus aus | Status „Nicht gespeichert“, danach automatische Wiederholung → „Gespeichert“ | |
| N12 | K: **Abmelden mit ungespeicherter Änderung** (Flugmodus kurz vor dem Abmelden) | Keine Änderung geht still verloren; Hinweis oder Speicherung vor dem Abmelden; bei erneutem Login Zustand prüfen und im Ergebnis notieren | |
| N13 | K → Daten Web ↔ App: Fach/Note im Web (T1) anlegen | In der App erscheint sie nach „Erneut laden“ / Neustart; umgekehrt App → Web | |
| N14 | **Gastimport:** G Daten anlegen („Testfach A“ + Note), dann T1 anmelden | Dialog „Lokale Daten übernehmen?“; „Ins Konto übernehmen“ → Erfolgsmeldung mit Anzahl, Gastdaten danach gelöscht | |
| N15 | Gastimport: Wiederholung | Zweiter Import legt Kopien an (Web-Verhalten gleich), kein Absturz; Ergebnis und Doppelungen notieren | |
| N16 | Gastimport: Teilfehler (Flugmodus mitten im Import) | Fehlermeldung „Die Übernahme ist nicht vollständig durchgelaufen …“, Gastdaten bleiben erhalten | |
| N17 | Gastimport „Nicht übernehmen“ | Dialog kommt für dieses Konto nicht wieder | |
| N18 | **Zwei Konten:** T1 Daten anlegen, abmelden, T2 anmelden | T2 sieht keine Daten von T1 (und umgekehrt); auch keine Gastdaten | |
| N19 | Dynamische Schrift (Einstellungen → größte Stufe), VoiceOver, Dark Mode | Nichts abgeschnitten, Felder per VoiceOver bedienbar | |

### 1.2 Planer

| Nr. | Schritt | Soll | Ergebnis |
| --- | --- | --- | --- |
| P1 | G: Hausaufgabe „Testaufgabe“ per Schnellerfassung | Erscheint, Gruppe „Ohne Datum“ | |
| P2 | G: Eintrag mit Datum heute / gestern / nächste Woche | Gruppen „Heute“ / „Überfällig“ / „Diese Woche“ bzw. „Später“, Kennzahlen oben stimmen | |
| P3 | G: Datumsfeld: „5.3.2026“, „2026-03-05“, „31.02.2026“ | Gültige Formate werden erkannt; ungültig → „Dieses Datum gibt es nicht.“ | |
| P4 | G: Aufgabe abhaken und wieder öffnen; „Erledigte löschen“ | Zustand wechselt, Bestätigung bei „Erledigte löschen“ | |
| P5 | G: Klausur in 3 Tagen anlegen | Countdown „3 Tage“, rot bei ≤ 3 Tagen, Karte „Nächste Klausur“ | |
| P6 | G: Klausur löschen | Rückfrage „Klausur löschen?“ | |
| P7 | G/K: **Planer ↔ Karteikarten:** Stapel „Teststapel“ mit Karten anlegen, Klausur mit diesem Stapel verknüpfen | Button „Karteikarten lernen“ öffnet den Stapel direkt (Route `?deck=<id>`) | |
| P8 | Verknüpften Stapel in Karteikarten löschen, Planer öffnen | Kein Link, kein Absturz; Klausur bleibt | |
| P9 | G: Neustart | Einträge erhalten | |
| P10 | K: wie N9–N13 (Hintergrund, Offline, Abmelden, Web ↔ App) für Planer-Einträge | Wie Notenrechner | |
| P11 | **Gastimport** Planer (Dialog „Lokale Einträge übernehmen?“), Wiederholung, Teilfehler | Wie N14–N17; `deckId` wird beim Import geleert (Stapel-IDs gelten nur lokal) | |
| P12 | **Zwei Konten** | T2 sieht nichts von T1 | |
| P13 | Tageswechsel: App über Mitternacht im Hintergrund, dann öffnen | Gruppen/„Heute“ aktualisieren sich | |
| P14 | Dynamische Schrift, VoiceOver, Dark Mode | wie N19 | |

### 1.3 Karteikarten

| Nr. | Schritt | Soll | Ergebnis |
| --- | --- | --- | --- |
| K1 | G: Stapel anlegen (leerer Name / gültig, Modus „Level“ und „Alle hintereinander“) | „Gib dem Stapel einen Namen.“ / Stapel öffnet Tab „Hinzufügen“ | |
| K2 | G: 6 Stapel versuchen | Ab dem 5. keine neuen („Du kannst höchstens 5 Stapel haben.“) | |
| K3 | G: Karten hinzufügen, bearbeiten, löschen; leere Seite | „Fülle Vorder- und Rückseite aus.“ | |
| K4 | G: Üben (Umdrehen, „Gewusst/Nicht gewusst“) im Level-Modus | Level steigt/fällt, falsche Karte kommt ans Ende, Fortschritt stimmt | |
| K5 | G: Test (schriftlich) mit richtiger, falscher, fast richtiger Antwort, „Trotzdem richtig“ | `isCorrect` wie Web; „Richtig wäre: …“ | |
| K6 | G: Rundenabbruch über Schließen | Rückfrage, Level bleiben gespeichert | |
| K7 | G: Alle Karten Level 5, erneut starten | „Alles gelernt.“ → „Von vorn beginnen“ setzt alle auf Level 1 | |
| K8 | G: Neustart und Offline | Stapel, Karten, Level erhalten | |
| K9 | K: anmelden, Daten anlegen, Hintergrund/Offline/Abmelden/Web ↔ App | wie N9–N13 | |
| K10 | **Gastimport** (Dialog mit Anzahl), Wiederholung, Teilfehler, „Nicht übernehmen“ | Höchstens 5 Stapel im Konto; Gast wird nur nach vollständigem Import gelöscht | |
| K11 | **Zwei Konten** | T2 sieht nichts von T1 | |
| K12 | Deep Link `/tools/karteikarten?deck=<gültige id>` und `?deck=unbekannt` | Gültig: Stapel offen; unbekannt: Liste, kein Absturz | |
| K13 | Dynamische Schrift, VoiceOver (Karte, Tabs, Level-Anzeige), Dark Mode | wie N19 | |
| K14 | KI-Kartenerzeugung | **Nicht Teil dieses Builds** (Platzhalter „Kommt bald“ im Dialog) | |

### 1.4 Goodnotes-Tool

| Nr. | Schritt | Soll | Ergebnis |
| --- | --- | --- | --- |
| G1 | Tool öffnen (Gast) | „Engine startet …“ verschwindet, Vorschau zeigt Seite in Handschrift | |
| G2 | Text ändern | Vorschau aktualisiert sich nach kurzer Pause | |
| G3 | Schrift (alle 6), Papier (4), Tintenfarbe (4), Ausgabe „Echte Tinte“/„PDF-Seite“ | Jede Auswahl ändert die Vorschau; **Schriften laden im WKWebView** (nicht Standardschrift) | |
| G4 | Langer Text (> 1 Seite) | „n Seiten“, mehrere Vorschaubilder | |
| G5 | **PDF exportieren** | Teilen-Menü; „In Dateien sichern“; PDF öffnet sich, Seitenzahl stimmt | |
| G6 | **.goodnotes exportieren** (1 Seite) | Teilen-Menü; Datei in Goodnotes öffnen (Share → Goodnotes), Striche sind echte Tinte (radierbar), Vorlage stimmt | |
| G7 | .goodnotes bei mehreren Seiten | Eine Datei je Seite, Namen „Name (1).goodnotes …“ | |
| G8 | Dateiname mit Sonderzeichen `/ : * ?` | Wird zu „-“, Export klappt | |
| G9 | Eigene Vorlage (einseitige .goodnotes aus Dateien wählen) | Name erscheint, Export nutzt Vorlage; „Entfernen“ geht zurück | |
| G10 | Defekte Datei als Vorlage | Verständliche Fehlermeldung, App bleibt benutzbar | |
| G11 | Flugmodus | Alles funktioniert (Engine ist lokal gebündelt) | |
| G12 | Speicher/Zeit: 3 Seiten + Echte Tinte auf ältestem Testgerät | Kein Absturz der WebView, akzeptable Dauer (Zeit notieren) | |
| G13 | **Übergabe Abschreiben → Goodnotes** (Abschreiben liefert Text, Button zu Goodnotes) | Text und Name erscheinen einmal; erneutes Öffnen von Goodnotes zeigt sie nicht mehr; nach > 10 Minuten verfällt sie | |
| G14 | Dynamische Schrift, VoiceOver, Dark Mode | Bedienelemente (44 pt) benutzbar | |
| G15 | **Eigene Handschrift (Gast):** „Eigene Handschrift zeichnen“, 3 Zeichen mit dem Finger/Apple Pencil schreiben, „Speichern“ | Striche folgen dem Finger ohne Scrollen des Blattes, Fortschritt „Zeichen n von 85 · k gezeichnet“, „Meine Handschrift“ erscheint | |
| G16 | Handschrift: Zurück, Weiter/Überspringen, Rückgängig, Zeichen leeren, Sprung über die Zeichenliste | Verhalten wie im Web; letzte Taste heißt „Fertig“ und speichert | |
| G17 | Handschrift wählen, Text mit gezeichneten und nicht gezeichneten Zeichen, „Natürlich variieren“ an/aus | Vorschau in eigener Schrift; fehlende Zeichen mit Lücke; Variation sichtbar | |
| G18 | Handschrift: Neustart der App | Handschrift bleibt (Gast: Gerät, Konto: Appwrite) | |
| G19 | **Handschrift Konto:** T1 anmelden, speichern, in Appwrite Zeile `handwriting` mit Zeilen-ID = Benutzer-ID und Rechten nur für T1 prüfen; erneut speichern (Update) | Eine Zeile, kein Duplikat, `glyphs` JSON | |
| G20 | **Handschrift Gastimport:** Gast-Handschrift anlegen, mit T1 (ohne Konto-Handschrift) anmelden | Dialog „Lokale Handschrift übernehmen?“; „Ins Konto übernehmen“ → Gast-Eintrag gelöscht; „Nicht übernehmen“ → kommt für T1 nicht wieder; Fehler (Flugmodus) → Gast bleibt | |
| G21 | Handschrift **zwei Konten:** T2 anmelden | T2 sieht die Handschrift von T1 nicht | |
| G22 | Handschrift löschen (Rückfrage) und Offline-Speichern | Gelöscht, Font fällt auf Caveat zurück; Offline → verständliche Fehlermeldung, nichts geht still verloren | |
| G23 | Regler Schriftgröße/Strichstärke/Unregelmäßigkeit (− / +) | Werte und Beschriftung wie Web, Vorschau passt sich an | |

### 1.5 Übergreifend

| Nr. | Schritt | Soll | Ergebnis |
| --- | --- | --- | --- |
| Ü1 | Kaltstart, Warmstart, Hintergrund/Vordergrund je Werkzeug | Kein Datenverlust, keine veralteten Anzeigen | |
| Ü2 | Kontowechsel T1 → T2 → T1 | Jedes Konto sieht nur seine Daten, keine Reste im Speicher der anderen | |
| Ü3 | Tool-Sichtbarkeit nach Rolle (Gast, Konto, Tester) laut Katalog | Spiele/Tester-Tools gesperrt bzw. „Kommt bald“ wie im Web | |
| Ü4 | Direktlink `pensum://tools/notenrechner` usw. im Kaltstart | Öffnet das Tool (Auth-Links: Rolle A) | |
| Ü5 | Sitzung abgelaufen (Appwrite-Sitzung serverseitig beenden) | Verständliche Meldung, keine Daten des Kontos mehr sichtbar | |

## Teil 2: Web-Funktion → iOS-Umsetzung → Abweichung → Testnachweis

Testnachweis = automatische Tests im App-Repo (`npm test`, `node:test` via `tsx`; Stand dieses Branches: 197 von 197 grün) bzw. Browser-Nachweis; **kein Gerätenachweis**.

### Notenrechner (Web: `tools/notenrechner/*`)

| Web-Funktion | iOS-Umsetzung | Abweichung | Testnachweis |
| --- | --- | --- | --- |
| Noten/Punkte-Umrechnung, Zeugnisdurchschnitt, Halbjahre, Schuljahr | `core.ts`, `model.ts`, `screen.tsx` | keine fachliche | `notenrechner/__tests__` (59 Tests, davon 16 Web-Fälle 1:1) |
| Zahlenformat `Intl.NumberFormat("de-DE")` | `createNumberFormatter` mit Selbsttest und manuellem Fallback | Fallback zeigt −0,004 als „0,00“ (Intl: „-0,00“) | Test gegen echtes Intl über > 3000 Werte |
| Gast: `localStorage` | `KeyValueStore` (AsyncStorage), gleiche Schlüssel (`pensum.notenrechner.guest.v1`) | async, `peek()` entfällt; Schreibzugriffe serialisiert | Store-Tests mit `memoryKv` |
| Konto: Appwrite `subjects`/`grades`, Zeilenrechte nur Besitzer | `createCloudStore` mit `RowsApi` (A: `src/storage`) | Lokales Limit 3 parallel, 2 Wiederholungen wie Web | Store-Tests mit `memoryRows` (inkl. getrennte Konten, 500-Retry, 409/404) |
| Gastimport | `importGuestData` + Dialog | Dialog per `Alert` statt Web-Dialog; Wiederholung erzeugt Kopien (wie Web) | Store-Tests (Wiederholung, Teilfehler) |
| Ansicht (Schuljahr, Halbjahr, System) im Konto gespeichert (`getPrefs/savePrefs`) | laut Commit `3f2885d` „Ansicht im Konto“ (A-Anbindung) | bei Test prüfen: Ansicht erscheint nach Kontowechsel/Neuinstallation | Gerät: N7, N13 |
| Neu laden beim Zurückkehren (`visibilitychange`) | AppState-gesteuert, nur wenn nichts ungespeichert | im Entwicklerbericht als teilweise offen vermerkt; prüfen | Gerät: N10, Ü1 |
| Haptik, Animationen | nicht umgesetzt | bewusst weggelassen | – |

### Planer (Web: `tools/planer/*`)

| Web-Funktion | iOS-Umsetzung | Abweichung | Testnachweis |
| --- | --- | --- | --- |
| Hausaufgaben/Klausuren, Gruppen, Countdown, Kennzahlen | `core.ts`, `model.ts`, `controller.ts`, `screen.tsx` | Wochentag vor 1970 jetzt korrekt (Web: „undefined“) | `planer/__tests__` (62 Tests, TZ-Läufe UTC, Kiritimati, Los Angeles, Berlin, Lord Howe grün) |
| Datum `<input type="date">` | Textfeld TT.MM.JJJJ mit Schnellwahl (Heute, Morgen, In einer Woche, Kein Datum) | andere Bedienung; akzeptiert auch `5.3.2026`, `5/3/2026`, `2026-03-05` | `date`-/`form`-Tests |
| Gast/Konto-Speicher (`pensum.planer.v1`, Tabelle `planner`), Differenz-Schreiben | `store.ts` mit Ports | `dispose()` stoppt Retry-Timer beim Abmelden; `save()` liefert Boolean | Store-Tests |
| Link „Karteikarten lernen“ (`#deck=`) | `links.ts`: `/tools/karteikarten?deck=<id>` | Query statt Hash | `links.test.ts`, Gerät P7/K12 |
| Gastimport | `mergeGuestItems` (Grenze, neue IDs, `deckId` leer) | – | Tests; Gerät P11 |
| Ladefehler → Gast-Store-Fallback | Fehlerzustand mit „Erneut versuchen“, Aktionen gesperrt | Abweichung (sicherer, nichts landet falsch im Konto) | Gerät: Offline-Start als Konto |
| Löschen Hausaufgabe: Toast „Gelöscht.“ | kein Toast/ggf. ohne Bestätigung | laut Bericht Abweichung | Gerät P4 |
| Haptik beim Abhaken, Ausblend-Animation | `haptics.ts` vorbereitet (expo-haptics ist im Projekt) | prüfen, ob aktiv; Animation fehlt | Gerät P4 |

### Karteikarten (Web: `tools/karteikarten/*`)

| Web-Funktion | iOS-Umsetzung | Abweichung | Testnachweis |
| --- | --- | --- | --- |
| ≤ 5 Stapel, Karten, 5 Level / Alle hintereinander, Üben/Test, Auswertung | `core.ts`, `ops.ts`, `session-model.ts`, `screen.tsx` | Karten-Wegflug/Flip-Animation und Vibration fehlen | `karteikarten/__tests__` (51 Tests, Web-Fälle 1:1) |
| Zufall (Mischen) | injizierbarer `rng` | – | deterministische Tests |
| Speicher Gast/Konto (`pensum.karteikarten.v1`, `decks`/`cards`) | `store.ts` mit Ports | Gast async/serialisiert; `load()` sichert Ausstehendes zuerst | Store-Tests (Teilfehler, 500-Retry, getrennte Konten) |
| Gastimport (max. 5 Stapel, „abgelehnt“ pro Konto) | `ops.ts` + Alert | Gastdaten werden erst nach erfolgreichem Speichern gelöscht (Commit `f63d57c`) | `ops.test.ts`; Gerät K10 |
| Parameter `#deck=<id>` | `parseDeckParam`/`resolveDeckParam` (`?deck=`) | Query statt Hash; ungültig/verwaist → Liste | `index.test.ts` |
| Meldungen als Toast | Banner (antippbar, 5 s) | andere Darstellung | – |
| Stapel löschen per Halten-Knopf | Rückfrage per `Alert` | Abweichung | Gerät K1 |
| KI-Karten (Function `ki-chat`, Team `ki-tester`) | **nicht umgesetzt**, Platzhalter | Folgepaket (braucht Bild/Datei-Pakete und Functions-Port) | – |
| Vor Abmelden/Hintergrund speichern (`pagehide`/`onBeforeLogout`) | `flush()` bei AppState und Cleanup; A-Seite „drain pending saves at logout“ (`f368cee`) | Reihenfolge mit Abmelden auf dem Gerät prüfen | Gerät N12 |

### Goodnotes-Tool (Web: `tools/goodnotes/*`)

| Web-Funktion | iOS-Umsetzung | Abweichung | Testnachweis |
| --- | --- | --- | --- |
| Tinten-Engine (Layout, Skelettierung, Goodnotes-Strichformat, PDF) | **unveränderte** Engine, lokal in WebView (`engine/`, `host-html.generated.ts`), kein Netz | Seitenvorschau als PNG statt Live-Canvas; kein „Website-Fallback“ | Browser: Render → PNG, `.goodnotes` = ZIP, PDF gültig; `goodnotes/__tests__` (6 Tests: Protokoll, Base64, HTML ohne externe Ressourcen) |
| Papier (4), Schriften (6), Tinte (4), Modus Tinte/PDF, Regler Größe/Strichstärke/Unregelmäßigkeit | native Auswahl (Chips) und −/+ Regler | Regler per Schritt statt Schieberegler, gleiche Bereiche | Tests `stepValue`/`rangeLabel`; Gerät G3, G23 |
| Export `.goodnotes`/PDF per Download | Datei im Cache + iOS-Teilen-Menü (`expo-sharing`) | andere Auslieferung (Teilen statt Download) | Gerät G5–G8 |
| Bytegleiche Exporte | – | wegen Zufallsanteilen (IDs) nicht erwartbar; Format identisch (gleicher Code) | Browser (ZIP/PDF-Köpfe) |
| Eigene Vorlage (.goodnotes) mit Speicherung in `localStorage` | Auswahl über Dateidialog (`expo-document-picker`) | Vorlage gilt nur für die Sitzung (nicht gespeichert) | Gerät G9/G10 |
| Eigene Handschrift zeichnen/speichern (Tabelle `handwriting`), Variation | `HandPad.tsx` (Zeichenfeld in lokaler WebView), `hand-store.ts`, `useHand.ts` | Bedienung nativ; Variation per −/+ statt Schieberegler; Upsert über `RowsApi` (update, bei 404 create) | `goodnotes/__tests__` (Store, Pad-Nachrichten, Pad-HTML); Browser: gezeichnetes „a" → gerendert; Gerät G15–G22 |
| Mehrseiten-Dialog „n Dateien erzeugen?“ | immer eine Datei je Seite im Tinten-Modus | im PDF-Modus ebenfalls einzelne Dateien (Web bietet Alternative) | Gerät G7 |
| Übergabe aus Abschreiben (`sessionStorage`, 10 min, einmal) | `takeHandoff()` (In-Memory, gleiche Regeln) | nicht über Neustart hinweg | `shared/__tests__/handoff.test.ts` (4); Gerät G13 |
| Schriften per Webfont | Base64-`@font-face` in der WebView | Laden im WKWebView ungeprüft | Gerät G3 |

## Teil 3: Bekannte offene Punkte vor dem Release-Kandidaten

1. Kein Gerätelauf bisher; alle Zeilen in Teil 1 offen.
2. Goodnotes: Handschrift und Regler sind gebaut (Branch `codex/pensum-ios-b-goodnotes-controls`), aber nur im Browser und per Unit-Test belegt; Touch im WKWebView und der Konto-Upsert gegen echtes Appwrite sind offen.
3. Karteikarten: KI-Erzeugung fehlt (Team `ki-tester`).
4. Spiele: im Web „Kommt bald“, in der App ebenso nicht gebaut.
5. Konto-Präferenzen und Abmelde-Reihenfolge (ungespeicherte Änderungen) müssen auf dem Gerät belegt werden (N12).
6. Rechte an den Papier-Vorlagen in `templates.js` vor Veröffentlichung klären (siehe `docs/THIRD-PARTY.md`).
