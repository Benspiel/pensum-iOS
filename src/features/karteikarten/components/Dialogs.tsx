/* Karteikarten – Dialoge: Stapel anlegen/bearbeiten/löschen, Karte bearbeiten, Lernart wählen.
 * Web-Quelle: karteikarten.js deckDialog, cardDialog, startDialog (Web-Commit 770dbe4). Texte wörtlich. */
import { useRef, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { MODES } from "../core";
import type { Card, Deck, DeckMode, StudyType } from "../core";
import { confirmAsync } from "../hooks";
import type { ActionResult, KiRequest } from "../hooks";
import { checkDeckEdit } from "../ops";
import { consentToGemini } from "../../appwrite-tools/actions";
import { COUNTS, DEFAULT_COUNT, TOPIC_MAX, checkKiInput, consentDescription } from "../ki/cards";
import { discardKiFile, pickKiFile } from "../ki/files";
import type { KiFile, KiFileSource } from "../ki/files";
import { plural } from "../session-model";
import { spacing } from "../../../theme";
import { AppText, Button, Field } from "../../../ui";
import { Sheet } from "./common";

export function DeckDialog({ deck, kiTester = false, onSubmit, onKi, onDelete, onClose }: {
  deck?: Deck;
  /** Nur Ki-Tester: „Mit KI erstellen“ beim Anlegen. Alle anderen sehen den deaktivierten Platzhalter. */
  kiTester?: boolean;
  onSubmit: (name: string, mode: DeckMode, withKi?: boolean) => ActionResult;
  onKi?: (deckId: string, input: KiRequest) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const creating = !deck;
  const [name, setName] = useState(deck ? deck.name : "");
  const [mode, setMode] = useState<DeckMode>(deck ? deck.mode : "level");
  const [error, setError] = useState("");
  const [useAi, setUseAi] = useState(false);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState<number>(DEFAULT_COUNT);
  const [file, setFile] = useState<KiFile | null>(null);
  const [picking, setPicking] = useState(false);
  const handedOver = useRef(false); // Datei gehört nach dem Absenden der KI-Anfrage, die sie aufräumt

  async function submit() {
    if (creating && kiTester && useAi) {
      const named = checkDeckEdit({ name, mode });
      if (!named.ok) { setError(named.error); return; }
      const missing = checkKiInput(topic, !!file);
      if (missing) { setError(missing); return; }
      // Ausdrückliches Einverständnis vor dem Senden an Google Gemini (wird nicht gemerkt, gilt nur für diese Anfrage)
      if (!(await consentToGemini(consentDescription(!!file)))) return;
    }
    const r = onSubmit(name, mode, creating && kiTester && useAi);
    if (!r.ok) { setError(r.error); return; }
    if (creating && kiTester && useAi && r.id && onKi) {
      handedOver.current = true;
      onClose();
      onKi(r.id, { topic: topic.trim(), file, count });
      return;
    }
    onClose();
  }

  function close() {
    if (file && !handedOver.current) discardKiFile(file);
    onClose();
  }

  async function choose(source: KiFileSource) {
    setPicking(true);
    setError("");
    try {
      const picked = await pickKiFile(source);
      if (picked) { if (file) discardKiFile(file); setFile(picked); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Die Datei konnte nicht geöffnet werden.");
    } finally {
      setPicking(false);
    }
  }

  async function remove() {
    if (!deck || !onDelete) return;
    const ok = await confirmAsync({ title: "Stapel löschen?", text: `„${deck.name}“ mit ${plural(deck.cards.length, "Karte", "Karten")} wird endgültig gelöscht.`, confirm: "Löschen", destructive: true });
    if (ok) { onClose(); onDelete(); }
  }

  return (
    <Sheet title={creating ? "Neuer Stapel." : "Stapel bearbeiten."} onClose={close}>
      <Field label="Name" value={name} onChangeText={setName} maxLength={80} autoFocus autoCorrect={false} placeholder="z. B. Englisch Unit 3" returnKeyType="done" onSubmitEditing={() => void submit()} />
      <View style={styles.group}>
        <AppText variant="label">Abfrage</AppText>
        <View style={styles.modes}>
          {(Object.keys(MODES) as DeckMode[]).map((k) => (
            <Button key={k} title={MODES[k].label} variant={k === mode ? "primary" : "secondary"} onPress={() => setMode(k)} accessibilityRole="radio" accessibilityState={{ checked: k === mode }} style={styles.mode} />
          ))}
        </View>
        <AppText variant="caption" tone="muted">{MODES[mode].hint}</AppText>
      </View>
      {creating && kiTester ? (
        <View style={styles.group}>
          <View style={styles.switchRow}>
            <AppText variant="label" style={styles.switchLabel}>Mit KI erstellen</AppText>
            <Switch value={useAi} onValueChange={setUseAi} accessibilityLabel="Mit KI erstellen" />
          </View>
          {useAi ? (
            <View style={styles.group}>
              <Field label="Dein Thema oder Text" value={topic} onChangeText={setTopic} maxLength={TOPIC_MAX} autoCorrect={false} placeholder="z. B. Französische Revolution" />
              <AppText variant="label">Oder ein Foto / PDF (z. B. Vokabelseite)</AppText>
              {file ? <AppText accessibilityLabel={`Ausgewählt: ${file.name}`}>{file.kind === "pdf" ? `PDF: ${file.name}` : "Foto ausgewählt"}</AppText> : null}
              <View style={styles.modes}>
                <Button title="Foto wählen" variant="secondary" disabled={picking} onPress={() => void choose("library")} style={styles.mode} />
                <Button title="Foto aufnehmen" variant="secondary" disabled={picking} onPress={() => void choose("camera")} style={styles.mode} />
                <Button title="PDF wählen" variant="secondary" disabled={picking} onPress={() => void choose("pdf")} style={styles.mode} />
                {file ? <Button title="Entfernen" variant="plain" onPress={() => { discardKiFile(file); setFile(null); }} /> : null}
              </View>
              <AppText variant="label">Anzahl (höchstens)</AppText>
              <View style={styles.modes}>
                {COUNTS.map((n) => (
                  <Button
                    key={n}
                    title={n === DEFAULT_COUNT ? "Alle (bis 60)" : `${n} Karten`}
                    variant={n === count ? "primary" : "secondary"}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: n === count }}
                    onPress={() => setCount(n)}
                    style={styles.mode}
                  />
                ))}
              </View>
              <AppText variant="caption" tone="muted">Die KI schlägt Karten vor. Du siehst sie, bevor etwas in den Stapel kommt. Thema, Text und Datei gehen dafür an Google Gemini; vor dem Senden fragt Pensum nach deiner Zustimmung.</AppText>
            </View>
          ) : null}
        </View>
      ) : creating ? (
        <View style={styles.group}>
          <Button title="Mit KI erstellen (Kommt bald)" variant="secondary" disabled accessibilityHint="Noch nicht verfügbar" onPress={() => undefined} />
          <AppText variant="caption" tone="muted">Bald gibst du nur dein Thema ein und die KI erstellt die Karten für dich.</AppText>
        </View>
      ) : null}
      {error ? <AppText tone="danger" accessibilityRole="alert">{error}</AppText> : null}
      <Button title={creating ? "Stapel erstellen" : "Speichern"} onPress={() => void submit()} />
      {!creating ? (
        <View style={styles.group}>
          <AppText variant="label">Stapel löschen</AppText>
          <Button title="Stapel löschen" variant="danger" onPress={() => void remove()} />
          <AppText variant="caption" tone="muted">Löscht den Stapel samt aller Karten. Das lässt sich nicht rückgängig machen.</AppText>
        </View>
      ) : null}
    </Sheet>
  );
}

export function CardDialog({ card, onSubmit, onClose }: {
  card: Card;
  onSubmit: (front: string, back: string) => ActionResult;
  onClose: () => void;
}) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [error, setError] = useState("");
  function submit() {
    const r = onSubmit(front, back);
    if (r.ok) onClose(); else setError(r.error);
  }
  return (
    <Sheet title="Karte bearbeiten." onClose={onClose}>
      <Field label="Vorderseite" value={front} onChangeText={setFront} maxLength={1000} multiline />
      <Field label="Rückseite" value={back} onChangeText={setBack} maxLength={1000} multiline />
      {error ? <AppText tone="danger" accessibilityRole="alert">{error}</AppText> : null}
      <Button title="Speichern" onPress={submit} />
    </Sheet>
  );
}

export function StartDialog({ deck, onStart, onClose }: { deck: Deck; onStart: (type: StudyType) => void; onClose: () => void }) {
  return (
    <Sheet title={deck.name} onClose={onClose}>
      <AppText tone="muted">Wie möchtest du lernen?</AppText>
      <StartButtons onStart={(t) => { onClose(); onStart(t); }} />
    </Sheet>
  );
}

/** Die Knöpfe „Üben“ und „Test“ mit ihren Unterzeilen. */
export function StartButtons({ onStart, disabled = false }: { onStart: (type: StudyType) => void; disabled?: boolean }) {
  return (
    <View style={styles.group}>
      <Button title="Üben" onPress={() => onStart("practice")} disabled={disabled} accessibilityHint="Karte umdrehen, selbst bewerten" />
      <AppText variant="caption" tone="muted" style={styles.sub}>Karte umdrehen, selbst bewerten</AppText>
      <Button title="Test" variant="secondary" onPress={() => onStart("test")} disabled={disabled} accessibilityHint="Antwort schriftlich eingeben" />
      <AppText variant="caption" tone="muted" style={styles.sub}>Antwort schriftlich eingeben</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  modes: { gap: spacing.sm },
  mode: { alignSelf: "stretch" },
  sub: { textAlign: "center" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 44 },
  switchLabel: { flexShrink: 1 },
});
