# Quellen und Lizenzen

Die Referenz ist das Pensum-Web-Repository bei Commit `770dbe4e26236e4371126f5fcd2b9ea864b767d3`.

| Bestandteil in iOS | Web-Quelle | Herkunft und Anpassung |
| --- | --- | --- |
| `assets/app-icon.png` | `assets/icon-512.png` | Pensum-Markenasset aus dem bereitgestellten Webprojekt, für iOS auf 1024 × 1024 RGB hochskaliert. Im Quellprojekt ist dafür keine separate öffentliche Lizenz angegeben. |
| `src/navigation/tools.ts` | `js/tools.js`, `js/home.js`, `js/lock.js` | Pensum Tool-Inventar und Regeln. Native Symbole werden über Expo Symbols geladen. |
| `src/theme/`, `src/ui/`, `app/index.tsx` | `css/pensum.css`, `index.html` | Pensum-Farben und Darstellung; mit eigenen React-Native-Bausteinen umgesetzt. |
| `src/backend/`, `src/account/`, `src/storage/` | `js/config.js`, `js/auth.js`, `js/db.js`, `js/access.js`, `konto/`, `appwrite.config.json` | Ports für Pensum-Kontofunktionen, Access und bestehende Tabellen; native Ablage mit Expo SecureStore und AsyncStorage. |
| `src/features/mindmap/tree.ts` | `tools/mindmap/tree.js`, `functions/mindmap/lib.js` | Typisierter Pensum-Baum, Knotenlimits und Operationen; native verschachtelte Darstellung. |
| `src/features/appwrite-tools/images.ts`, `src/features/abschreiben/` | `tools/abschreiben/core.js`, `tools/abschreiben/abschreiben.js` | Größen- und Kompressionsregeln sowie Tafelbild-Ablauf; iOS-Kamera und Dateifunktionen. |
| `src/features/{mindmap,abschreiben,aufgaben,kichat,videos,admin}/` | `tools/<werkzeug>/`, `functions/<dienst>/` | Pensum-Function-Verträge und Funktionsgrenzen; native Oberflächen und für Aufgaben lokales PDF-Raster per Core Graphics. |
| `src/features/{notenrechner,planer,karteikarten}/` | `tools/<werkzeug>/core.js`, `tools/<werkzeug>/store.js`, `tests/` | Typisierte Ports von Fachlogik und Tests. Versionsbezug steht auch in den Dateien. |

Die übernommenen Pensum-eigenen Teile werden im Auftrag für Pensum verwendet. Abhängigkeiten und exakte Versionen stehen im npm-Lockfile; Expo Router, React Native und die übrigen Pakete bringen ihre jeweiligen Lizenzdateien mit. Die eingebetteten Goodnotes-Assets stehen in [Drittanbieter-Komponenten](THIRD-PARTY.md).
