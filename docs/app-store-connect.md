# App Store Connect: alle Angaben zum Ausfüllen

Entwurf zum Kopieren. **Nichts davon ist eingereicht.** Alle Texte sind Vorschläge, die du prüfst und anpasst. Die Längen sind gegen Apples Grenzen geprüft (Name 30, Untertitel 30, Werbetext 170, Schlüsselwörter 100, Beschreibung 4000). Welche Felder und Bildgrößen App Store Connect aktuell verlangt, zeigt dir die Seite selbst an. Hier steht mein Kenntnisstand.

Für den reinen TestFlight-Test brauchst du nichts davon (siehe `docs/b-testflight.md`). Das hier ist für den Tag, an dem du die App im App Store einreichen willst.

Was ich nicht weiß und du eintragen musst: dein Name und deine Kontaktdaten, die Zugangsdaten des Testkontos, und ob die Namen unten frei sind.

## 1. App-Informationen

| Feld | Eintrag |
| --- | --- |
| **Name** (max. 30) | `Pensum – Schul-Tools` · Ersatz, falls vergeben: `Pensum: Lernen & Planen`, `Pensum Lernhelfer`. „Pensum“ allein scheint vergeben zu sein (Eintrag heißt „Pensum (9f7e43)“). Der Name unter dem Icon bleibt „Pensum“. |
| **Untertitel** (max. 30) | `Noten, Karten, Planer, Mindmap` · Alternative: `Deine Schul-Tools an einem Ort` |
| **Bundle-ID** | `dev.buchholz.pensum` (nicht änderbar; muss zur Appwrite-Plattform passen) |
| **SKU** | frei wählbar, zum Beispiel `pensum-ios-1` |
| **Primäre Kategorie** | Bildung |
| **Sekundäre Kategorie** | Produktivität |
| **Inhaltsrechte** | „Nein, die App enthält keine Inhalte von Drittanbietern“ stimmt nur, wenn du die Lizenzen geklärt hast. Offen sind die Papier-Vorlagen des Handschrift-Tools (`src/features/goodnotes/engine/templates.js`). Bis dahin nicht verbindlich beantworten. |

## 2. Preis und Verfügbarkeit

- Preis: **kostenlos**. Keine Käufe in der App, keine Werbung.
- Länder: sinnvoll sind zuerst Deutschland, Österreich und Schweiz (alle Texte sind deutsch). Du kannst später erweitern.

## 3. Version 1.0: Texte (Deutsch)

**Werbetext** (max. 170, jederzeit änderbar):

```
Notenrechner, Karteikarten, Planer und Handschrift-Tool: die Schul-Tools von Pensum an einem Ort. Ohne Konto loslegen, ohne Werbung und ohne Tracking.
```

**Beschreibung** (max. 4000):

```
Pensum ist ein kostenloses Hilfsmittel für Schülerinnen und Schüler: mehrere Lernwerkzeuge in einer App. Du kannst sofort ohne Konto loslegen. Deine Eingaben bleiben dann auf deinem Gerät.

NOTENRECHNER
Trag pro Fach deine Zeugnisnote ein und sieh sofort deinen Durchschnitt, in Noten oder Punkten, für beide Halbjahre. Der Rechner ist eine Orientierung und ersetzt nicht die Notengebung deiner Schule.

KARTEIKARTEN
Bis zu 5 Stapel mit Vorder- und Rückseite. Lerne mit 5 Leveln oder der Reihe nach, zum Umdrehen oder als schriftlicher Test.

PLANER
Hausaufgaben mit Fälligkeit und Klausurtermine mit Countdown. Verknüpfe eine Klausur mit deinem Karteikarten-Stapel und lerne direkt dafür.

HANDSCHRIFT-TOOL
Getippten Text in Handschrift verwandeln, auch in deiner eigenen gezeichneten Schrift, und als PDF oder Datei zum Weiterverwenden exportieren. Läuft auf deinem Gerät.

DEIN DATENSCHUTZ
Keine Werbung, kein Tracking, keine Weitergabe deiner Daten zu Werbezwecken. Ein Konto ist ab 16 Jahren möglich, jüngere nutzen die Gast-Werkzeuge ohne Konto. Du kannst dein Konto und alle Daten jederzeit in der App löschen.

Pensum ist ein privates Angebot und keine Einrichtung deiner Schule.
```

**Schlüsselwörter** (max. 100, durch Komma, ohne Leerzeichen, ohne Markennamen):

```
Schule,Noten,Notenrechner,Karteikarten,Vokabeln,Planer,Hausaufgaben,Klausur,Handschrift,Lernen
```

**Was ist neu** (Version 1.0): `Erste Version von Pensum für iPhone und iPad.`

**Markennamen:** Das Werkzeug heißt in der App „Goodnotes-Tool“ und in den Dateien kommt „.goodnotes“ vor. „Goodnotes“ ist eine fremde Marke (das Impressum der Website stellt klar, dass das Tool inoffiziell ist). Apple prüft Namen, Untertitel, Schlüsselwörter und Screenshots auf fremde Marken. Deshalb steht „Goodnotes“ in den Texten oben nicht, und ich empfehle, es auch aus Schlüsselwörtern und Screenshots herauszuhalten. Ob das Werkzeug in der App dennoch so heißen darf, ist eine Entscheidung vor der Einreichung (umbenennen in „Handschrift-Tool“ oder Risiko einer Rückfrage von Apple eingehen). Für TestFlight ist das egal.

## 4. URLs

| Feld | URL |
| --- | --- |
| **Datenschutz-URL** (Pflicht) | `https://pensum-omega.vercel.app/datenschutz/` |
| **Support-URL** (Pflicht) | `https://pensum-omega.vercel.app/impressum/` (enthält die Kontaktangaben) |
| **Marketing-URL** (optional) | `https://pensum-omega.vercel.app/` |
| **Nutzungsbedingungen** (optional, eigene EULA nicht nötig) | `https://pensum-omega.vercel.app/nutzungsbedingungen/` |

Alle vier Adressen antworten mit HTTP 200 (am 19.11.2026 geprüft). Die Datenschutzerklärung der Website nennt noch die Spiele und das Web. Vor der Einreichung muss sie denselben Funktionsumfang beschreiben wie die App, und die Kontaktangaben in Impressum und Datenschutz müssen vollständig sein (dort sind Name, Adresse, E-Mail und Telefon auszufüllen).

## 5. Screenshots

- **iPhone 6,9 Zoll** (zum Beispiel iPhone 16/17 Pro Max): 1320 × 2868 (oder die von App Store Connect gezeigte Größe).
- **iPad 13 Zoll**: 2064 × 2752 (oder 2048 × 2732). Pflicht, weil die App iPad unterstützt (`supportsTablet: true`).
- Mach sie auf dem Gerät mit dem TestFlight-Build (Seitentaste + Lauter) und lade die Originale hoch. Auf Windows gibt es keinen Simulator.
- Vorschlag je 5 Bilder, mit **ausgedachten Daten** (Fach „Mathe“, Stapel „Vokabeln Unit 3“, keine echten Namen oder Schulunterlagen): Startseite, Notenrechner mit Durchschnitt, Planer mit Klausur und Countdown, Karteikarten beim Lernen, Handschrift-Vorschau. Auf dem iPad zeigt die Zwei-Spalten-Ansicht am besten, was die App kann.

## 6. Altersfreigabe

Beantworte den Fragebogen nach den tatsächlichen Funktionen. Meine Einschätzung (du prüfst sie gegen die aktuellen Fragen von Apple):
- Keine Gewalt, kein Sex, keine Glücksspiele, keine Waffen, keine Medizin-/Behandlungsinhalte, keine freie Weitergabe von Nutzerinhalten an andere (Mindmaps und Karten sind privat).
- **KI:** Im Production-Build ist `EXPO_PUBLIC_AI_ENABLED=false`; KI-Werkzeuge und KI-Karteikarten sind darin nicht zugänglich.
- Ein **Konto** ist laut Nutzungsbedingungen ab 16 Jahren. Die Gast-Werkzeuge nutzt jeder ohne Konto. Das beeinflusst die Altersfreigabe der App im Store nicht von selbst, gehört aber in die Review-Hinweise.

## 7. App-Datenschutz („Datenschutz-Angaben“)

Die Angaben müssen zu `docs/ios-review-notizen.md` und der Datenschutzerklärung passen. Aus dem Code und den Rechtstexten:

- **Tracking:** Nein. Keine Werbung, keine Analyse-SDKs, kein Verkauf.
- **Erhoben und mit dem Nutzer verknüpft** (nur bei Konto), Zweck „App-Funktionalität“:
  - Kontaktdaten: E-Mail-Adresse, Name (optional)
  - Identifikatoren: Nutzer-ID
  - Nutzerinhalte: Noten und Fächer, Karteikarten, Planer-Einträge und Handschrift-Profil
  - Nutzung: Aufrufe je Werkzeug, soweit serverseitig erfasst
  - Identifikatoren: Apple-Push-Token und Geräteplattform, wenn die Person Mitteilungen einschaltet
  - Diagnose: Sitzungsdaten wie Geräteart und grobe IP-Angaben (laut Datenschutzerklärung)
- **Nicht erhoben:** Standort, Kontakte, Gesundheit, Finanzdaten, Browserverlauf, Werbe-ID.
- Im Gastmodus bleiben die Daten auf dem Gerät und werden nicht übertragen.
- **Dritte:** Der Production-Build bietet keine Gemini-Funktion an. Die Datenschutzerklärung muss den iOS-Umfang getrennt vom weiter bestehenden Webangebot beschreiben.

## 8. App-Review-Informationen

- **Anmeldeinformationen:** Kontoanmeldung erforderlich: **Nein** für den Kern (Gastmodus). Lege trotzdem ein Testkonto an (E-Mail bestätigt, Passwort von dir) und trage Benutzername und Passwort hier ein, damit Apple Export, Mitteilungen und Kontolöschung prüfen kann. Lege für die Löschprüfung ein zweites Konto an.
- **Kontakt:** dein Vor- und Nachname, Telefonnummer, E-Mail. Das sind deine Daten, ich trage sie nirgends ein.
- **Hinweise (Textvorschlag):**

```
Pensum öffnet direkt im Gastmodus, ohne Anmeldung. Test ohne Konto:
1. Notenrechner: über "Fach hinzufügen" ein Fach mit einer Note anlegen.
2. Karteikarten: einen Stapel mit einer Frage und Antwort anlegen. Planer: eine Klausur mit diesem Stapel verknüpfen, dann "Karteikarten lernen" öffnen.
3. App schließen und neu öffnen: die Einträge bleiben auf dem Gerät.
Test mit Konto: Tab "Konto" > Anmelden mit dem angegebenen Testkonto. Dort gibt es Datenexport und "Konto löschen" (serverseitig). Bitte die Löschfunktion nur mit dem separaten Löschkonto prüfen.
KI-Werkzeuge sind in diesem Production-Build deaktiviert und erscheinen nicht in der Werkzeugübersicht.
Ein Konto ist ab 16 Jahren vorgesehen; jüngere Nutzer verwenden die Gastwerkzeuge ohne Konto. Anmeldung mit Google ist in dieser Version nicht aktiv.
```

## 9. Exportrichtlinien und Weiteres

- **Verschlüsselung:** Der Build setzt `ITSAppUsesNonExemptEncryption: false`. Die Frage ist damit beantwortet: nur Standard-Verschlüsselung (HTTPS).
- **Werbe-ID (IDFA):** Nein.
- **Inhalte von Nutzern/Meldefunktion:** Nicht nötig, da Inhalte privat bleiben und nicht geteilt werden.
- **Anmeldung mit Apple:** Nur nötig, wenn ein Drittanbieter-Login (Google) aktiv ist. Die App ist so gebaut, dass Google standardmäßig aus ist.
- **Version:** Die App und der Store-Eintrag verwenden Version `1.0`.
- **Copyright:** `2026 <dein Name oder deine Firma laut Impressum>`.

## 10. Vor „Zur Prüfung hinzufügen“

1. Echter Gerätetest über TestFlight bestanden (`docs/b-iphone-schnelltest.md`).
2. Datenschutzerklärung und Impressum vollständig und passend zur App.
3. Rechte an den Papier-Vorlagen belegen oder die benutzerdefinierten Vorlagen vor der Einreichung entfernen.
4. Production-Build der Store-Version `1.0` zuordnen.
5. Testkonto und Löschkonto bereit, Screenshots hochgeladen.
6. Deine ausdrückliche Freigabe zum Einreichen.
