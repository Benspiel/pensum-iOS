/* Karteikarten – Dialoge: Stapel anlegen/bearbeiten/löschen, Karte bearbeiten, Lernart wählen.
 * Web-Quelle: karteikarten.js deckDialog, cardDialog, startDialog (Web-Commit 770dbe4). Texte wörtlich.
 * Optik: karteikarten.css (.kk-ai, .kk-start, .kk-danger) und pensum.css (.modal, .field, .select, .check). */
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Switch, View, useWindowDimensions } from "react-native";
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
import { radius, spacing, usePensumTheme } from "../../../theme";
import { AppText, Badge, Button, Chip, Field, Panel, Segmented } from "../../../ui";
import { FormMessage, Sheet } from "./common";

const MODE_IDS = Object.keys(MODES) as DeckMode[];

export function DeckDialog({ deck, kiTester = false, onSubmit, onKi, onDelete, onClose }: {
  deck?: Deck;
  /** Nur Ki-Tester: „Mit KI erstellen“ beim Anlegen. Alle anderen sehen den deaktivierten Platzhalter. */
  kiTester?: boolean;
  onSubmit: (name: string, mode: DeckMode, withKi?: boolean) => ActionResult;
  onKi?: (deckId: string, input: KiRequest) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { colors } = usePensumTheme();
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
        <AppText variant="fieldLabel">Abfrage</AppText>
        <Segmented
          label="Abfrage"
          options={MODE_IDS.map((k) => ({ id: k, label: MODES[k].label }))}
          value={mode}
          onChange={setMode}
        />
        <AppText variant="caption" tone="muted">{MODES[mode].hint}</AppText>
      </View>
      {creating && kiTester ? (
        <Panel style={styles.ai}>
          <View style={styles.switchRow}>
            <AppText variant="bodySm" style={styles.switchLabel}>Mit KI erstellen</AppText>
            <Switch
              value={useAi}
              onValueChange={setUseAi}
              accessibilityLabel="Mit KI erstellen"
              trackColor={{ false: colors.border, true: colors.ink }}
              thumbColor={colors.canvas}
              ios_backgroundColor={colors.border}
            />
          </View>
          {useAi ? (
            <View style={styles.aiBody}>
              <Field label="Dein Thema oder Text" value={topic} onChangeText={setTopic} maxLength={TOPIC_MAX} autoCorrect={false} placeholder="z. B. Französische Revolution" />
              <View style={styles.group}>
                <AppText variant="fieldLabel">Oder ein Foto / PDF (z. B. Vokabelseite)</AppText>
                {file ? <AppText variant="bodySm" accessibilityLabel={`Ausgewählt: ${file.name}`}>{file.kind === "pdf" ? `PDF: ${file.name}` : "Foto ausgewählt"}</AppText> : null}
                <View style={styles.wrap}>
                  <Button title="Foto wählen" variant="soft" size="sm" disabled={picking} onPress={() => void choose("library")} />
                  <Button title="Foto aufnehmen" variant="soft" size="sm" disabled={picking} onPress={() => void choose("camera")} />
                  <Button title="PDF wählen" variant="soft" size="sm" disabled={picking} onPress={() => void choose("pdf")} />
                  {file ? <Button title="Entfernen" variant="plain" size="sm" onPress={() => { discardKiFile(file); setFile(null); }} /> : null}
                </View>
              </View>
              <View style={styles.group}>
                <AppText variant="fieldLabel">Anzahl (höchstens)</AppText>
                <View style={styles.wrap}>
                  {COUNTS.map((n) => (
                    <Chip key={n} label={n === DEFAULT_COUNT ? "Alle (bis 60)" : `${n} Karten`} selected={n === count} onPress={() => setCount(n)} />
                  ))}
                </View>
              </View>
              <AppText variant="caption" tone="muted">Die KI schlägt Karten vor. Du siehst sie, bevor etwas in den Stapel kommt. Thema, Text und Datei gehen dafür an Google Gemini; vor dem Senden fragt Pensum nach deiner Zustimmung.</AppText>
            </View>
          ) : null}
        </Panel>
      ) : creating ? (
        <Panel style={styles.ai}>
          <View
            accessible
            accessibilityLabel="Mit KI erstellen (Kommt bald)"
            accessibilityHint="Noch nicht verfügbar"
            accessibilityState={{ disabled: true }}
            style={styles.switchRow}
          >
            <AppText variant="bodySm" style={[styles.switchLabel, styles.dimmed]}>Mit KI erstellen</AppText>
            <Badge label="Kommt bald" style={styles.soonBadge} />
          </View>
          <AppText variant="caption" tone="muted">Bald gibst du nur dein Thema ein und die KI erstellt die Karten für dich.</AppText>
        </Panel>
      ) : null}
      {error ? <FormMessage text={error} /> : null}
      <Button title={creating ? "Stapel erstellen" : "Speichern"} onPress={() => void submit()} />
      {!creating ? (
        <View style={[styles.danger, { borderTopColor: colors.hairlineSoft }]}>
          <AppText variant="fieldLabel">Stapel löschen</AppText>
          <Button title="Stapel löschen" variant="secondary" accessibilityHint="Destruktive Aktion" onPress={() => void remove()} />
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
      <Field label="Vorderseite" value={front} onChangeText={setFront} maxLength={1000} multiline style={styles.textarea} />
      <Field label="Rückseite" value={back} onChangeText={setBack} maxLength={1000} multiline style={styles.textarea} />
      {error ? <FormMessage text={error} /> : null}
      <Button title="Speichern" onPress={submit} />
    </Sheet>
  );
}

export function StartDialog({ deck, onStart, onClose }: { deck: Deck; onStart: (type: StudyType) => void; onClose: () => void }) {
  return (
    <Sheet title={deck.name} onClose={onClose}>
      <AppText variant="bodySm" tone="muted">Wie möchtest du lernen?</AppText>
      <StartButtons stacked onStart={(t) => { onClose(); onStart(t); }} />
    </Sheet>
  );
}

/** Die großen Knöpfe „Üben“ und „Test“ mit ihrer Unterzeile (Web: .kk-start; ab 640 nebeneinander, ab 768 deutlich größer). */
export function StartButtons({ onStart, disabled = false, stacked = false, compact = false }: { onStart: (type: StudyType) => void; disabled?: boolean; stacked?: boolean; compact?: boolean }) {
  const { width } = useWindowDimensions();
  // compact: schmale Detailspalte auf dem iPad – nebeneinander, aber nicht die großen Knöpfe
  const columns = !stacked && (compact || width >= 640);
  const large = !stacked && !compact && width >= 768;
  return (
    <View style={[styles.start, columns && styles.startColumns, large && { gap: spacing.lg }]}>
      <StartButton title="Üben" sub="Karte umdrehen, selbst bewerten" primary large={large} columns={columns} disabled={disabled} onPress={() => onStart("practice")} />
      <StartButton title="Test" sub="Antwort schriftlich eingeben" large={large} columns={columns} disabled={disabled} onPress={() => onStart("test")} />
    </View>
  );
}

function StartButton({ title, sub, primary = false, large, columns, disabled, onPress }: { title: string; sub: string; primary?: boolean; large: boolean; columns: boolean; disabled: boolean; onPress: () => void }) {
  const { colors } = usePensumTheme();
  const foreground = primary ? colors.onPrimary : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={sub}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.startButton,
        columns && styles.startButtonFlex,
        large && styles.startButtonLarge,
        {
          backgroundColor: primary ? (pressed ? colors.inkSoft : colors.ink) : pressed ? colors.surface : colors.canvas,
          borderColor: primary ? "transparent" : colors.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <AppText variant="link" accessible={false} style={[styles.startTitle, { color: foreground }, large && { fontSize: 28, lineHeight: 34 }]}>{title}</AppText>
      <AppText variant="caption" accessible={false} style={[styles.startSub, { color: foreground }, large && { fontSize: 15, lineHeight: 20 }]}>{sub}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  ai: { padding: spacing.lg, gap: spacing.md, borderRadius: radius.field },
  aiBody: { gap: spacing.lg },
  dimmed: { opacity: 0.55 },
  soonBadge: { alignSelf: "center" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 44 },
  switchLabel: { flexShrink: 1, fontWeight: "600" },
  textarea: { minHeight: 96 },
  danger: { gap: spacing.sm, paddingTop: spacing.lg, borderTopWidth: 1 },
  start: { gap: spacing.md },
  startColumns: { flexDirection: "row" },
  startButton: { minHeight: 64, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderCurve: "continuous", borderWidth: 1, alignItems: "center", justifyContent: "center" },
  startButtonFlex: { flex: 1 },
  startButtonLarge: { minHeight: 160, borderRadius: 40 },
  startTitle: { textAlign: "center" },
  startSub: { textAlign: "center", opacity: 0.8 },
});
