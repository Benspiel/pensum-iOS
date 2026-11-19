# Spiele – was offen bleibt

Stand Web `770dbe4` (`tools/spiele/`). Im Web ist `spiele` `soon`/Tester; die Katalogfreigabe in der App setzt A (`src/navigation/tools.ts`, derzeit `implementation: 'unavailable'`).

## Umgesetzt (nativ)

- **Vier gewinnt gegen den Computer** (`connect4.ts`, `model.ts`, `screen.tsx`, `components/`): Regeln und KI 1:1 aus `connect4.js`, Stufen Leicht/Mittel/Schwer (Suchtiefe 2/4/6), Mensch (gelb) beginnt immer, Zähler „Siege hier“ je Stufe unter `pensum.spiele.best.v1` → `c4wins_<stufe>` (nur Gerät, wie im Web).

## Im Web vorhanden, in der App offen

Kacheln und Kategorien stehen in `catalog.js` und `spiele.js`:

| Spiel | Web-Quelle | Art |
|---|---|---|
| Neon Drift, Sky Stack | `ui-arcade.js` | eigene Canvas-Spiele (Pensum) |
| Asteroids | `ui-embed.js`, `vendor/games/` | eingebettet, MIT (Doug McInnes) |
| Dino-Runner | `ui-embed.js`, `vendor/games/` | eingebettet, BSD (Chromium, Fassung wayou/t-rex-runner) |
| Schach (gegen den Computer) | `chess/` (Worker-Engine) | iframe, Lizenz `chess/LICENSE` (MIT) |
| Neon Golf, Tanks, Bubbles, Match, Hop, Lander, Pinball, Crates | `arcade/games/<id>/` (GH Arcade, Phaser) | iframe, Lizenz `arcade/LICENSE` (MIT), `arcade/` rund 2,3 MB |
| Suche und Kategorie-Filter (Alle, Geschick, Action, Sport, Schach) | `spiele.js` | Übersicht |

Weitere Ordner in `arcade/games/` (astro, breakout, maze, mines, pong, runner, siege, snake, stack) sind im Katalog nicht verlinkt.

## Mögliche Wege

1. **Gebündelte WebView wie beim Goodnotes-Tool** (`src/features/goodnotes/screen.tsx`: lokales HTML, `originWhitelist` nur `about:`/`data:`, kein Netz). Je Spiel eine Seite offline einbetten; Phaser (1,3 MB) und die Spiele als Assets bzw. generierte HTML-Strings. Offen: Start der Worker-Engine von Schach in einer WebView ohne `http`-Ursprung (Blob-Worker oder Inline-Worker prüfen), Speicherbedarf auf kleinen Geräten, Pause beim Wechsel in den Hintergrund.
2. **Nativ nachbauen**: sinnvoll nur für kleine, regelbasierte Spiele (Schach bräuchte eine Engine in JS/Hermes, deutlich aufwendiger als die WebView).
3. **Weglassen**: nur Vier gewinnt anbieten, bis der Bedarf klar ist.

## Lizenzen vor einer Übernahme

- GH Arcade (MIT), Schach (`tools/spiele/chess/LICENSE`, MIT), Asteroids (MIT), Dino-Runner (BSD): Lizenztext und Urheber in `docs/THIRD-PARTY.md` eintragen, sobald etwas eingebunden wird (heute dort unter „Noch offen“).
- Die Hinweise aus `GAMES.credit` in `spiele.js` (Zeile mit den Quellen) in der App sichtbar machen.

## Kleinigkeiten in Vier gewinnt

- Die KI rechnet auf dem JS-Thread (wie im Web im Hauptthread). Stufe „Schwer“ (Tiefe 6) kann einen Zug lang kurz hängen; falls es auf älteren Geräten spürbar ist, Suche in Häppchen oder reduzierte Tiefe prüfen.
- Statistik nur lokal, nicht im Konto (wie im Web). Eine Konto-Synchronisierung gibt es dort nicht.
