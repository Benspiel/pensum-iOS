# Drittanbieter-Komponenten und Herkunft

Alle Dateien liegen im Repository und werden mit der App ausgeliefert (kein CDN, kein Nachladen).

## Goodnotes-Tool (`src/features/goodnotes/engine/`)

| Datei | Herkunft | Lizenz |
| --- | --- | --- |
| `ink-engine.js` | Inkly (https://github.com/Benspiel/Inkly, `app.js`), Autor: Auftraggeber; aus Pensum-Web `tools/goodnotes/ink-engine.js` @ 770dbe4, Export-Logik unverändert, Kapselung als Modul | MIT (Inkly) |
| `templates.js` | Pensum-Web `tools/goodnotes/templates.js` @ 770dbe4 (Papier-Vorlagen als Base64, aus Goodnotes-Export-Hüllen erzeugt) | eigene Arbeit des Auftraggebers; vor Veröffentlichung Rechte an den Hüllen prüfen |
| `jszip.min.js` | JSZip 3.10.1, https://github.com/Stuk/jszip | MIT oder GPL-3.0 (Wahl: MIT) |
| `jspdf.umd.min.js` | jsPDF 4.2.1, https://github.com/parallax/jsPDF; Browser-UMD-Build `dist/jspdf.umd.min.js` aus dem npm-Paket `jspdf@4.2.1` (Stand 17.03.2026; behebt alle bis dahin veröffentlichten GitHub-Sicherheitshinweise, u. a. CVE-2026-31938, CVE-2026-31898). SHA-256 `e6551fcdc32f09d6853b2c5126d18d01d9447e0da618a41a11ebeee0f6c20d54`. Vorher: 2.5.1 (2022). Von der Engine genutzt: `new jsPDF({unit,format,orientation,compress})`, `addPage`, `addImage`, `output("arraybuffer")` – unverändert kompatibel | MIT |
| `fonts/caveat-*.woff2` | Caveat, The Caveat Project Authors | SIL OFL 1.1 (`fonts/caveat-LICENSE.txt`) |
| `fonts/kalam-*.woff2` | Kalam, Indian Type Foundry | SIL OFL 1.1 (`fonts/kalam-LICENSE.txt`) |
| `fonts/patrick-hand-*.woff2` | Patrick Hand, Patrick Wagesreiter | SIL OFL 1.1 (`fonts/patrick-hand-LICENSE.txt`) |
| `fonts/indie-flower-*.woff2` | Indie Flower, Kimberly Geswein | SIL OFL 1.1 (`fonts/indie-flower-LICENSE.txt`) |
| `fonts/shadows-into-light-*.woff2` | Shadows Into Light, Kimberly Geswein | SIL OFL 1.1 (`fonts/shadows-into-light-LICENSE.txt`) |
| `fonts/gochi-hand-*.woff2` | Gochi Hand, Huerta Tipográfica | SIL OFL 1.1 (`fonts/gochi-hand-LICENSE.txt`) |
| `host-bridge.js` | neu, Pensum iOS | wie das App-Projekt |

`src/features/goodnotes/host-html.generated.ts` wird aus diesen Dateien mit `node scripts/build-goodnotes-host.mjs` erzeugt.

## Spiele

Bewusst nicht Teil der iOS-App (Entscheidung des Auftraggebers). Es werden keine Spiele-Assets oder -Lizenzen übernommen.

## App-Schrift Inter (`assets/fonts/`)

| Datei | Herkunft | Lizenz |
| --- | --- | --- |
| `Inter_300Light.ttf`, `Inter_400Regular.ttf`, `Inter_500Medium.ttf`, `Inter_600SemiBold.ttf`, `Inter_700Bold.ttf` | Inter, The Inter Project Authors (https://github.com/rsms/inter); statische TTF-Schnitte aus dem npm-Paket `@expo-google-fonts/inter@0.4.2` (Paket: MIT, Schrift: SIL OFL 1.1), unverändert übernommen | SIL OFL 1.1 (`assets/fonts/Inter-OFL.txt`, Text identisch mit `vendor/fonts/inter-LICENSE.txt` der Website) |

Die Website nutzt Inter als Variable-Font (Gewichte 300 / 450 / 650). Variable-Fonts lassen sich in React Native auf iOS nicht gewichten; die App lädt daher statische Schnitte (`src/theme/fonts.ts`): Untertitel 300 → Light, Text 450 → Regular 400, Knöpfe/Labels 600 → SemiBold, Überschriften 650 → SemiBold 600. Die Schriftdateien werden nicht verändert und nicht einzeln verkauft.
