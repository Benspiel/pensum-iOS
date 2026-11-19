# Pensum Web und iOS

Web-Referenz: `main` bei `770dbe4e26236e4371126f5fcd2b9ea864b767d3`. Die Web-Suite bestand mit 140 Tests. Die Startseite, Konto und alle elf Tool-Routen lieferten im lokalen Webserver HTTP 200. Der native Funktionsnachweis ist in JavaScript-Prüfungen und Geräteabnahme getrennt.

| Funktion | iOS-Umsetzung | Unterschiede und Geräteabnahme |
| --- | --- | --- |
| Notenrechner | Native Route, Gast- und Kontospeicher, fachliche Berechnung aus dem Web | Noten/Punkte, Halbjahr und Jahreswechsel auf dem Gerät prüfen. |
| Planer | Native Route, Gast- und Kontospeicher, Datumswahl und Stapel-Link | App-Link `/tools/karteikarten?deck=<id>`; Browser verwendet `#deck=<id>`. Neustart und Gastimport auf dem Gerät prüfen. Teilfehler und Wiederholungen sind durch Speichertests abgedeckt. |
| Karteikarten | Native Route, Gast- und Kontospeicher, Lernstapel und Modi; Karten aus Text, Foto oder PDF mit KI nur für Ki-Tester | Planer-Direktlink, Upgrade bestehender Kontodaten und Kontotrennung prüfen. |
| Mindmap | Nativ über Appwrite, Kontoliste, KI-Anlage und -Änderung, Baumeditor | Verschachtelter Editor mit explizitem Speichern, PDF der Baumstruktur und Textübergabe. Ausdruck des Denkbaums, native Canvas-Gestaltung und Handschrift im Dokument unterscheiden sich vom Web. |
| Abschreiben | Nativ über Appwrite, Kamera/Fotos, Tageslimit, Textbearbeitung und Kopieren | Textübergabe an Goodnotes-Tool liegt im App-Speicher. Kamera, Berechtigungen und Rückkehr aus dem Fotosystem prüfen. |
| Aufgaben | An Tester gebunden; Foto/PDF, Seitenauswahl, Antworten, PDF- und Bildexport | Öffnet eine PDF-Seite per Core Graphics, bietet Standardschrift und einen iOS-Handschriftstil. Eigene Handschrift läuft als Textübergabe zum Goodnotes-Tool. Xcode-Gerätenachweis für das Dokumentmodul steht aus. |
| Erklärvideos | Derzeit gesperrt | `lehrer-schmidt` fehlt im produktiven Projekt. Der App-Code enthält die Suche für die bestehende Function und eine explizite Öffnung in YouTube. |
| KI-Chat | Nativ über Appwrite, nur für Ki-Tester, mit Foto/PDF, Klassenstufe und dauerhaftem Verlauf | Server speichert die Chatdaten. Schrittanzeige nur für frische Antworten. Markdown wird vereinfacht angezeigt. Tool mit synthetischem Ki-Tester-Konto abnehmen. |
| Team | Nativ, nur für Admins und mit serverseitiger Team-Prüfung | Statistik und Nutzungsübersicht als native Listen mit bestehenden Backend-Zahlen. Die App erfasst in diesem Stand keine neuen Werkzeugbesuche. Betriebsdaten mit freigegebenem Admin-Testzugriff prüfen. |
| Goodnotes-Tool | Siehe [Goodnotes- und Spiele-Plan](b-goodnotes-spiele-plan.md) und den gemeinsamen Abnahmestand | Texteingabe, Handschrift, PDF, `.goodnotes` und Übergaben separat prüfen. |
| Spiele | Vier gewinnt nativ, nur für das Tester-Team | Asteroids, Dino-Runner, Arcade und Schach sind in iOS offen. Der Stand enthält keine Website-Einbettung. Einzelheiten stehen im [Spiele-Funktionsvergleich](../src/features/spiele/OPEN.md). |

Die Tests für alle drei Lernwerkzeuge prüfen fehlgeschlagene und wiederholte Gastübernahmen sowie die Weitergabe von Speicherfehlern vor dem Abmelden. Die [Geräte-Testfälle](b-abnahme-testplan.md) ergänzen diese Prüfungen.

## Konto

- Gastmodus mit gerätelokalem Speicher. Browser-Gastdaten bleiben im Browser. Import lokaler App-Gastdaten ist für die Lernwerkzeuge separat zu testen.
- E-Mail-Anmeldung, Registrierung, Verifizierung, Passwort-Reset, Sitzungswiederherstellung sowie lokale, Geräte- und globale Abmeldung über Appwrite. Session-Cookie wird in der nativen Keychain verwaltet. Erststart, Kalt- und Warmstart-Links werden auf dem Gerät abgenommen.
- Google OAuth ist im Ausgangsbuild ausgeschaltet. Für interne Tests kann es ausdrücklich aktiviert werden.
- JSON-Export erfolgt über iOS-Dateifreigabe. Die Kontolöschung nutzt die bestehende `delete-account`-Function. Prüfen mit getrennten Testkonten und synthetischen Daten.
- Appwrite bestätigt die Apple-Plattform mit Bundle-ID `dev.buchholz.pensum`. Eine native Account-Anfrage ohne Sitzung liefert HTTP 401. Der Wechsel von Website zu App mit einem angemeldeten Testkonto bleibt als eigener Geräte- und Backendtest offen.
