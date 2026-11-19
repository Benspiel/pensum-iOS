# Pensum für iOS

Pensum ist eine Lern-App mit Expo Router, React Native und TypeScript. Im Gastmodus liegen Lerndaten auf dem Gerät. Das bestehende Pensum-Konto verwendet Appwrite in `https://appwrite.buchholz.dev/v1`. Dieser Git-Checkout enthält die Quellen und Abhängigkeiten für den App-Build.

## Lokal starten und prüfen

Node.js 22.13+, 24.3+ oder 26 und npm verwenden. Im Stamm dieses Checkouts ausführen:

```sh
npm ci
npm run typecheck
npm test
npm run doctor
npm run export:ios
npm start
```

`npm start` startet Metro für den Pensum-Development-Build. Für einen iOS-Simulator auf dem Mac installiert `npm run ios` die App aus den Quellen. Ein iPhone unter Windows benötigt zuerst einen signierten Development- oder internen Build. Das native Dokumentmodul und die Appwrite-Rücksprünge sind im eigenen Build enthalten. [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)

Die Web-Referenz ist das separate Projekt Pensum auf `main` bei `770dbe4e26236e4371126f5fcd2b9ea864b767d3`. Web-Regressionstests und der Vercel-Workflow laufen dort. Der iOS-Basiscommit für die Zusammenarbeit ist `b28845cc963ea71835d89ac2df673db6dab93e89`.

## Geräte- und Release-Abnahme

Die Bundle-ID `dev.buchholz.pensum` ist im bestehenden Appwrite-Projekt als Apple-Plattform registriert. Die EAS-Profile und der Ablauf für Geräte, TestFlight und die App-Store-Einreichung stehen in [iOS-Build und Release](docs/ios-release.md). Unter [Web-Vergleich](docs/ios-web-vergleich.md) stehen die benutzbaren Flüsse und ihre Abnahmekriterien. [Quellen und Lizenzen](docs/ios-quellen.md) nennt die übernommenen Bestandteile.
