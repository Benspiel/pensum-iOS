# B Phase 2 – Screens für Notenrechner, Planer, Karteikarten

Gemeinsamer Auftrag für die Sub-Agents von Rolle B. Worktree: `C:\Users\Ben\Documents\Pensum-React-wt-b` (Branch `codex/pensum-ios-b`). Web-Quelle nur lesen: `C:\Users\Ben\Documents\Pensum` (`770dbe4`).

## Regeln
- Schreibe nur in deine reservierten Pfade (siehe Auftrag). **Nicht committen**, kein `git add`, kein Push, keine Änderung an `package.json`, `package-lock.json`, `tsconfig.json`, `app/_layout.tsx`, `app/index.tsx`, `src/ui`, `src/theme`, `src/account`, `src/backend`, `src/navigation`, `src/storage`, `src/features/shared` (Eigentum von A bzw. B-Haupt). Letzte sechs Ordner sind im Worktree nur eine **lokale Arbeitskopie von A's noch nicht committetem Gerüst** (zum Typprüfen) – nie ändern.
- Keine neuen npm-Abhängigkeiten. Nicht vorhanden: `expo-haptics`, `@react-native-community/datetimepicker`. Daher: Datum als Textfeld (`TT.MM.JJJJ` oder `JJJJ-MM-TT`, per reiner, getesteter Funktion normalisieren), Haptik weglassen (kleine Stelle `haptic()` in einer Datei vorsehen, die später `expo-haptics` aufrufen kann; vorerst No-op).
- Alle Texte Deutsch, Wortlaut aus dem Web übernehmen (Spezifikation siehe Bericht deines Phase-1-Agents, im Zweifel Web-Quelle lesen).

## Verfügbare Bausteine (A)
- `src/ui`: `Screen({children,title?,description?,navigationTitle?,scroll?,includeTopInset?,contentStyle?})`, `AppText({variant: display|title|section|body|caption|label, tone: default|muted|accent|danger})`, `Button({title,onPress,variant: primary|secondary|plain|danger, loading, disabled})`, `Field({label,error,...TextInputProps})`, `Card`, `LoadingState`, `ErrorState({title?,message,onRetry?,retryLabel?})`, `EmptyState({title,message?,action?})`.
- `src/theme`: `usePensumTheme()` → `{ colors, scheme }` (Farben: ink, canvas, surface, field, border, muted, accent, danger, dangerSurface, onPrimary), `spacing`, `radius`.
- `src/storage`: `useStoreDeps(onStatus?)` → `StoreDeps | null` (null solange Session lädt) mit `kv`, `rows`, `tableIds`, `onStatus`; `guestStorage`.
- `src/account/session`: `useSession()` → `state` (`status: loading|guest|account|error`, bei `account` `state.user` mit `id`, `name`, `email`, `prefs`), `access`, `scope`, `updatePrefs(patch)` (Kontoeinstellungen, z. B. Notenrechner-Ansicht `nrSystem`, `nrYear`, `nrHalf`).
- Navigation: `expo-router` (`useRouter`, `useLocalSearchParams`, `Link`). Meine drei Routen sind dünne Dateien `app/tools/<id>.tsx`, die nur `export { default } from "../../src/features/<id>/screen"` oder einen Wrapper enthalten. Kein `ToolGate` für diese öffentlichen Tools.
- Native Dialoge: `Alert.alert` für Bestätigungen, `Modal` für Formulare. Kein Toast-System vorhanden: lege in deinem Feature eine kleine eigene Hinweiszeile/Toast-Komponente an (`components/Toast.tsx`), falls nötig. Doppelungen zwischen Features sind akzeptiert, solange sie sich nicht in `shared` überschneiden.

## Muster für Speicher und Lebenszyklus
1. `const deps = useStoreDeps(onStatus)`; solange `null`: `LoadingState`.
2. Store je Session wählen: `state.status === "account"` → `createCloudStore(deps, { $id: state.user.id })` (Signatur laut deiner Phase-1-Stores), sonst Gast-Store. Bei Wechsel Gast↔Konto/Kontowechsel: alten Store `flush()`, ggf. `dispose()`, Daten neu laden; veraltete Antworten per Token verwerfen (`loadToken`).
3. Laden fehlgeschlagen: `ErrorState` mit „Neu laden“ – nichts Falsches in das Konto schreiben (Fallback wie im Web nur, wenn es dort so ist, aber ohne Daten ins Konto zu überschreiben).
4. `flush()` bei `AppState` `background`/`inactive` und beim Unmount.
5. Gast→Konto-Import wie im Web (Dialog einmal je Konto, Ablehnen merken über `kv`), danach `guest.clear()` nur bei vollständigem Erfolg.
6. Logik, die im Web in der UI steckt (Ansichts-Bereinigung, Sortierung, Validierung), als reine, getestete Funktionen in `model.ts` (node:test, wie bisher). Komponenten selbst werden nicht unit-getestet (kein Test-Renderer vorhanden); halte sie dünn.
7. Barrierefreiheit: `accessibilityLabel`/`Role`/`State`, Touch-Ziele ≥ 44 pt, dynamische Schrift (kein festes `height` an Text), `accessibilityRole="alert"` an Fehlern, reduzierte Bewegung via `AccessibilityInfo`.
8. Tastatur: `Screen` hat `automaticallyAdjustKeyboardInsets`; Formulare in `Modal` mit `KeyboardAvoidingView`.

## Abnahme (vor deinem Bericht)
- `npx tsc --noEmit` ohne Fehler in deinen Pfaden (Rest nicht deine Sache, melde ihn).
- `npm test` grün (neue `model`-Tests inklusive).
- Keine Imports außerhalb des App-Projekts, kein Browser-Global.
- Bericht: Dateien, Testzahlen, Abweichungen vom Web, offene Punkte (Wünsche an A: Pakete, Hooks wie „vor Abmelden flushen“).
