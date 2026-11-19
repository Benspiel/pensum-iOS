# iOS-Build und Release

## Expo-Projekt und iPhone einrichten

1. Auf dem Rechner mit `npx eas-cli@27.10.0 login` im Konto mit Zugriff auf das vorhandene Expo-Projekt anmelden.
2. `npx eas-cli@27.10.0 project:info` bestätigt das bereits in `app.config.ts` verknüpfte Projekt `@bookwoods-team/pensum`. Für abweichende Expo-Umgebungen bietet [.env.example](../.env.example) optionale Overrides. [Pensum im Expo-Dashboard](https://expo.dev/accounts/bookwoods-team/projects/pensum)
3. Für den ersten internen iPhone-Build `npx eas-cli@27.10.0 device:create` ausführen, beim Apple Developer Program anmelden, das Apple-Team auswählen und den Registrierungslink in Safari auf dem iPhone öffnen. Der Preview-Build verwendet die für Appwrite registrierte Bundle-ID `dev.buchholz.pensum`. Bei Bedarf fragt EAS beim ersten Build nach der Einrichtung der Signierung. [Expo-Geräteregistrierung](https://docs.expo.dev/build/internal-distribution/)
4. Google OAuth ist standardmäßig deaktiviert. `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true` schaltet es für die vorgesehenen internen Tests ein.

Die IDs der Projekte und der Bundle-ID dürfen in der öffentlichen App-Konfiguration stehen. Apple-Zertifikate, Appwrite- und KI-Schlüssel bleiben außerhalb dieses Checkouts. [Expo-Umgebungsvariablen](https://docs.expo.dev/eas/environment-variables/)

## Profile

| Profil | Verwendung | Befehl |
| --- | --- | --- |
| `development` | Development Client auf einem registrierten iPhone, danach `npm start` | `npx eas-cli@27.10.0 build --platform ios --profile development` |
| `preview` | Interner Gerätebuild mit eigenem Bundle | `npx eas-cli@27.10.0 build --platform ios --profile preview` |
| `simulator` | Simulator-Build für macOS | `npx eas-cli@27.10.0 build --platform ios --profile simulator` |
| `production` | Signierter App-Store-Build, dann TestFlight | `npx eas-cli@27.10.0 build --platform ios --profile production` |

Für TestFlight den autorisierten Production-Build mit `npx eas-cli@27.10.0 submit --platform ios --profile production` einreichen, im App Store Connect verarbeiten lassen und zunächst einer internen Testgruppe zuweisen. Die Einreichung für App Review und öffentliche Freigabe erfolgen nach jeweils erteilter Freigabe. [EAS-Profile](https://docs.expo.dev/build/eas-json/), [EAS Submit für iOS](https://docs.expo.dev/submit/ios/)

## App Review

- Eigenständige Lernfunktionen im Gastmodus, inklusive lokal gespeicherter Einträge, im Build und in den Screenshots belegen. Mit dem tatsächlichen Release-Build auf iPhone und, bei angebotener iPad-Unterstützung, iPad testen. Die Mindest-SDK-Anforderung für Uploads gilt unabhängig vom ältesten unterstützten iOS. Seit dem 28. April 2026 erfordert Apple Xcode 26 mit dem iOS-26-SDK oder neuer. Ab April 2027 ist das iOS-27-SDK vorgesehen. [App Review Guidelines §2.1 und §4.2](https://developer.apple.com/app-store/review/guidelines/), [Apple SDK requirements](https://developer.apple.com/news/upcoming-requirements/?id=04282026a), [Apple App Store submissions](https://developer.apple.com/app-store/submitting/)
- In der App führt **Konto → Konto löschen** zur serverseitigen Löschfunktion. Kontoverwaltung, Löschdialog, Löschbestätigung und erneute Gastnutzung mit einem autorisierten synthetischen Konto prüfen. Review-Zugang mit den vorgesehenen Rollen und Testanweisungen separat in App Store Connect hinterlegen. [App Review Guidelines §2.1 und §5.1.1](https://developer.apple.com/app-store/review/guidelines/), [Apple-Kontolöschvorgaben](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- Bei aktiviertem Google-Login einen gleichwertigen Login prüfen, der §4.8 erfüllt. Beim aktuellen Standardwert bietet der Build E-Mail-Anmeldung. Native Mail- und OAuth-Rücksprünge sowohl bei laufender App als auch nach Kaltstart prüfen. [App Review Guidelines §4.8](https://developer.apple.com/app-store/review/guidelines/#login-services)
- Öffentlich erreichbare Datenschutz- und Support-URLs mit vollständigen Betreiberangaben, Aufbewahrung, Kontolöschung und Kontakt vorbereiten. In App Store Connect die tatsächlichen Datenflüsse deklarieren. Prüfen, welche Angaben im Konto, in Nutzungsdaten und in absichtlich gesendeten Schulunterlagen verarbeitet werden. Der Upload-Dialog fordert vor der Weitergabe an Gemini eine ausdrückliche Zustimmung an. Abnahme mit synthetischen Schulunterlagen durchführen. Altersfragebogen gemäß Funktionsumfang beantworten, die Konto-Altersregel der Pensum-Website und einschlägige Vorgaben für Minderjährige prüfen. [App Review Guidelines §5.1](https://developer.apple.com/app-store/review/guidelines/#privacy), [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/), [Apple Altersfreigaben](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating)
- App-Icon, Handschrift-Module und Schriften anhand der Herkunft prüfen. Screenshots auf dem signierten Build erstellen und Funktionsangaben, Zugangsbeschränkungen und externe Dienste in der Review-Notiz aufführen. [App Review Guidelines §2.3 und §5.2](https://developer.apple.com/app-store/review/guidelines/)

## Geräteprotokoll

Für jede Runde Commit, Build-ID, Profil, iOS-Version, Gerät, Installation und tatsächlichen Test getrennt festhalten. Auf einem iPhone Starterlebnis, dynamische Schrift, VoiceOver, Tastatur, Kamera-Berechtigung, Dateiauswahl, Teilen, App-Neustart, Offline-Fälle und Mail-Links prüfen. Für Web↔iOS dieselben synthetischen Fächer, Planertermine und Kartenstapel aus zwei getrennten Konten prüfen. Gastimport zweimal wiederholen und einen Teilfehler simulieren. Ausstehend sind ein installierter Build, ein iPhone- oder Simulatorlauf, Testkonten, Screenshots und die finale Review-Konfiguration.

Der Entwurf für Review-Hinweise und die iOS-Datenschutzerklärung steht unter [Notizen für App Review](ios-review-notizen.md).
