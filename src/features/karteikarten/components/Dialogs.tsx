/* Karteikarten – Dialoge: Stapel anlegen/bearbeiten/löschen, Karte bearbeiten, Lernart wählen.
 * Web-Quelle: karteikarten.js deckDialog, cardDialog, startDialog (Web-Commit 770dbe4). Texte wörtlich. */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { MODES } from "../core";
import type { Card, Deck, DeckMode, StudyType } from "../core";
import { confirmAsync } from "../hooks";
import type { ActionResult } from "../hooks";
import { plural } from "../session-model";
import { spacing } from "../../../theme";
import { AppText, Button, Field } from "../../../ui";
import { Sheet } from "./common";

export function DeckDialog({ deck, onSubmit, onDelete, onClose }: {
  deck?: Deck;
  onSubmit: (name: string, mode: DeckMode) => ActionResult;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const creating = !deck;
  const [name, setName] = useState(deck ? deck.name : "");
  const [mode, setMode] = useState<DeckMode>(deck ? deck.mode : "level");
  const [error, setError] = useState("");

  function submit() {
    const r = onSubmit(name, mode);
    if (r.ok) onClose(); else setError(r.error);
  }

  async function remove() {
    if (!deck || !onDelete) return;
    const ok = await confirmAsync({ title: "Stapel löschen?", text: `„${deck.name}“ mit ${plural(deck.cards.length, "Karte", "Karten")} wird endgültig gelöscht.`, confirm: "Löschen", destructive: true });
    if (ok) { onClose(); onDelete(); }
  }

  return (
    <Sheet title={creating ? "Neuer Stapel." : "Stapel bearbeiten."} onClose={onClose}>
      <Field label="Name" value={name} onChangeText={setName} maxLength={80} autoFocus autoCorrect={false} placeholder="z. B. Englisch Unit 3" returnKeyType="done" onSubmitEditing={submit} />
      <View style={styles.group}>
        <AppText variant="label">Abfrage</AppText>
        <View style={styles.modes}>
          {(Object.keys(MODES) as DeckMode[]).map((k) => (
            <Button key={k} title={MODES[k].label} variant={k === mode ? "primary" : "secondary"} onPress={() => setMode(k)} accessibilityRole="radio" accessibilityState={{ checked: k === mode }} style={styles.mode} />
          ))}
        </View>
        <AppText variant="caption" tone="muted">{MODES[mode].hint}</AppText>
      </View>
      {creating ? (
        <View style={styles.group}>
          <Button title="Mit KI erstellen (Kommt bald)" variant="secondary" disabled accessibilityHint="Noch nicht verfügbar" onPress={() => undefined} />
          <AppText variant="caption" tone="muted">Bald gibst du nur dein Thema ein und die KI erstellt die Karten für dich.</AppText>
        </View>
      ) : null}
      {error ? <AppText tone="danger" accessibilityRole="alert">{error}</AppText> : null}
      <Button title={creating ? "Stapel erstellen" : "Speichern"} onPress={submit} />
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
});
