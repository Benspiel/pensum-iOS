/* Planer – Dialog „Neue Hausaufgabe / Klausur“ und „… bearbeiten“ (Web: itemDialog). Die Prüfung steckt in model.ts → validateForm. */
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText, Button, Field } from "../../../ui";
import { spacing, usePensumTheme } from "../../../theme";
import type { ItemKind, PlanItem } from "../core";
import type { DeckSummary } from "../links";
import {
  TEXT, deckOptions, dialogLabels, dialogTitle, emptyForm, formFromItem, subjectSuggestions, validateForm,
  type FormErrors, type FormFields, type ItemForm,
} from "../model";
import { Chip } from "./Chip";

export function ItemDialog({ kind, item, items, decks, onClose, onSubmit }: {
  kind: ItemKind;
  /** null = neuer Eintrag */
  item: PlanItem | null;
  items: readonly PlanItem[];
  decks: readonly DeckSummary[];
  onClose: () => void;
  onSubmit: (fields: FormFields) => void;
}) {
  const { colors } = usePensumTheme();
  const creating = !item;
  const labels = dialogLabels(kind);
  const [form, setForm] = useState<ItemForm>(() => (item ? formFromItem(item) : emptyForm()));
  const [errors, setErrors] = useState<FormErrors>({});
  const set = (patch: Partial<ItemForm>) => setForm((f) => ({ ...f, ...patch }));

  const submit = () => {
    const r = validateForm(form, kind, creating, items.length);
    if (!r.ok) { setErrors(r.errors); return; }
    onSubmit(r.fields);
  };

  const suggestions = subjectSuggestions(items, form.subject);
  const options = deckOptions(decks);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.flex, { backgroundColor: colors.canvas }]}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.head}>
            <AppText variant="title" accessibilityRole="header" style={styles.headTitle}>{dialogTitle(kind, creating)}</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Schließen" onPress={onClose} style={styles.close}>
              <AppText variant="label" tone="accent" accessible={false}>Schließen</AppText>
            </Pressable>
          </View>

          <Field
            label={labels.title}
            value={form.title}
            onChangeText={(t) => { set({ title: t }); if (errors.title) setErrors((e) => ({ ...e, title: undefined })); }}
            maxLength={120}
            autoFocus
            autoCorrect={false}
            placeholder={labels.titlePlaceholder}
            error={errors.title}
          />

          <View style={styles.group}>
            <Field label={labels.subject} value={form.subject} onChangeText={(t) => set({ subject: t })} maxLength={60} placeholder={labels.subjectPlaceholder} />
            {suggestions.length ? (
              <View style={styles.wrap} accessibilityLabel="Vorschläge für das Fach">
                {suggestions.map((s) => <Chip key={s} title={s} accessibilityLabel={`Fach ${s} übernehmen`} onPress={() => set({ subject: s })} />)}
              </View>
            ) : null}
          </View>

          <Field
            label={labels.date}
            value={form.date}
            onChangeText={(t) => { set({ date: t }); if (errors.date) setErrors((e) => ({ ...e, date: undefined })); }}
            maxLength={10}
            keyboardType="numbers-and-punctuation"
            placeholder={labels.datePlaceholder}
            error={errors.date}
          />

          <Field
            label={labels.note}
            value={form.note}
            onChangeText={(t) => set({ note: t })}
            maxLength={500}
            multiline
            placeholder={labels.notePlaceholder}
          />

          {kind === "exam" ? (
            <View style={styles.group}>
              <AppText variant="label">{labels.deck}</AppText>
              <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={labels.deck}>
                {options.map((o) => (
                  <Chip key={o.id || "none"} radio title={o.name} accessibilityLabel={o.id ? `Stapel ${o.name}` : "Keiner"} selected={form.deckId === o.id} onPress={() => set({ deckId: o.id })} />
                ))}
              </View>
              {decks.length ? null : <AppText variant="caption" tone="muted">{TEXT.noDecks}</AppText>}
            </View>
          ) : null}

          {errors.form ? <AppText tone="danger" accessibilityRole="alert">{errors.form}</AppText> : null}
          <Button title={labels.submit(creating)} onPress={submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  headTitle: { flex: 1 },
  close: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "flex-end" },
  group: { gap: spacing.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
