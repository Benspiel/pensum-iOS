# iPhone-Schnelltest (Expo Go, ca. 45 Minuten)

Die Reihenfolge ist nach Risiko sortiert: Zuerst das, was am ehesten kaputt ist und worauf alles andere aufbaut. Die Nummern (N, P, K, G, Ü) sind die Testfälle aus `docs/b-abnahme-testplan.md`. Dort stehen auch Soll-Verhalten und die Grenzen von Expo Go. Alle Ergebnisse gelten nur für den Stand, den du gerade getestet hast. Gib bei einer Meldung Datum, Gerät und iOS-Version an.

Nur Testkonten und synthetische Daten verwenden. Keine echten Schul- oder Personendaten.

## 0. Vorbereitung (5 Minuten)

- Testserver läuft, iPhone im selben WLAN, Pensum in Expo Go geöffnet.
- Zwei Testkonten **T1** und **T2** (E-Mail bestätigt). Für die KI-Karten ein Konto **T3** im Team `ki-tester`. Zugangsdaten nie in Dateien oder Git.
- Bildschirmaufnahme einschalten, falls möglich. Das spart später das Beschreiben von Fehlern.

## 1. Start und Design (5 Minuten)

1. Startseite im hellen und im dunklen Modus ansehen und mit der Website vergleichen: Schrift, Pill-Leiste oben, Tool-Karten, Hero. Das Design habe ich bisher **nur im Browser-Render** gesehen.
2. Prüfe besonders: Wird Inter geladen (und nicht die Systemschrift)? Sind die Symbole (SF Symbols) da? Sieht der Header sauber aus?
3. Jedes der vier Werkzeuge einmal öffnen und zurückgehen (Ü1). Gibt es einen roten Bildschirm oder „Native module … not found“, sofort melden.

## 2. Anmeldung (5 Minuten)

- Mit **T1** anmelden. Scheitert es, ist das der wichtigste Befund. Ob der Server Anfragen aus Expo Go mit der fest eingestellten Kennung akzeptiert, ist nicht belegt.
- Abmelden und wieder anmelden. Dann Ü2 (Kontowechsel T1 → T2 → T1).
- Nicht in Expo Go prüfbar: E-Mail-Links, Google-Anmeldung, Direktlinks `pensum://` (Ü4).

## 3. Notenrechner (8 Minuten)

- Gast: N1 bis N7, also Note eintragen, ungültige Werte, Punkte, Fach hinzufügen und löschen, App beenden und neu öffnen.
- Konto (T1): N9, N10, N12 (Abmelden bei ausgeschalteter Verbindung zeigt den Dialog „Trotzdem abmelden?“).
- Gastimport N14 bis N17.

## 4. Planer (8 Minuten)

- Gast: P1 bis P6, dazu P3 (Datumswähler) und P4 (Abhaken mit Haptik und Ausblenden).
- P7: Klausur mit einem Karteikarten-Stapel verknüpfen und auf „Karteikarten lernen“ tippen.
- Konto: P10, Gastimport P11.

## 5. Karteikarten (8 Minuten)

- Gast: K1 bis K7, besonders das Umdrehen der Karte, der schriftliche Test (K5) und der Wegfliegen-Effekt.
- Konto: K9, Gastimport K10.
- KI mit **T3**: K15 bis K17 (Einverständnis, nur Text, Foto). Ohne Team-Konto muss der Platzhalter „Kommt bald“ erscheinen (K14).

## 6. Goodnotes (10 Minuten)

- G1 bis G5: Vorschau erscheint, Schrift, Papier und Farbe wechseln, mehrere Seiten, **PDF exportieren und teilen**.
- G6: `.goodnotes` exportieren und in Goodnotes öffnen.
- G15 bis G18: Eigene Handschrift zeichnen (Finger oder Apple Pencil), speichern, App neu starten.
- Prüfe besonders: Laufen die Schriften in der WebView (nicht die Standardschrift)? Folgt das Zeichenfeld dem Finger, ohne dass die Seite scrollt?

## 7. Danach, falls Zeit bleibt

- Dynamische Schrift auf die größte Stufe (N19, P14, K13, G14) und VoiceOver kurz anschalten.
- Zwei Konten und Web ↔ App: N13, N18, P12, K11.
- Flugmodus-Fälle: N8a, K8a, N11, N12.

## So meldest du einen Fehler

Eine Zeile reicht:
**Werkzeug · Testfall (z. B. P4) · erwartet · tatsächlich · Gerät und iOS-Version · Gast oder Konto (T1, T2, T3)**, dazu Bildschirmfoto oder Aufnahme ohne echte Daten.

Der Code je Werkzeug steht in `docs/b-uebergabe.md`, Abschnitt 5. Sicher nicht in Expo Go prüfbar und deshalb **kein Fehler**: Mail-Links, Google-Anmeldung, Direktlinks, das PDF-Rastern der Aufgaben und ein Neustart ohne WLAN.
