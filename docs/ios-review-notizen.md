# Notizen für App Review und Datenschutz

## Zugang für App Review

Die Übersicht öffnet sich direkt im Gastmodus. Für einen Test der App:

1. Im Notenrechner über **Fach hinzufügen** ein Fach mit einer Beispielnote anlegen.
2. In **Karteikarten** einen Stapel mit einer Frage und Antwort anlegen. Im **Planer** eine Klausur mit diesem Stapel verknüpfen. Über **Karteikarten lernen** den verknüpften Stapel öffnen.
3. Pensum schließen und neu öffnen. Noten, Klausur und Stapel bleiben auf diesem Gerät verfügbar.
4. In **Konto** mit dem separat bereitgestellten Testkonto anmelden. Dort befinden sich der Export und **Konto löschen**. Den Löschweg mit einem dafür eingerichteten Testkonto prüfen, damit der Review-Zugang erhalten bleibt.
5. KI-Werkzeuge sind in diesem Production-Build deaktiviert und erscheinen nicht in der Werkzeugübersicht.

Für die Einreichung kommen die Zugangsdaten und der Supportkontakt in App Store Connect. Screenshots aus dem signierten Build zeigen die Werkzeugübersicht, Noten/Punkte, Klausur mit Stapel-Link und den Lernmodus. Namen, E-Mail-Adressen und Schulunterlagen in Screenshots stammen aus Testdaten. [App Review Guidelines §2.1 und §2.3](https://developer.apple.com/app-store/review/guidelines/)

## Textbausteine für die iOS-Datenschutzerklärung

**Gastmodus.** Du kannst die Gastwerkzeuge ohne Konto nutzen. Pensum speichert deine Gast-Lerndaten auf deinem Gerät. Beim Anmelden bleiben sie getrennt. Wo ein Werkzeug die Übernahme anbietet, entscheidest du, ob lokale Einträge in dein Konto übernommen werden.

**Konto.** Für dein Pensum-Konto verwenden wir deine E-Mail-Adresse, einen optionalen Namen, Sitzungsinformationen und die Inhalte, die du in deinem Konto speicherst. Ein Konto ist ab 16 Jahren vorgesehen. Daten werden über den Pensum-Server unter `appwrite.buchholz.dev` gespeichert. Die App legt den Sitzungsschlüssel im iOS-Schlüsselbund ab. In **Konto** kannst du ein Datenpaket teilen, andere Sitzungen beenden und dein Konto samt zugehörigen Inhalten löschen.

**Kamera und Dateien.** Das Handschrift-Tool verarbeitet Text, Vorlagen und Exportdateien auf deinem Gerät. Eigene gezeichnete Schriftzeichen speichert Pensum im Gastmodus auf dem Gerät und im Kontomodus im Pensum-Konto. Vorschau und Textübergaben bleiben auf deinem Gerät, bis du sie teilst.

**Mitteilungen.** Wenn du eine Lernerinnerung einschaltest, speichert Pensum den Apple-Push-Token dieses Geräts, die Geräteplattform und die gewählten Themen und Uhrzeiten im Konto. Die Daten dienen ausschließlich den eingeschalteten Erinnerungen. Beim Ausschalten oder Abmelden entfernt die App die Registrierung dieses Geräts.

**KI-Werkzeuge.** Der Production-Build deaktiviert die vorhandenen KI-Module, weil der derzeit eingesetzte Gemini-API-Vertrag die Zielgruppe dieser App nicht abdeckt. Der Build sendet keine Lerninhalte an Gemini.

**Dienste mit eigener Datenschutzerklärung.** Der Standardbuild verwendet die Anmeldung per E-Mail. Bei einem ausdrücklich mit Google-Login gebauten Teststand wird Google erst nach deiner Auswahl für die Anmeldung geöffnet. Erklärvideos sind im aktuellen Stand gesperrt.

Vor Veröffentlichung ergänzt der Betreiber die bestätigten Kontaktangaben, Hosting- und Maildienste, tatsächliche Aufbewahrung und Sicherungsfristen sowie die erforderlichen Angaben zu Übermittlungen und Minderjährigen. App Store Connect und die öffentlich verlinkte Erklärung müssen denselben freigegebenen Funktionsumfang beschreiben. [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/), [App Review Guidelines §5.1](https://developer.apple.com/app-store/review/guidelines/#privacy)
