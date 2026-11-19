# Abnahme-Testplan B: Notenrechner, Planer, Karteikarten, Goodnotes

Stand: 19.11.2026. Code: Integrationsbranch `codex/pensum-ios-integration` @ `d60418c` (dort `npm test` 279 von 279 grün) plus Design-Branch `codex/pensum-ios-b-design`. Web-Referenz nur gelesen: `770dbe4`. Rolle B (Claude).

**Wichtig:** Alle Angaben unter „Testnachweis“ stammen aus automatischen Tests (reine Logik, ohne Gerät) und dem Browser-Nachweis der Goodnotes-Engine. **Nichts davon ist auf einem iPhone geprüft.** Die Checkliste in Teil 1 ist dafür da. Ergebnisse dort eintragen (Datum, Gerät, iOS-Version, Expo Go oder Build, Ergebnis). Die Abnahme läuft zuerst in **Expo Go** über den LAN-Testserver (SDK 58); was dort nicht geht, steht im Abschnitt „Expo Go“ und in der Spalte „Wo“.

**Datenschutz im Test:** Nur Testkonten und synthetische Daten (z. B. Fach „Testfach A“, Stapel „Teststapel“, Text „Lernzettel Test“). Keine echten Schul- oder Personendaten, keine Passwörter oder Schlüssel in dieses Dokument oder in Git.

**Spiele** sind bewusst nicht Teil der App (Entscheidung des Auftraggebers); es gibt dazu keine Testfälle.

## Vorbereitung

| Punkt | Soll |
| --- | --- |
| Testkonten **T1** und **T2** (E-Mail bestätigt) im Appwrite-Projekt `pensum`, vom Auftraggeber angelegt | Zugangsdaten nur beim Tester, nie in Dateien |
| Testkonto **T3** im Team `ki-tester` (E-Mail bestätigt) | Nur für die KI-Kartenerzeugung (K15–K19) und Ü3 |
| Gerät | iPhone mit aktueller iOS-Version, **Expo Go** (Version zu SDK 58) und derselbe WLAN-Zugang wie der Testserver. Gerät, iOS- und Expo-Go-Version notieren |
| Website | Produktiv-URL oder lokal im Web-Ordner, mit **T1** angemeldet (für den Datenfluss Web ↔ App) |
| Zustand vor dem Test | Kein Konto angemeldet (Gast). Gastdaten liegen im Speicher von Expo Go; zum Zurücksetzen vorher abmelden und Expo Go löschen und neu installieren (die Keychain-Sitzung kann eine Neuinstallation überleben, daher erst abmelden) |
| Netz | WLAN an, Flugmodus-Schalter bereit (siehe „Offline in Expo Go“) |

Legende „Wo“: **EG** = in Expo Go prüfbar. **EG\*** = in Expo Go mit der genannten Einschränkung. **Build** = erst im signierten Build prüfbar.
Legende Modus: **G** = Gast, **K** = Konto (T1), **K2** = zweites Konto (T2), **KI** = Ki-Tester (T3).

## Expo Go: was geht, was nicht

Belegt aus dem Code (`app.config.ts`, `modules/pensum-documents/`, `src/account/`, `src/backend/`):

| Thema | In Expo Go | Prüfung stattdessen |
| --- | --- | --- |
| App-Schemes `pensum` und `appwrite-callback-6af569a7000d660f3559` (`app.config.ts`) | Expo Go besitzt nur sein eigenes Schema (`exp://`). `pensum://…` öffnet die App dort nicht, und Appwrite-Rücksprünge (Bestätigungs-/Reset-Link aus der E-Mail, Google-Anmeldung) kehren nicht in die App zurück | Interne Navigation (z. B. Planer-Link P7) prüfen. Direktlinks (K12, Ü4) und Mail-Links erst im Build. In Expo Go gilt die Expo-Konvention `exp://<Testserver>/--/tools/karteikarten` (hier nicht ausprobiert). Anmeldung per Passwort und sechsstelligem E-Mail-Code läuft in der App selbst |
| Natives Swift-Modul `PensumDocuments` (PDF-Seite rastern, Arbeitsblatt-Export; nur Werkzeug „Aufgaben“, Rolle A) | Nicht enthalten. `modules/pensum-documents/index.ts` meldet „Diese Dateifunktion benötigt einen aktuellen iOS-Build von Pensum.“ | Erst im Build. Betrifft die vier B-Werkzeuge nicht: die KI-Karten lesen ein PDF unverändert (`expo-document-picker`, `expo-file-system`), ohne Rastern |
| Appwrite-Plattform | Der Code setzt Plattform und Origin fest auf `dev.buchholz.pensum` (`src/backend/index.ts`, `src/account/transport.ts`), unabhängig vom Host. Ob der Server Anfragen aus Expo Go so akzeptiert, ist nicht belegt (Rolle A hat nur ohne Sitzung HTTP 401 bestätigt) | Zuerst Anmeldung mit T1 prüfen; scheitert sie, ist das ein Expo-Go-Befund |
| Berechtigungstexte, Name, Symbol | Kamera-/Fototexte (`app.config.ts`) gelten nur im gebauten Programm; Expo Go zeigt eigene Texte und Namen | Texte erst im Build prüfen |
| Offline in Expo Go | Der Flugmodus während die App offen ist, funktioniert. **Ein Neustart im Flugmodus nicht**: Expo Go holt das Programm vom Testserver im WLAN | N8/K8 in zwei Teilen prüfen (siehe dort); Neustart-offline im Build |
| Entwicklungsmodus | Roter Bildschirm oder Hinweisbalken bei Verbindungsverlust zum Testserver, gelbe Warnungen, langsamere Darstellung | Nicht als Befund melden, solange kein Neuladen ausgelöst wurde. Zeitmessungen (G12) sind nur im Build aussagekräftig |
| Haptik | Nur auf dem echten iPhone spürbar (nicht im Simulator) | EG |
| Teilen, Dateien, Goodnotes öffnen | iOS-Teilen-Menü funktioniert wie im Build (Dateien liegen im Cache von Expo Go) | EG |
| Neuladen der App (Schütteln → Reload) | Leert Arbeitsspeicher, auch die Textübergabe an Goodnotes (G13) | Bei Tests dazu nicht neu laden |

Wenn Expo Go bei einem Werkzeug „Native module … not found“ oder Ähnliches meldet, ist das ein Befund für die Spalte „Wo“ (dann auf Build verschieben) und bitte mit Werkzeug und Schritt melden.

## Teil 1: Checkliste manueller Test

### 1.1 Notenrechner

| Nr. | Schritt | Soll | Wo | Ergebnis |
| --- | --- | --- | --- | --- |
| N1 | G: Tool öffnen | Titel „Notenrechner.“, Schuljahr/Zeitraum/Notensystem, Hinweis „Gast-Modus. Deine Noten liegen nur auf diesem Gerät.“, Standardfächer werden beim ersten Öffnen automatisch angelegt | EG | |
| N2 | G: Note „2,3“ bei einem Fach eintragen | Durchschnitt mit Komma („2,30“), Umrechner-Gegenwert („≙ … Punkte“) plausibel | EG | |
| N3 | G: ungültig „7“ (Noten) bzw. „16“ (Punkte) | Fehlertext unter der Zeile, Durchschnitt unverändert | EG | |
| N4 | G: System auf Punkte wechseln | Noten werden umgerechnet angezeigt, Zahlentastatur | EG | |
| N5 | G: Fach hinzufügen (leer / doppelt / gültig) und Vorschlags-Chip antippen | „Gib dem Fach einen Namen.“ / Dublettenmeldung / Fach erscheint; kurze Haptik beim Hinzufügen | EG | |
| N6 | G: Fach mit Note löschen | Rückfrage mit Anzahl der Noten, danach weg samt Note; mittlere Haptik | EG | |
| N7 | G: App beenden (aus dem App-Wechsler) und neu starten (mit WLAN) | Fächer, Noten und Ansicht (Schuljahr, Halbjahr, System) sind da | EG | |
| N8 | G: (a) Flugmodus an, Daten ändern, App im Hintergrund und zurück; (b) Neustart im Flugmodus | (a) funktioniert lokal ohne Fehler und die Änderung bleibt; (b) Neustart erhält die Daten | (a) EG, (b) Build | |
| N9 | K: anmelden | Hinweis „Mit deinem Konto synchronisiert. Angemeldet als …“, Daten des Kontos (ggf. leer), Speicherstatus „Speichert … / Gespeichert“ | EG | |
| N10 | K: Note ändern, sofort App in den Hintergrund | Änderung ist gespeichert (Zeile in Appwrite oder im Web prüfen) | EG | |
| N11 | K: Flugmodus an, neue Note eintragen, Flugmodus aus | Status „Nicht gespeichert“ und Meldung „Speichern fehlgeschlagen …“. **Erwartung wie im Web:** eine Note, deren Anlegen scheiterte, wird nicht automatisch nachgeschrieben; Ergebnis (bleibt sie nach Neuladen im Konto?) bitte notieren | EG | |
| N12 | K: Flugmodus an, Note ändern, **Konto → Abmelden** | Dialog „Trotzdem abmelden?“ mit Hinweis auf nicht gespeicherte Änderungen. „Abbrechen“ lässt angemeldet. Danach Flugmodus aus und erneut abmelden: kein Dialog, nach erneutem Login ist die Änderung da | EG | |
| N13 | K: Fach/Note im Web (T1) anlegen, in der App die App in den Hintergrund und zurück (oder das Tool schließen und neu öffnen); umgekehrt App → Web | Die Web-Änderung erscheint, sofern in der App nichts ungespeichert ist und gerade nicht getippt wird | EG | |
| N14 | **Gastimport:** G Daten anlegen („Testfach A“ + Note), dann T1 anmelden | Dialog „Lokale Daten übernehmen?“; „Ins Konto übernehmen“ → Meldung mit Anzahl, Gastdaten danach gelöscht | EG | |
| N15 | Gastimport **Wiederholung:** Gast abmelden, erneut Gast-Daten mit **gleichem** Fachnamen und Schuljahr anlegen, Import wieder | **Keine Kopien** (anders als im Web): gleichnamige Fächer im selben Schuljahr werden zusammengeführt, bei vorhandener Konto-Note entfällt die Gast-Note; ohne Neues „Die lokalen Daten waren schon in deinem Konto.“ | EG | |
| N16 | Gastimport Teilfehler (Flugmodus mitten im Import) | „Die Übernahme ist nicht vollständig durchgelaufen. Deine lokalen Daten bleiben erhalten.“; Gastdaten bleiben; erneuter Import legt nur Fehlendes an; Knopf „Lokale Daten übernehmen (n)“ im Hinweis | EG | |
| N17 | Gastimport „Nicht übernehmen“ | Dialog kommt für dieses Konto nicht wieder | EG | |
| N18 | **Zwei Konten:** T1 Daten anlegen, abmelden, T2 anmelden | T2 sieht keine Daten von T1 (und umgekehrt); auch keine Gastdaten | EG | |
| N19 | Dynamische Schrift (Einstellungen → größte Stufe), VoiceOver, Dark Mode (Konto → Darstellung) | Nichts abgeschnitten, Felder per VoiceOver bedienbar | EG | |

### 1.2 Planer

| Nr. | Schritt | Soll | Wo | Ergebnis |
| --- | --- | --- | --- | --- |
| P1 | G: Hausaufgabe „Testaufgabe“ per Schnellerfassung | Erscheint, Gruppe „Ohne Datum“; leichte Haptik | EG | |
| P2 | G: Eintrag mit Datum heute / gestern / nächste Woche | Gruppen „Heute“ / „Überfällig“ / „Diese Woche“ bzw. „Später“, Kennzahlen oben stimmen | EG | |
| P3 | G: Datumsfeld im Dialog: Schalter „… festlegen“ an, Datum im Wähler ändern, Schalter aus | Deutscher Datumswähler (kompakt); Schalter an setzt heute; aus = „Ohne Datum“; gewähltes Datum wird gespeichert und angezeigt. (Die Texteingabe TT.MM.JJJJ gibt es nur außerhalb von iOS) | EG | |
| P4 | G: Aufgabe abhaken, Erledigt-Bereich öffnen, wieder öffnen; „Erledigte löschen“ | Beim Abhaken Erfolgs-Haptik, Zeile blendet kurz aus und gleitet nach rechts weg (ca. 0,3 s); Wiederöffnen leichte Haptik; „Erledigte löschen“ fragt nach | EG | |
| P5 | G: Klausur in 3 Tagen anlegen | Countdown „3 Tage“, rot bei ≤ 3 Tagen, Karte „Nächste Klausur“ | EG | |
| P6 | G: Klausur und Hausaufgabe löschen | Klausur: Rückfrage „Klausur löschen?“; Hausaufgabe ohne Rückfrage (wie im Web), beides mit Hinweis „Gelöscht.“ | EG | |
| P7 | G/K: **Planer ↔ Karteikarten:** Stapel „Teststapel“ mit Karten anlegen, Klausur mit diesem Stapel verknüpfen | Knopf „Karteikarten lernen“ öffnet den Stapel direkt (Route `?deck=<id>`) | EG | |
| P8 | Verknüpften Stapel in Karteikarten löschen, Planer öffnen | Kein Link, kein Absturz; Klausur bleibt | EG | |
| P9 | G: Neustart | Einträge erhalten | EG | |
| P10 | K: wie N9–N13 (Hintergrund, Offline, Abmelden, Web ↔ App) für Planer-Einträge | Wie Notenrechner, aber: bei Speicherfehler wiederholt der Planer nach ca. 8 s von selbst (Status → „Gespeichert“). Beim Zurückkehren in die App lädt der Planer **nicht** neu (wie im Web); neue Web-Einträge erscheinen nach Schließen und Öffnen des Tools | EG | |
| P11 | **Gastimport** Planer (Dialog „Lokale Einträge übernehmen?“), Wiederholung, Teilfehler, Konto voll | Wie N14–N17; gleiche Einträge (Art + Titel + Datum + Fach) werden nicht doppelt angelegt; `deckId` wird beim Import geleert; passt nicht alles ins Konto, bleibt der Rest lokal | EG | |
| P12 | **Zwei Konten** | T2 sieht nichts von T1 | EG | |
| P13 | Tageswechsel: App über Mitternacht im Hintergrund, dann öffnen | Gruppen/„Heute“ aktualisieren sich | EG | |
| P14 | Dynamische Schrift, VoiceOver, Dark Mode | Wie N19; Datumswähler und Schalter per VoiceOver bedienbar | EG | |
| P15 | „Bewegung reduzieren“ an (Einstellungen → Bedienungshilfen → Bewegung) | Abhaken ohne Ausblend-Animation, sofort umgeschaltet | EG | |
| P16 | Planer offline starten als Konto (Neustart im Flugmodus) | Fehlerzustand „Planer nicht geladen“ mit „Neu laden“, Aktionen gesperrt, nichts landet im Konto | Build | |

### 1.3 Karteikarten

| Nr. | Schritt | Soll | Wo | Ergebnis |
| --- | --- | --- | --- | --- |
| K1 | G: Stapel anlegen (leerer Name / gültig, Abfrage „Level (5 Stufen)“ und „Alle hintereinander“) | „Gib dem Stapel einen Namen.“ / Stapel öffnet Tab „Hinzufügen“ | EG | |
| K2 | G: 6 Stapel versuchen | Ab dem 6. kein neuer („Du kannst höchstens 5 Stapel haben.“) | EG | |
| K3 | G: Karten hinzufügen, bearbeiten, löschen; leere Seite | „Fülle Vorder- und Rückseite aus.“ | EG | |
| K4 | G: Üben (Umdrehen, „Gewusst/Nicht gewusst“) im Level-Modus | Level steigt/fällt, falsche Karte kommt ans Ende, Fortschritt stimmt. Umdrehen mit Auswahl-Haptik, Karte fliegt nach Bewertung weg (richtig nach rechts, falsch nach links), Haptik richtig/falsch, Erfolgs-Haptik am Rundenende | EG | |
| K5 | G: Test (schriftlich) mit richtiger, falscher, fast richtiger Antwort, „Trotzdem richtig“ | Wie im Web; „Richtig wäre: …“ | EG | |
| K6 | G: Rundenabbruch über Schließen | Rückfrage „Runde wirklich beenden?“, Level bleiben gespeichert | EG | |
| K7 | G: Alle Karten Level 5, erneut starten | „Alles gelernt.“ → „Von vorn beginnen“ setzt alle auf Level 1 | EG | |
| K8 | G: (a) Flugmodus an, weiterarbeiten; (b) Neustart im Flugmodus | (a) und (b): Stapel, Karten, Level erhalten | (a) EG, (b) Build | |
| K9 | K: anmelden, Daten anlegen, Hintergrund/Offline/Abmelden/Web ↔ App | Wie N9–N13; bei Speicherfehler Wiederholung nach ca. 8 s; neue Web-Daten erscheinen nach Schließen und Öffnen des Tools | EG | |
| K10 | **Gastimport** (Dialog mit Anzahl), Wiederholung, Teilfehler, Konto voll, „Nicht übernehmen“ | Höchstens 5 Stapel im Konto; gleicher Stapelname mit gleichen Kartenpaaren wird nicht doppelt angelegt; Gast wird nur nach vollständigem Import gelöscht | EG | |
| K11 | **Zwei Konten** | T2 sieht nichts von T1 | EG | |
| K12 | Link `/tools/karteikarten?deck=<gültige id>` und `?deck=unbekannt`: (a) aus dem Planer (P7), (b) als externer Direktlink | Gültig: Stapel offen; unbekannt: Liste, kein Absturz | (a) EG, (b) Build | |
| K13 | Dynamische Schrift, VoiceOver (Karte, Tabs, Level-Anzeige), Dark Mode, „Bewegung reduzieren“ | Wie N19; mit „Bewegung reduzieren“ kein Wegfliegen | EG | |
| K14 | Nicht-Tester (G oder K ohne Team): Dialog „Neuer Stapel“ | Zeile „Mit KI erstellen (Kommt bald)“ ausgegraut mit Text „Bald gibst du nur dein Thema ein …“; kein Schalter | EG | |
| K15 | **KI:** Dialog „Neuer Stapel“ mit T3 | Schalter „Mit KI erstellen“; bei „an“: Thema (bis 500 Zeichen), „Foto wählen“, „Foto aufnehmen“, „PDF wählen“, Anzahl (10, 15, 20, 30, 40, „Alle (bis 60)“, Standard 60) | EG | |
| K16 | KI: **Einverständnis** – „Stapel erstellen“ mit Thema | Rückfrage „Inhalt an Google Gemini senden?“ (Zustimmen und senden / Abbrechen). Bei Abbrechen: nichts gesendet, kein Stapel angelegt. Die Zustimmung wird nicht gemerkt (jede Anfrage fragt neu) | EG | |
| K17 | KI: Thema „Photosynthese“ (nur Text), danach Foto (Mediathek/Kamera) und kleines PDF (< 2,5 MB) | „Die KI liest und schreibt deine Karten …“, dann „Vorschlag der KI (n Karten)“, alle angehakt; Antippen schaltet; „n Karten hinzufügen“ trägt ein (doppelte Vorderseiten werden übersprungen, Meldung nennt die Zahl); „Verwerfen“ räumt weg. Fotos werden vor dem Senden verkleinert | EG (Kamera: Expo-Go-Berechtigung) | |
| K18 | KI: Fehlerfälle soweit auslösbar: leere Eingabe; PDF > 2,5 MB; defekte Datei; Flugmodus; Tageslimit; nicht bestätigte E-Mail; Konto ohne Team | Meldungen wie im Web: „Gib ein Thema ein oder wähle ein Foto für die KI.“, „Das PDF ist zu groß …“, „Diese Datei kann die KI nicht lesen …“, „Die KI antwortet gerade nicht …“, „Für heute ist das Limit erreicht …“, „Bitte bestätige zuerst deine E-Mail-Adresse.“, „… nur für das Team „Ki-Tester“ freigeschaltet.“; weitere Codes (leer, blockiert, überlastet, nicht eingerichtet) nur beobachten, falls sie auftreten. Kein Absturz | EG | |
| K19 | KI: während die KI arbeitet, Abmelden oder Konto wechseln | Kein Ergebnis im anderen Konto; Eingabedatei wird aufgeräumt | EG | |

### 1.4 Goodnotes-Tool

| Nr. | Schritt | Soll | Wo | Ergebnis |
| --- | --- | --- | --- | --- |
| G1 | Tool öffnen (Gast) | „Engine startet …“ verschwindet, Vorschau zeigt Seite in Handschrift | EG | |
| G2 | Text ändern | Vorschau aktualisiert sich nach kurzer Pause | EG | |
| G3 | Schrift (alle 6), Papier (4), Tintenfarbe (4), Ausgabe „Echte Tinte“/„PDF-Seite“ | Jede Auswahl ändert die Vorschau; **Schriften laden im WKWebView** (nicht Standardschrift) | EG | |
| G4 | Langer Text (> 1 Seite) | „n Seiten“, mehrere Vorschaubilder | EG | |
| G5 | **PDF exportieren** | Teilen-Menü; „In Dateien sichern“; PDF öffnet sich, Seitenzahl stimmt; ein PDF für alle Seiten | EG | |
| G6 | **.goodnotes exportieren** (1 Seite) | Teilen-Menü; Datei in Goodnotes öffnen (Teilen → Goodnotes), Striche sind echte Tinte (radierbar), Vorlage stimmt | EG | |
| G7 | .goodnotes bei mehreren Seiten | **Kein Vorab-Dialog** (anders als im Web): eine Datei je Seite, nacheinander je ein Teilen-Menü, Namen „Name (1).goodnotes …“ | EG | |
| G8 | Dateiname mit Sonderzeichen `/ : * ?` | Wird zu „-“, Export klappt | EG | |
| G9 | Eigene Vorlage (einseitige .goodnotes aus Dateien wählen) | Name erscheint („Geladen: …“), Export nutzt Vorlage; „Entfernen“ geht zurück; Vorlage gilt nur, solange das Tool offen ist | EG | |
| G10 | Defekte oder zu große (> 25 MB) Datei als Vorlage | Verständliche Fehlermeldung, App bleibt benutzbar | EG | |
| G11 | Flugmodus nach dem Öffnen des Tools | Alles funktioniert (Engine ist lokal gebündelt, kein Netz) | EG | |
| G12 | 3 Seiten + Echte Tinte auf dem ältesten Testgerät, Export | Kein Absturz der WebView, akzeptable Dauer (Zeit notieren) | Build (EG nur auf Absturz) | |
| G13 | **Textübergabe** aus Abschreiben (auch Mindmap, KI-Chat, Aufgaben) per Knopf „In Goodnotes-Tool übernehmen“ | Text und Name erscheinen einmal („Text aus dem vorherigen Werkzeug übernommen.“); erneutes Öffnen zeigt sie nicht mehr; nach > 10 Minuten verfällt sie; Abmelden/Kontowechsel verwirft sie. Abschreiben braucht Konto und Foto/Kamera | EG | |
| G14 | Dynamische Schrift, VoiceOver, Dark Mode | Bedienelemente (44 pt) benutzbar | EG | |
| G15 | **Eigene Handschrift (Gast):** „Eigene Handschrift zeichnen“, 3 Zeichen mit Finger/Apple Pencil schreiben, „Speichern“ | Striche folgen dem Finger ohne Scrollen des Blattes, Fortschritt „Zeichen n von 85 · k gezeichnet“, „Meine Handschrift“ erscheint | EG | |
| G16 | Handschrift: Zurück, Weiter/Überspringen, Rückgängig, Zeichen leeren, Sprung über die Zeichenliste | Verhalten wie im Web; letzte Taste heißt „Fertig“ und speichert | EG | |
| G17 | Handschrift wählen, Text mit gezeichneten und nicht gezeichneten Zeichen, „Natürlich variieren“ an/aus und −/+ | Vorschau in eigener Schrift; fehlende Zeichen mit Lücke; Variation sichtbar („leicht/mittel/stark“) | EG | |
| G18 | Handschrift: Neustart der App | Handschrift bleibt (Gast: Gerät, Konto: Appwrite) | EG | |
| G19 | **Handschrift Konto:** T1 anmelden, speichern; in Appwrite Zeile `handwriting` mit Zeilen-ID = Benutzer-ID und Rechten nur für T1 prüfen; erneut speichern (Update) | Eine Zeile, kein Duplikat, `glyphs` JSON | EG | |
| G20 | **Handschrift Gastimport:** Gast-Handschrift anlegen, mit T1 (ohne Konto-Handschrift) anmelden | Dialog „Lokale Handschrift übernehmen?“; „Ins Konto übernehmen“ → Gast-Eintrag gelöscht; „Nicht übernehmen“ → kommt für T1 nicht wieder; Fehler (Flugmodus) → Gast bleibt | EG | |
| G21 | Handschrift **zwei Konten:** T2 anmelden | T2 sieht die Handschrift von T1 nicht | EG | |
| G22 | Handschrift löschen (Rückfrage) und Offline-Speichern | Gelöscht, Schrift fällt auf Caveat zurück; Offline → verständliche Fehlermeldung, nichts geht still verloren | EG | |
| G23 | Regler Schriftgröße / Strichstärke (nur „Echte Tinte“) / Unregelmäßigkeit (− / +) | Werte und Beschriftung wie Web („1,0×“, „wie die Schrift“, „mittel“ …), Vorschau passt sich an | EG | |
| G24 | Robustheit der WebViews: sehr langer Text (viele Seiten) mit Echter Tinte, Hintergrund/Vordergrund während des Renderns, Zeichenfeld öffnen/schließen | Nicht gezielt auslösbar; beobachten: bei Zeitüberschreitung „Die Engine antwortet nicht.“ (Vorschau 20 s, Export 60 s), nach Absturz „Die Engine wurde neu gestartet. Versuch es noch einmal.“, nach dem vierten Absturz innerhalb von 60 s „Die Schreib-Engine ist mehrfach abgestürzt …“; danach bleibt das Tool bedienbar (gemerkte Vorlage wird neu geladen) | EG | |

### 1.5 Übergreifend

| Nr. | Schritt | Soll | Wo | Ergebnis |
| --- | --- | --- | --- | --- |
| Ü1 | Kaltstart, Warmstart, Hintergrund/Vordergrund je Werkzeug | Kein Datenverlust, keine veralteten Anzeigen | EG | |
| Ü2 | Kontowechsel T1 → T2 → T1 | Jedes Konto sieht nur seine Daten; die Goodnotes-Ansicht wird beim Wechsel neu aufgebaut (Text, Vorlage zurückgesetzt) | EG | |
| Ü3 | Tool-Sichtbarkeit nach Rolle (Gast, Konto, Tester, T3) laut Katalog | Gast und Konto sehen die vier B-Werkzeuge; Tester-Werkzeuge (Aufgaben, Erklärvideos) gesperrt sichtbar, KI-Chat und Team ohne Rolle unsichtbar; Spiele kommen in der App nicht vor | EG | |
| Ü4 | Direktlink `pensum://tools/notenrechner` usw. im Kaltstart und bei laufender App | Öffnet das Tool (Auth-Links: Rolle A) | Build | |
| Ü5 | Sitzung abgelaufen (Appwrite-Sitzung serverseitig beenden) | Verständliche Meldung, keine Daten des Kontos mehr sichtbar | EG | |

## Teil 2: Web-Funktion → iOS-Umsetzung → Abweichung → Testnachweis

Testnachweis = automatische Tests im App-Repo (`npm test`; `node:test` über `tsx`). Stand Integrationsbranch `d60418c`: **279 von 279 grün**; je Ordner `npx tsx --test "src/features/<ordner>/**/*.test.ts"`: notenrechner 78, planer 74, karteikarten 73, goodnotes 33, shared 7. Dazu `tests/goodnotes-export.test.ts` (2). **Kein Gerätenachweis**, außer wo „Browser“ steht.

### Notenrechner (Web: `tools/notenrechner/*`)

| Web-Funktion | iOS-Umsetzung | Abweichung | Testnachweis |
| --- | --- | --- | --- |
| Noten/Punkte-Umrechnung, Zeugnisdurchschnitt, Halbjahre, Schuljahr | `core.ts`, `model.ts`, `ui-model.ts`, `screen.tsx` | keine fachliche | `core.test.ts` (20, Web-Fälle 1:1 aus `tests/notenrechner.test.mjs`), `model.test.ts` (10), `ui-model.test.ts` (8) |
| Zahlenformat `Intl.NumberFormat("de-DE")` | `createNumberFormatter` mit Selbsttest und manuellem Fallback | Fallback zeigt −0,004 als „0,00“ (Intl: „-0,00“) | Vergleich mit echtem Intl über 3000 Zufallswerte plus Fixwerte in `core.test.ts` |
| Gast: `localStorage` | `KeyValueStore` (AsyncStorage), gleiche Schlüssel (`pensum.notenrechner.guest.v1`) | asynchron; Schreibzugriffe nacheinander | `store.test.ts` (21) mit `memoryKv` |
| Konto: Appwrite `subjects`/`grades`, Zeilenrechte nur Besitzer | `createCloudStore` mit `RowsApi` (Rolle A: `src/storage`) | Lokales Limit 3 parallel, 2 Wiederholungen wie im Web | `store.test.ts` (getrennte Konten, 500-Retry, 409/404) |
| Gastimport | `importGuestSafe` + `planGuestImport`, Dialog per `Alert` | **Dedupliziert** (Web legt bei jeder Übernahme neue Fächer an): gleichnamige Fächer im selben Schuljahr werden zusammengeführt, Konto-Note gewinnt. Gastdaten werden erst nach bestätigtem Cloud-Save (`flushOrThrow`) gelöscht; Teilfehler lässt sie stehen | `import.test.ts` (12: Wiederholung, Teilfehler Fach/Noten, 500, Zusammenführen) |
| Vor dem Abmelden speichern (Web: `pagehide`) | `registerBeforeLogout` → `flushOrThrow`; Fehler werden weitergegeben, die Kontoseite fragt „Trotzdem abmelden?“ (Frist 5 s, `session.tsx`) | A-Verhalten, Web hat keinen Dialog | `flush.test.ts` (7); Gerät N12 |
| Ansicht (Schuljahr, Halbjahr, System) im Konto (Einstellungen `nrSystem`, `nrYear`, `nrHalf`) | `useNotenrechner.changeView` → `updatePrefs`; Gast: `KeyValueStore` | – | `ui-model.test.ts`; Gerät N7, N13 |
| Neu laden beim Zurückkehren (`visibilitychange`) | `AppState` „active“: nur im Konto, wenn nichts ungespeichert ist und nicht getippt wird | – | Gerät N10, N13, Ü1 |
| Haptik (Web: `navigator.vibrate`) | `haptics.ts` (`expo-haptics`): leicht beim Hinzufügen, mittel beim Löschen eines Fachs | beim Eintragen der Note keine | Gerät N5, N6 |
| Note, deren Anlegen scheitert | `saved: false`, kein automatisches Nachschreiben | gleich wie im Web (siehe Teil 3) | Gerät N11 |

### Planer (Web: `tools/planer/*`)

| Web-Funktion | iOS-Umsetzung | Abweichung | Testnachweis |
| --- | --- | --- | --- |
| Hausaufgaben/Klausuren, Gruppen, Countdown, Kennzahlen | `core.ts`, `model.ts`, `controller.ts`, `screen.tsx` | Wochentag vor 1970 jetzt korrekt (Web: „undefined“) | `core.test.ts` (17), `model.test.ts` (23); Zeitzonenläufe UTC, Kiritimati, Los Angeles, Berlin, Lord Howe: jeweils 74/74 grün |
| Datum `<input type="date">` | iOS: Schalter „Datum festlegen“ + nativer kompakter Datumswähler (`@react-native-community/datetimepicker`, `de-DE`); sonst Textfeld TT.MM.JJJJ | andere Bedienung; Wert bleibt Text „TT.MM.JJJJ“, `parseDateInput` akzeptiert auch `5.3.2026` und `2026-03-05` | `model.test.ts` (Datumsformate, Wähler-Umrechnung); Gerät P3 |
| Gast/Konto-Speicher (`pensum.planer.v1`, Tabelle `planner`), Differenz-Schreiben | `store.ts` mit Ports | `dispose()` stoppt den Retry-Timer beim Abmelden; `save()` liefert Boolean; Wiederholung nach 8 s | `store.test.ts` (23) |
| Link „Karteikarten lernen“ (`#deck=`) | `links.ts`: `/tools/karteikarten?deck=<id>` | Query statt Hash | `links.test.ts` (4); Gerät P7, K12 |
| Gastimport | `importGuestItems` + `planGuestImport` | Gast wird erst nach `flushOrThrow` gelöscht; gleiche Einträge werden nicht doppelt angelegt; `deckId` wird geleert; Konto voll → Rest bleibt lokal | `import.test.ts` (7: Erfolg, Teilfehler, Wiederholung, schon im Konto, Konto voll) |
| Vor dem Abmelden speichern | `registerBeforeLogout` → `flushOrThrow` | wie Notenrechner | `store.test.ts`; Gerät N12/P10 |
| Ladefehler → Gast-Store-Fallback | Fehlerzustand „Planer nicht geladen“ mit „Neu laden“, Aktionen gesperrt | sicherer als Web (nichts landet falsch im Konto) | Gerät P16 (nur Build, Neustart offline) |
| Löschen Hausaufgabe: Toast „Gelöscht.“, ohne Rückfrage | gleich; Klausur und „Erledigte löschen“ mit Rückfrage per `Alert` | – | Gerät P4, P6 |
| Haptik, Ausblend-Animation beim Abhaken | `haptics.ts` (`expo-haptics`: Erfolg beim Erledigen, leicht sonst), `Animated` 280 ms Ausblenden und 24 pt Wegschieben; bei „Bewegung reduzieren“ ohne Animation | – | Gerät P4, P15 |
| `visibilitychange`: neuer Tag | `AppState` „active“ und Timer bis Mitternacht | kein Neuladen der Daten (Web ebenfalls nicht) | `core.test.ts` (injizierbares „heute“); Gerät P13 |

### Karteikarten (Web: `tools/karteikarten/*`)

| Web-Funktion | iOS-Umsetzung | Abweichung | Testnachweis |
| --- | --- | --- | --- |
| ≤ 5 Stapel, Karten, 5 Level / Alle hintereinander, Üben/Test, Auswertung | `core.ts`, `ops.ts`, `session-model.ts`, `screen.tsx`, `components/` | – | `core.test.ts` (13), `session-model.test.ts` (10), `ops.test.ts` (6), Web-Fälle 1:1 |
| Wegfliegen der Karte (`.out-ok`/`.out-bad`), Vibration | `components/Study.tsx` (`FlyAway`, 280 ms; ohne bei „Bewegung reduzieren“), `components/haptic.ts` (`expo-haptics`) | Animation nativ nachgebaut | Gerät K4, K13 |
| Zufall (Mischen) | injizierbarer `rng` | – | deterministische Tests |
| Speicher Gast/Konto (`pensum.karteikarten.v1`, `decks`/`cards`) | `store.ts` mit Ports | Gast asynchron; `load()` sichert Ausstehendes zuerst; Wiederholung nach 8 s | `store.test.ts` (16: Teilfehler, 500-Retry, getrennte Konten) |
| Gastimport (max. 5 Stapel, „abgelehnt“ pro Konto) | `ops.ts` (`importGuestDecks`, `importIntoAccount`) + Alert | Gastdaten erst nach erfolgreichem Speichern gelöscht; gleicher Stapelname + gleiche Kartenpaare nicht doppelt | `flush-import.test.ts` (11), `ops.test.ts`; Gerät K10 |
| Vor dem Abmelden speichern | `registerBeforeLogout` → `flushOrThrow`; Speichern auch bei `AppState` ≠ active | – | `flush-import.test.ts`; Gerät N12/K9 |
| Parameter `#deck=<id>` | `parseDeckParam`/`resolveDeckParam` (`?deck=`) | Query statt Hash; ungültig/verwaist → Liste | `index.test.ts` (6) |
| Meldungen als Toast | Banner (5 s) | andere Darstellung | – |
| Stapel löschen per Halten-Knopf | Rückfrage per `Alert` im Bearbeiten-Dialog | Abweichung | Gerät K1 |
| KI-Karten (Function `ki-chat`, Team `ki-tester`, Foto/PDF) | `ki/cards.ts`, `ki/files.ts`, `ki/KiBlock.tsx`, Dialog; nur `access.kiTester`; Einverständnis (`consentToGemini`) vor jedem Upload; Foto/Kamera über `expo-image-picker`/`expo-image-manipulator`, PDF unverändert bis 2,5 MB; alle Fehlercodes der Function auf deutsche Texte abgebildet; Nicht-Tester sehen „Kommt bald“ | Auswahl per Vorschlagsliste wie im Web; Zustimmung nativ per Alert | `ki-cards.test.ts` (11: Anfrage, Grenzen, Fehlercodes, Antwort-Prüfung, Doppelte); Gerät K14–K19 |

### Goodnotes-Tool (Web: `tools/goodnotes/*`)

| Web-Funktion | iOS-Umsetzung | Abweichung | Testnachweis |
| --- | --- | --- | --- |
| Tinten-Engine (Layout, Skelettierung, Goodnotes-Strichformat, PDF) | **unveränderte** Engine, lokal in WebView (`engine/`, `host-html.generated.ts`), kein Netz, kein Website-Fallback; jsPDF **4.2.1** (statt 2.5.1) | Seitenvorschau als PNG statt Live-Canvas | Browser: Render → PNG, `.goodnotes` = ZIP, PDF gültig (auch nach dem jsPDF-Wechsel); `jspdf-version.test.ts` (3: Version, SHA-256 in `THIRD-PARTY.md`, Host-HTML aktuell); `tests/goodnotes-export.test.ts` (2: Export nutzt den aktuellen Text) |
| Papier (4), Schriften (6), Tinte (4), Modus Tinte/PDF, Regler Größe/Strichstärke/Unregelmäßigkeit | native Auswahl (Chips) und −/+ Regler | Regler per Schritt statt Schieberegler, gleiche Bereiche | `protocol.test.ts` (11: `stepValue`, `rangeLabel`, Dateinamen); Gerät G3, G23 |
| Export `.goodnotes`/PDF per Download | Datei im Cache + iOS-Teilen-Menü (`expo-sharing`), danach gelöscht | Teilen statt Download | Gerät G5–G8 |
| Mehrseiten-Dialog „n Dateien erzeugen?“ | kein Dialog; `.goodnotes`: eine Datei je Seite, nacheinander geteilt; PDF: eine Datei für alle Seiten | Abweichung (Web fragt vorher; PDF-Seitenzahl stimmt) | `protocol.test.ts` (`exportFileNames`); Gerät G7 |
| Bytegleiche Exporte | – | wegen Zufallsanteilen (IDs) nicht erwartbar; Format identisch (gleicher Code) | Browser (ZIP/PDF-Köpfe) |
| Eigene Vorlage (.goodnotes) mit Speicherung in `localStorage` | Auswahl über Dateidialog (`expo-document-picker`), bis 25 MB | Vorlage gilt nur, solange das Tool offen ist (nicht gespeichert) | Gerät G9/G10 |
| Eigene Handschrift zeichnen/speichern (Tabelle `handwriting`), Variation | `HandPad.tsx` (zweite lokale WebView, `engine/pad-bridge.js`), `hand-store.ts`, `useHand.ts` | Bedienung nativ; Variation per −/+; Upsert über `RowsApi` (update, bei 404 create, 409 → update) | `hand-store.test.ts` (7: Gast, Konto-Upsert, Gastimport, Ablehnen); Browser: gezeichnetes „a“ → gerendert; Gerät G15–G22 |
| WebView-Zeitlimit und Absturz (neu, kein Web-Pendant) | `request-queue.ts`, `useWebViewChannel.ts`: Zeitlimit 20 s (Export 60 s), Abbruch offener Anfragen, Neustart nach Absturz (höchstens 3 Neustarts je 60 s, danach Aufgeben mit Meldung), Aufräumen beim Schließen | – | `request-queue.test.ts` (12); Gerät G24 |
| Übergabe aus Abschreiben (`sessionStorage`, 10 min, einmal) | `takeHandoff()` (nur Arbeitsspeicher, gleiche Regeln); auch aus Mindmap, KI-Chat, Aufgaben; verworfen bei Abmelden und Kontowechsel | nicht über Neustart hinweg | `shared/__tests__/handoff.test.ts` (4); Gerät G13 |
| Schriften per Webfont | Base64-`@font-face` in der WebView | Laden im WKWebView ungeprüft | Gerät G3 |

### Spiele

Bewusst nicht Teil der iOS-App (Entscheidung des Auftraggebers): kein Modul, keine Route, keine Assets, kein Katalogeintrag (`tools.test.ts` prüft, dass `spiele` fehlt).

## Teil 3: Bekannte offene Punkte vor dem Release-Kandidaten

1. Kein Gerätelauf bisher; alle Zeilen in Teil 1 offen. Erste Runde in Expo Go, danach die mit „Build“ markierten Zeilen im signierten Build (Apple-Developer-Team und Signierung fehlen noch).
2. Goodnotes: Handschrift, Regler und WebView-Härtung sind nur im Browser und per Unit-Test belegt. Touch im WKWebView, Schriftladen im WKWebView, Teilen-Menü, Öffnen in Goodnotes und der Konto-Upsert gegen echtes Appwrite sind offen (G3, G6, G15–G19).
3. Karteikarten-KI ist gebaut, aber nur mit Mocks getestet; die Function `ki-chat`, Einverständnis und Fotoaufnahme brauchen einen echten Ki-Tester-Test (K15–K19).
4. Spiele: bewusst nicht Teil der iOS-App.
5. Konto-Präferenzen (Notenrechner-Ansicht) und die Abmelde-Reihenfolge müssen auf dem Gerät belegt werden (N7, N12).
6. Rechte an den Papier-Vorlagen in `templates.js` vor Veröffentlichung klären (siehe `docs/THIRD-PARTY.md`).
7. Wie im Web: Eine Note im Notenrechner, deren Anlegen im Konto scheitert, wird nicht automatisch erneut geschrieben (Statuszeile „Nicht gespeichert“, N11). Planer und Karteikarten wiederholen nach 8 s.
8. Dieser Plan prüft Funktion, nicht das Aussehen. Das neue Design (Schrift Inter, Karten, Leiste) liegt auf `codex/pensum-ios-b-design`; ob die Expo-Go-Testinstallation es schon enthält, ist nicht belegt.
