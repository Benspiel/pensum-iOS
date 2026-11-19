# Notizen für App Review und Datenschutz

## Zugang für App Review

Die Übersicht öffnet sich direkt im Gastmodus. Für einen Test der App:

1. Im Notenrechner unter **Fächer** ein Fach mit einer Beispielnote anlegen.
2. In **Karteikarten** einen Stapel mit einer Frage und Antwort anlegen. Im **Planer** eine Klausur mit diesem Stapel verknüpfen. Über **Karteikarten lernen** den verknüpften Stapel öffnen.
3. Pensum schließen und neu öffnen. Noten, Klausur und Stapel bleiben auf diesem Gerät verfügbar.
4. In **Konto** mit dem separat bereitgestellten Testkonto anmelden. Dort befinden sich der Export und **Konto löschen**. Den Löschweg mit einem dafür eingerichteten Testkonto prüfen, damit der Review-Zugang erhalten bleibt.
5. Die kontobasierten KI-Werkzeuge fragen vor der Weitergabe ausgewählter Inhalte an Google Gemini nach Zustimmung. Für Foto- und PDF-Tests ein synthetisches Arbeitsblatt verwenden. Bei Testgruppen mit Tester- oder Ki-Tester-Rolle die zugehörigen Werkzeuge in den Review-Hinweisen benennen.

Für die Einreichung kommen die Zugangsdaten und der Supportkontakt in App Store Connect. Screenshots aus dem signierten Build zeigen die Werkzeugübersicht, Noten/Punkte, Klausur mit Stapel-Link und den Lernmodus. Namen, E-Mail-Adressen und Schulunterlagen in Screenshots stammen aus Testdaten. [App Review Guidelines §2.1 und §2.3](https://developer.apple.com/app-store/review/guidelines/)

## Textbausteine für die iOS-Datenschutzerklärung

**Gastmodus.** Du kannst die Gastwerkzeuge ohne Konto nutzen. Pensum speichert deine Gast-Lerndaten auf deinem Gerät. Beim Anmelden bleiben sie getrennt. Wo ein Werkzeug die Übernahme anbietet, entscheidest du, ob lokale Einträge in dein Konto übernommen werden.

**Konto.** Für dein Pensum-Konto verwenden wir deine E-Mail-Adresse, einen optionalen Namen, Sitzungsinformationen und die Inhalte, die du in deinem Konto speicherst. Ein Konto ist ab 16 Jahren vorgesehen. Daten werden über den Pensum-Server unter `appwrite.buchholz.dev` gespeichert. Die App legt den Sitzungsschlüssel im iOS-Schlüsselbund ab. In **Konto** kannst du ein Datenpaket teilen, andere Sitzungen beenden und dein Konto samt zugehörigen Inhalten löschen.

**Kamera und Dateien.** Die App verwendet Kamera oder Dateiauswahl, wenn du sie in einem Werkzeug aufrufst. Das Goodnotes-Tool verarbeitet Text, Vorlagen und Exportdateien auf deinem Gerät. Bei **Abschreiben** und **Aufgaben** kann ein Foto oder eine ausgewählte PDF-Seite zur Verarbeitung an Pensum und Google Gemini gesendet werden. Vor dem Senden zeigt Pensum einen Zustimmungsdialog. Die Werkzeuge führen einen Tageszähler im Konto. Vorschau und Textübergaben bleiben ansonsten auf deinem Gerät, bis du sie teilst.

**KI-Werkzeuge.** Für eine Mindmap übermittelt Pensum das Thema, die Notizen oder die Änderungsanweisung mit der Mindmap an Google Gemini. Der KI-Chat kann deine Frage, den relevanten bisherigen Verlauf, die gewählte Klassenstufe und ein ausgewähltes Bild oder PDF übermitteln. Chatnachrichten und Mindmaps werden in deinem Konto gespeichert. Entferne Namen und andere persönliche Angaben, bevor du Inhalte an Gemini sendest.

**Dienste mit eigener Datenschutzerklärung.** Der Standardbuild verwendet die Anmeldung per E-Mail. Bei einem ausdrücklich mit Google-Login gebauten Teststand wird Google erst nach deiner Auswahl für die Anmeldung geöffnet. Erklärvideos sind im aktuellen Stand gesperrt.

Vor Veröffentlichung ergänzt der Betreiber die bestätigten Kontaktangaben, Hosting- und Maildienste, tatsächliche Aufbewahrung und Sicherungsfristen sowie die erforderlichen Angaben zu Übermittlungen und Minderjährigen. App Store Connect und die öffentlich verlinkte Erklärung müssen denselben freigegebenen Funktionsumfang beschreiben. [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/), [App Review Guidelines §5.1](https://developer.apple.com/app-store/review/guidelines/#privacy)
