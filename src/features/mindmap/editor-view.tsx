/* Mindmap – Darstellung des Editors (Werkzeugleiste, Zeichenfläche, Schrift/Farbe, Panels, Export-Zeilen). Rein darstellend: Zustand und
 * Aktionen kommen von screen.tsx. Aufbau wie Web tools/mindmap/index.html (Abschnitt `#editor`). */
import type { ComponentRef, RefObject } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { spacing } from '../../theme';
import { AppText, Button, Chip, Field, Panel, Segmented } from '../../ui';
import { ExportList, FormMessage, InkDot } from '../goodnotes/parts';
import { MindmapCanvas, type CanvasHandle } from './canvas';
import { INKS, type Scene } from './scene';
import type { ToolState } from './state';
import { MAP } from './tree';

export const HAND_HINT = 'Noch keine Handschrift hinterlegt. Leg sie im Goodnotes-Tool an, dann kannst du sie hier nutzen.';
const short = (text: string, max = 26) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export interface EditorViewProps {
  scene: Scene;
  tools: ToolState;
  ink: string;
  selectedId: string;
  fitKey: string;
  canvasHeight: number;
  bigText: boolean;
  canvasRef?: RefObject<CanvasHandle | null>;
  maps: { id: string; label: string }[];
  currentId: string;
  canDelete: boolean;
  busy: boolean;
  hasHand: boolean;
  useHandFont: boolean;
  saveText: string;
  nodeText: string;
  nodeInput?: RefObject<ComponentRef<typeof TextInput> | null>;
  actionError: string;
  ai: { info: string; label: string; disabled: boolean; editable: boolean; value: string; error: string };
  exporting: 'goodnotes' | 'pdf' | null;
  exportBlocked: boolean;
  on: {
    switchMap(id: string): void;
    removeMap(): void;
    addChild(): void;
    addSibling(): void;
    moveUp(): void;
    moveDown(): void;
    removeNode(): void;
    undo(): void;
    redo(): void;
    foldNode(): void;
    foldAll(): void;
    unfoldAll(): void;
    select(id: string): void;
    edit(id: string): void;
    toggleFold(id: string): void;
    chooseFont(font: 'standard' | 'hand'): void;
    chooseInk(ink: string): void;
    openHandTool(): void;
    nodeText(text: string): void;
    nodeFocus(): void;
    nodeBlur(): void;
    clearActionError(): void;
    instruction(text: string): void;
    refine(): void;
    exportGoodnotes(): void;
    exportPdf(): void;
    toGoodnotesTool(): void;
  };
}

export function EditorView(p: EditorViewProps) {
  const { tools, on } = p;
  return (
    <View style={styles.editor}>
      <AppText variant="h3" accessibilityRole="header">Deine Mindmap.</AppText>

      {p.maps.length > 1 || p.canDelete ? (
        <View accessibilityRole="radiogroup" accessibilityLabel="Mindmap auswählen" style={styles.pick}>
          {p.maps.map((entry) => (
            <Chip key={entry.id} label={short(entry.label)} accessibilityLabel={entry.label} selected={entry.id === p.currentId} disabled={p.busy} onPress={() => on.switchMap(entry.id)} />
          ))}
        </View>
      ) : null}
      {p.canDelete ? <Button title="Mindmap löschen" variant="secondary" size="sm" disabled={p.busy} onPress={on.removeMap} style={styles.alignStart} /> : null}

      <Panel style={styles.toolbar}>
        <View accessibilityRole="toolbar" accessibilityLabel="Punkte" style={styles.group}>
          <Button title="+ Unterpunkt" variant="soft" size="sm" disabled={!tools.canAddChild} onPress={on.addChild} />
          <Button title="+ Nebenpunkt" variant="soft" size="sm" disabled={!tools.canAddSibling} onPress={on.addSibling} />
          <Button title="↑" accessibilityLabel="Nach oben schieben" variant="soft" size="sm" disabled={!tools.canMoveUp} onPress={on.moveUp} />
          <Button title="↓" accessibilityLabel="Nach unten schieben" variant="soft" size="sm" disabled={!tools.canMoveDown} onPress={on.moveDown} />
          <Button title="Löschen" accessibilityLabel="Punkt löschen" variant="soft" size="sm" disabled={!tools.canRemove} onPress={on.removeNode} />
        </View>
        <View accessibilityRole="toolbar" accessibilityLabel="Ansicht" style={styles.group}>
          <Button title="↶" accessibilityLabel="Rückgängig" variant="soft" size="sm" disabled={!tools.canUndo} onPress={on.undo} />
          <Button title="↷" accessibilityLabel="Wiederholen" variant="soft" size="sm" disabled={!tools.canRedo} onPress={on.redo} />
          <Button title={tools.folded ? 'Ast ausklappen' : 'Ast einklappen'} variant="soft" size="sm" disabled={!tools.canFoldNode} onPress={on.foldNode} />
          <Button title="Alles einklappen" variant="soft" size="sm" disabled={!tools.canFoldAll} onPress={on.foldAll} />
          <Button title="Alles ausklappen" variant="soft" size="sm" disabled={!tools.canUnfoldAll} onPress={on.unfoldAll} />
          <Button title="−" accessibilityLabel="Verkleinern" variant="soft" size="sm" onPress={() => p.canvasRef?.current?.zoomOut()} />
          <Button title="Einpassen" variant="soft" size="sm" onPress={() => p.canvasRef?.current?.fit()} />
          <Button title="+" accessibilityLabel="Vergrößern" variant="soft" size="sm" onPress={() => p.canvasRef?.current?.zoomIn()} />
        </View>
      </Panel>

      <MindmapCanvas
        ref={p.canvasRef}
        scene={p.scene}
        ink={p.ink}
        selectedId={p.selectedId}
        fitKey={p.fitKey}
        height={p.canvasHeight}
        onSelect={on.select}
        onEdit={on.edit}
        onToggleFold={on.toggleFold}
      />
      {p.bigText ? (
        <AppText variant="caption" tone="muted">Deine Schriftgröße ist größer, als die Karte mitwächst. Mit zwei Fingern kannst du die Karte weiter vergrößern.</AppText>
      ) : null}

      <View style={styles.meta}>
        <View style={styles.metaBlock}>
          <AppText variant="fieldLabel">Schrift</AppText>
          <Segmented
            label="Schrift"
            value={p.useHandFont ? 'hand' : 'standard'}
            onChange={on.chooseFont}
            options={[
              { id: 'standard', label: 'Standardschrift' },
              { id: 'hand', label: 'Eigene Handschrift', disabled: !p.hasHand },
            ]}
          />
          {!p.hasHand ? (
            <>
              <AppText variant="caption" tone="muted">{HAND_HINT}</AppText>
              <Button title="Im Goodnotes-Tool anlegen" variant="plain" size="sm" onPress={on.openHandTool} style={styles.alignStart} />
            </>
          ) : null}
        </View>
        <View style={styles.metaBlock}>
          <AppText variant="fieldLabel">Farbe</AppText>
          <View accessibilityRole="radiogroup" accessibilityLabel="Farbe" style={styles.inks}>
            {INKS.map((entry) => <InkDot key={entry.id} color={entry.id} label={entry.name} selected={entry.id === p.ink} onPress={() => on.chooseInk(entry.id)} />)}
          </View>
        </View>
        <AppText variant="bodySm" tone="muted" accessibilityLiveRegion="polite">{p.saveText}</AppText>
      </View>

      <View style={styles.side}>
        <Panel style={styles.panel}>
          <AppText variant="h4" accessibilityRole="header">Ausgewählter Punkt.</AppText>
          <Field
            ref={p.nodeInput}
            label="Text"
            value={p.nodeText}
            onChangeText={on.nodeText}
            onFocus={on.nodeFocus}
            onBlur={on.nodeBlur}
            editable={tools.hasSelection}
            maxLength={MAP.text}
            autoCorrect={false}
            selectTextOnFocus
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            placeholder="Punkt antippen, dann hier ändern"
            hint="Tippe einen Punkt an, dann änderst du hier den Text. Ein zweiter Tipp springt in dieses Feld, langes Drücken klappt einen Ast ein oder aus."
          />
          {p.actionError ? <FormMessage text={p.actionError} onDismiss={on.clearActionError} /> : null}
        </Panel>

        <Panel style={styles.panel}>
          <AppText variant="h4" accessibilityRole="header">Mit KI ändern.</AppText>
          <AppText variant="bodySm" tone="muted">{p.ai.info}</AppText>
          <Field
            label="Was soll sich ändern?"
            value={p.ai.value}
            onChangeText={on.instruction}
            maxLength={500}
            multiline
            editable={p.ai.editable}
            placeholder="z. B. Füge unter „Ursachen“ mehr Details hinzu und kürze den Ast „Folgen“"
          />
          {p.ai.error ? <FormMessage text={p.ai.error} /> : null}
          <Button title={p.ai.label} loading={p.busy} disabled={p.ai.disabled} onPress={on.refine} />
          <AppText variant="bodySm" tone="muted">KI-Inhalte können Fehler enthalten. Prüf sie, bevor du sie lernst. Jede Änderung lässt sich mit „Rückgängig“ zurücknehmen, zählt aber trotzdem.</AppText>
        </Panel>
      </View>

      <ExportList
        title="Mindmap exportieren"
        rows={[
          {
            id: 'goodnotes', title: 'Als Goodnotes', hint: '.goodnotes-Datei zum Öffnen in Goodnotes', symbol: 'square.and.arrow.up',
            accessibilityLabel: 'Als Goodnotes exportieren', busy: p.exporting === 'goodnotes', disabled: p.exportBlocked, onPress: on.exportGoodnotes,
          },
          {
            id: 'pdf', title: 'Als PDF', hint: 'Zum Drucken und Teilen', symbol: 'doc.richtext',
            accessibilityLabel: 'Als PDF exportieren', busy: p.exporting === 'pdf', disabled: p.exportBlocked, onPress: on.exportPdf,
          },
          {
            id: 'tool', title: 'In Goodnotes-Tool übernehmen', hint: 'Die Punkte als Text im Goodnotes-Tool in Handschrift setzen', symbol: 'pencil.and.scribble',
            accessibilityLabel: 'Text in Goodnotes-Tool übernehmen', busy: false, disabled: p.exportBlocked, onPress: on.toGoodnotesTool,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.lg },
  editor: { gap: spacing.lg },
  pick: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  alignStart: { alignSelf: 'flex-start' },
  toolbar: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  meta: { gap: spacing.lg },
  metaBlock: { gap: spacing.sm },
  inks: { flexDirection: 'row', gap: spacing.xs },
  side: { gap: spacing.lg },
});
