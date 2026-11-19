# Nur TestFlight (ohne App-Store-Einreichung)

Ziel: Pensum als echter Build auf iPhone und iPad testen, **ohne** die App bei Apple zur Prüfung einzureichen. Dafür reicht der Build in TestFlight mit **internen Tests**. Dafür sind kein App-Store-Name, keine Screenshots, keine Beschreibung, keine Datenschutz-URL und keine Altersfreigabe nötig, und der Status „In Vorbereitung zur Übermittlung“ der App-Version darf so bleiben. Auch der Name „Pensum (9f7e43)“ stört nicht: Auf dem Homescreen heißt die App „Pensum“.

## Einmalig in App Store Connect

1. **Apps → Pensum (9f7e43) → TestFlight → Builds:** Der hochgeladene Build erscheint zuerst als „Wird verarbeitet“ (meist 10 bis 30 Minuten) und danach als bereit. Fragt Apple nach der Exportrichtlinie, ist die Antwort „keine Verschlüsselung außer der Standard-Verschlüsselung“ (der Build setzt `ITSAppUsesNonExemptEncryption: false`).
2. **Interne Tests → Gruppe anlegen** (zum Beispiel „Intern“), den Build zur Gruppe hinzufügen. Interne Tester brauchen keine Prüfung durch Apple.
3. **Tester hinzufügen:** Nur Personen, die unter *Benutzer und Zugriff* im selben App-Store-Connect-Team stehen (du bist als Kontoinhaber schon dabei). Weitere Personen vorher dort einladen.

## Auf dem iPhone und iPad

1. Die App **TestFlight** aus dem App Store installieren und mit derselben Apple-ID anmelden wie in App Store Connect.
2. Pensum erscheint dort unter „Apps“ (bei internen Testern ohne Einladungscode, sonst über die Einladungs-Mail). **Installieren** wählen.
3. Der Build läuft 90 Tage. Für neue Stände wird ein neuer Build hochgeladen (die Build-Nummer zählt EAS automatisch hoch). TestFlight meldet ihn dann als Update.

## Vor dem ersten Test prüfen

- **Bundle-ID:** In App Store Connect unter *App-Informationen* muss `dev.buchholz.pensum` stehen. Die App meldet sich bei Appwrite mit genau dieser Kennung an (`src/backend/index.ts`, `setPlatform`). Wurde der Build mit einer anderen Bundle-ID gebaut, scheitert die Anmeldung, bis Rolle A die Plattform im Appwrite-Projekt ergänzt. Das ist eine Änderung am produktiven Projekt und braucht deine Freigabe.
- **Welcher Stand ist im Build?** Im Expo-Dashboard (Projekt `pensum`, Reiter „Builds“) stehen Commit und Zeitpunkt. Die Mindmap, der Parallax-Hintergrund und die iPad-Ansicht sind erst im Integrationsstand `3d43ce3` und später enthalten. Ist der Build älter, brauchst du einen neuen Production-Build: `npx eas-cli@27.10.0 build --platform ios --profile production`, danach `npx eas-cli@27.10.0 submit --platform ios --profile production`.
- Es gibt kein Testkonto-Passwort in Dateien: Die Konten T1 bis T3 legst du selbst an.

## Was jetzt im Build testbar ist (in Expo Go nicht)

Mail-Links und Direktlinks (`pensum://…`), der Rücksprung nach der Anmeldung, das PDF-Rastern im Werkzeug „Aufgaben“, die echten Berechtigungstexte für Kamera und Fotos, die richtigen App-Namen und das Symbol sowie Neustarts ohne WLAN. Die Reihenfolge der Tests steht in `docs/b-iphone-schnelltest.md`, die Einzelfälle in `docs/b-abnahme-testplan.md` (Spalte „Wo“: „Build“).

## Fehler melden

Eine Zeile reicht: **Werkzeug · Testfall · erwartet · tatsächlich · Gerät und iOS-Version · TestFlight-Build-Nummer · Gast oder Konto.** In TestFlight geht auch „Feedback senden“ mit Bildschirmfoto (Screenshot machen, dann „Teilen“ → TestFlight).
