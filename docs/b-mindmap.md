# Mindmap-Generator in der iOS-App

Stand: Web `1612dc2` (`tools/mindmap/`). Code: `src/features/mindmap/**`, Route `app/tools/[id].tsx` (unverändert). Auftrag: so schön und so funktionsgleich wie im Web.

## Aufbau

| Datei | Aufgabe |
| --- | --- |
| `tree.ts` | Baum und Bearbeiten (`sanitize`, `addChild`, `addSibling`, `rename`, `remove`, `move`, `ancestors`, `autoCollapse`, `branchIds`). Port von `tree.js`, Grenzen wie die Function (80 Knoten, Tiefe 5, 10 Kinder, 80 Zeichen). `appendNode`/`normalizeMindmap`/`findNode` bleiben als Namen der ersten App-Fassung (`tests/function-contract.test.ts`). |
| `layout.ts` | `layout`, `wrap`, `edgeLine`, `STYLE`, `HAND_STYLE`: derselbe Algorithmus wie im Web (Fächer, Entzerren, Linien freiräumen). Die Textmessung wird übergeben. Dazu `scaleStyle`/`clampFontScale` (Dynamic Type bis 1,3). |
| `measure.ts`, `inter-widths.generated.ts` | Textmessung ohne Canvas aus den Vorschubbreiten der gebündelten Inter-Schnitte (Regular, SemiBold). Tabelle erzeugt `build-inter-widths.mjs` aus `assets/fonts`. |
| `hand.ts` | Eigene Handschrift als Strichpfade: `unpackHand` und `chaikin` aus `ink-engine.js`, `pathData`, `covers`, `width`, `strokes` aus `hand.js`. Geladen wird über das vorhandene `goodnotes/hand-store.ts` (Tabelle `handwriting`). |
| `scene.ts` | Zeichenbeschreibung aus dem Layout: Kantenbreiten, Textposition, Handschrift-Grundlinie, Bewegung (`planTransition`, `frameAt`), Beschriftungen für VoiceOver, SVG- und PDF-Dokument, Goodnotes-Striche und Zeichenliste. |
| `state.ts` | Editor-Zustand: Auswahl, Ändern mit Rückgängig/Wiederholen (Zusammenfassen innerhalb 1,5 s, 60 Schritte), Ein-/Ausklappen, verzögertes Speichern (`createSaver`: 700 ms, Wiederholung nach 5 s), Zoom, Anzeigetexte. |
| `canvas.tsx` | Zeichenfläche mit `react-native-svg`, Punktraster, Bewegung, Pinch/Verschieben über die iOS-ScrollView, je Knoten ein zugängliches Tippfeld. |
| `editor-view.tsx`, `screen.tsx` | Oberfläche im Website-Look (nur Darstellung) und Anbindung an Backend, Konto und Export. |
| `goodnotes-bridge.ts`, `goodnotes-export.tsx` | `.goodnotes`-Export über die vorhandene Engine-WebView (siehe unten). |

Backend-Verträge sind unverändert: `executeFunction(functionIds.mindmap, { action: 'status' | 'create' | 'refine' })` (die Function heißt im Web und hier `refine`, nicht `edit`), Tabelle `mindmaps` (`topic`, `day`, `data`), Tageslimits und KI-Einwilligung (`consentToGemini`).

Neue Abhängigkeit: `react-native-svg` 15.16.0 (von `npx expo install` für SDK 58 gewählt, läuft in Expo Go).

## Abweichung von der Aufgabenbeschreibung

Die Web-Version im Commit `1612dc2` zeichnet **keine** geschwungenen Äste: `edgePath` ist eine gerade Linie (`M…L…`), das Layout ist der radiale Fächer. Die App folgt dem Code, nicht der Beschreibung. Auch die Ein-/Ausklappkreise hat das Web entfernt (Commit `c605725`); eingeklappte Äste erkennt man dort nur am Vorlesetext.

## Parität Web ↔ App

| Funktion | Stand | Abweichung |
| --- | --- | --- |
| Radiales Layout, gerade Linien, Kantenbreiten 3,2/2,2/1,6 | gleich | Quelle Schritt für Schritt portiert, Tests aus `tests/mindmap.test.mjs` 1:1 |
| Thema als getönte Ellipse, Beschriftungen ohne Rahmen, Auswahlrahmen gestrichelt | gleich | |
| Punktraster, Papier (weiß) bei schwarzer Tinte, auch im dunklen Modus | gleich | Das Raster steht fest im Rahmen, es scrollt nicht mit (wie im Web) |
| Schriftschnitte nach Ebene | fast gleich | Web 650/600/450 (Inter Variable), App SemiBold/SemiBold/Regular (statische Inter-Schnitte) |
| Textmessung | geschätzt | siehe unten |
| Bewegung der Äste (380 ms, neue Äste wachsen aus dem Elternknoten) | gleich | läuft auf dem JS-Thread, weil SVG-Pfade nicht über den nativen Treiber animierbar sind; aus bei „Bewegung reduzieren“ |
| Zoom + / − / Einpassen | gleich | `fitZoom` wie im Web; Stufen ±0,15, 0,25 bis 2,5 |
| Verschieben, Pinch-Zoom | nativ | `ScrollView` (iOS) mit `minimumZoomScale`/`maximumZoomScale` |
| Auswahl per Tippen, Text bearbeiten, + Unterpunkt/Nebenpunkt, ↑ ↓, Löschen | gleich | zweiter Tipp auf den gewählten Punkt springt ins Textfeld (Web: Doppelklick) |
| Rückgängig/Wiederholen mit Zusammenfassen | gleich | |
| Ast einklappen, Alles ein-/ausklappen, automatisches Einklappen großer Karten | gleich | zusätzlich: langes Drücken auf einen Ast klappt ihn ein/aus |
| Markierung eingeklappter Äste | **zusätzlich** | kleiner Kreis „+n“ (verborgene Punkte) am Knoten; im Web gibt es keine sichtbare Markierung mehr |
| Speichern verzögert (700 ms), Wiederholung, Status „Speichert … / Gespeichert“ | gleich | zusätzlich Speichern beim Wechsel in den Hintergrund und vor dem Abmelden; ein Wechsel der Mindmap wartet auf laufendes Speichern (im Web konnte ein laufender Vorgang übersprungen werden) |
| Mindmap für heute erstellen, „Mit KI ändern“ mit Zähler, Tageslimits | gleich | Einwilligung zu Gemini wie in der ersten App-Fassung |
| Liste „Meine Mindmaps“ mit Tagesbezug, Löschen (nicht heute) | gleich | statt Auswahlmenü eine Chip-Reihe |
| Schrift-Umschalter, eigene Handschrift, Hinweis ohne Handschrift | gleich | Link „Im Goodnotes-Tool anlegen“ öffnet das Tool; Schrift und Farbe werden wie im Web in den Konto-Einstellungen gemerkt (`mmFont`, `mmInk`) |
| Vier Tintenfarben | gleich | |
| PDF | ähnlich | A4, quer bei breiter Karte, Rand 28 pt, zugeschnitten. Gedruckt wird ein SVG über `expo-print`; Text steht in der Systemschrift (Inter ist in der Druck-WebView nicht verfügbar), Handschrift als Pfade |
| `.goodnotes` | gleich (Weg anders) | Handschrift als Stiftstriche, sonst Seitenbild. Siehe unten |
| Text in Goodnotes-Tool übernehmen | gleich | |
| Tastaturbedienung (Pfeile, Entf, Enter) | entfällt | stattdessen VoiceOver-Aktionen (Auswählen/Bearbeiten, Einklappen/Ausklappen) an jedem Knoten |
| Anmeldung nötig („Melde dich an, um loszulegen.“) | bestehend | Gäste fängt `app/tools/[id].tsx` ab („Mit deinem Konto fortfahren“, Knopf zum Konto); Zugangsregeln (`ToolGate`) unverändert |

### Textmessung

Das Web misst mit `canvas.measureText` in Inter Variable. Die App addiert Vorschubbreiten (ohne Kerning). Verglichen an 20 deutschen Beispieltexten je Ebene (gemessen im Browser mit der Web-Schrift gegen `measureInter`): mittlere Abweichung unter 0,6 %, größte 2,6 %. Dadurch bricht der Text gelegentlich an anderer Stelle um als im Web, die Anordnung bleibt aber gleich. Zeichen außerhalb der Tabelle (Latin bis U+024F plus gängige Satzzeichen) werden mit 0,6 em, CJK und Emoji mit 1 em angesetzt. Ist Inter nicht geladen (Systemschrift), stimmt die Messung entsprechend weniger.

### `.goodnotes`-Export

Die Engine aus `src/features/goodnotes/engine` lässt sich wiederverwenden, ihre Brücke (`host-bridge.js`) kennt aber nur Text-Anfragen. Damit das Goodnotes-Tool unverändert bleibt, lädt der Export dieselbe `GOODNOTES_HOST_HTML` in eine unsichtbare WebView und spielt per `injectedJavaScript` eine zweite Nachrichtenart ein (`goodnotes-bridge.ts`). Sie zeichnet die Karte auf eine A4-Leinwand (1654 px breit) und ruft `buildSinglePage` der Engine auf, genau wie `buildGoodnotesFile` im Web. Die WebView lebt nur während des Exports. Geprüft wurde das Skript mit der echten Engine im Browser (beide Fälle ergeben eine gültige ZIP-Datei: Standardschrift als Bild, Handschrift mit 68 Stiftstrichen) und mit einem Test gegen eine nachgebaute Seite (`goodnotes-bridge.test.ts`).

## Tests

`npm test`: neue Dateien in `src/features/mindmap/__tests__/` (`tree-layout`, `state`, `hand-scene`, `goodnotes-bridge`). Die Baum- und Layout-Tests sind `tests/mindmap.test.mjs` aus dem Web mit unveränderten Erwartungswerten; die dortigen Function-Tests (Server, `functions/mindmap/lib.js`) gehören nicht in die App.

## Nur auf dem iPhone prüfbar (ungeprüft)

- Pinch-Zoom, Verschieben mit Schwung und das Einpassen über `scrollResponderZoomTo`. Bekannte Grenze: Die iOS-ScrollView skaliert die fertige Grafik; beim Vergrößern über etwa 1,5× kann die Karte kurz oder dauerhaft leicht unscharf wirken. Die +/−-Knöpfe nutzen denselben Weg.
- Tippfelder über der Grafik (Treffgenauigkeit in dichten Karten), langes Drücken, VoiceOver-Reihenfolge und -Aktionen, Dynamic Type über 1,3.
- Flüssigkeit der Bewegung (JS-getrieben) bei Karten mit vielen Knoten.
- Eigene Handschrift auf dem Gerät (Laden aus dem Konto, Strichbild), `SvgText` mit den statischen Inter-Schnitten.
- Der Export in einer echten WKWebView: Start der Engine (große Seite mit eingebetteten Schriften), Dauer, Teilen und „In Goodnotes öffnen“; PDF über `expo-print` und das Teilen.
- Darstellung geprüft wurde nur im Browser (react-native-web, 375 × 812, hell und dunkel, Blau/Schwarz, eingeklappt, Handschrift mit künstlichen Glyphen) gegen eine Web-Referenz mit denselben Dateien (`tree.js`, `mindmap.css`, `pensum.css`): Anordnung, Linien, Ellipse, Auswahlrahmen und Raster stimmen überein.
