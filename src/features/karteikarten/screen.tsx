/* Karteikarten – Screen (Route app/tools/karteikarten.tsx liest `deck` aus useLocalSearchParams und reicht es als deckParam durch).
 * Meldungen wie der Web-Toast: Ink-Fläche, Text in on-primary, Fehler halbfett.
 * Web-Quelle: tools/karteikarten/karteikarten.js (Web-Commit 770dbe4). Zustand: hooks.ts, Logik: session-model.ts. Ohne KI-Block (Folgepaket). */
import { router, usePreventRemove } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { confirmAction } from "../appwrite-tools/actions";
import type { Deck, StudyType } from "./core";
import type { DeckTab } from "./session-model";
import { useKarteikarten } from "./hooks";
import { CardDialog, DeckDialog, StartDialog } from "./components/Dialogs";
import { DeckList } from "./components/DeckList";
import { DeckView } from "./components/DeckView";
import { LoadingRound, ResultView, StudyView } from "./components/Study";
import { EmptyCard, LoadingPanel } from "./components/common";
import { detailPlaceholder, kkLayout, selectedDeckId } from "./layout";
import { radius, spacing, usePensumTheme } from "../../theme";
import { AppText, ErrorState, LoadingState, Panel, Screen } from "../../ui";
import { PressableScale } from "../../ui/motion";
import { TwoColumn, useWideLayout } from "../../ui/TwoColumn";
import { useSession } from "../../account/session";
import { aiEnabled } from "../../backend/config";

type Dialog =
  | { kind: "newDeck" }
  | { kind: "editDeck"; id: string }
  | { kind: "editCard"; deckId: string; cardId: string }
  | { kind: "start"; id: string }
  | null;

export default function KarteikartenScreen({ deckParam }: { deckParam?: string | string[] }) {
  const { state } = useSession();
  const k = useKarteikarten(deckParam);
  const { colors } = usePensumTheme();
  const [dialog, setDialog] = useState<Dialog>(null);
  const { view, data, actions } = k;
  const { split } = useWideLayout();
  const layout = kkLayout(view.name, split);
  const inSplit = layout.mode === "split";
  const login = () => router.push("/konto");
  // Lernrunde: kein Scrollen, die Karte füllt den Platz und weicht der Tastatur aus
  const studying = view.name === "study" || view.name === "loading" || view.name === "result";
  const headerHeight = useHeaderHeight();
  // Zurückwischen oder Zurück-Knopf mitten in einer Runde: erst nachfragen
  usePreventRemove(view.name === "study" || view.name === "loading", ({ repeat }) => {
    void confirmAction("Runde wirklich beenden?", "Dein Fortschritt (auch die Level) bleibt gespeichert, aber die Runde endet hier.", "Beenden", true)
      .then((ok) => { if (ok) repeat(); });
  });

  // Verwaister Stapel (z. B. gelöscht): zurück zur Liste
  const viewDeckId = view.name === "deck" ? view.id : view.name === "study" || view.name === "result" ? view.round.deckId : null;
  const missing = viewDeckId !== null && !k.deckById(viewDeckId);
  useEffect(() => { if (missing) actions.showList(); }, [missing]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Stapelansicht; `withBack` = mit Zurück-Knopf (einspaltig). In der Detailspalte (iPad) steht die Liste daneben. */
  function deckView(deck: Deck, tab: DeckTab, withBack: boolean) {
    return (
      <DeckView
        key={deck.id}
        deck={deck}
        tab={tab}
        onTab={actions.setTab}
        onBack={withBack ? actions.showList : undefined}
        onEditDeck={() => setDialog({ kind: "editDeck", id: deck.id })}
        onStart={(type: StudyType) => void actions.start(deck.id, type)}
        onAddCard={(front, back) => actions.addCard(deck.id, front, back)}
        onEditCard={(card) => setDialog({ kind: "editCard", deckId: deck.id, cardId: card.id })}
        onDeleteCard={(card) => actions.deleteCard(deck.id, card.id)}
        ki={k.ki}
        onKiToggle={actions.kiToggle}
        onKiAdd={() => actions.kiAdd(deck.id)}
        onKiDiscard={actions.kiDiscard}
      />
    );
  }

  let body;
  if (state.status === "loading") body = <LoadingPanel title="Deine Karten werden geladen" />;
  else if (state.status === "error") body = <ErrorState message={state.error.message} />;
  else if (k.loadError) body = <ErrorState title="Laden fehlgeschlagen." message={k.loadError} onRetry={actions.retryLoad} />;
  else if (view.name === "boot") body = <LoadingPanel title="Deine Karten werden geladen" />;
  else if (view.name === "list" || (view.name === "deck" && inSplit)) {
    const deckList = (
      <DeckList
        data={data}
        signedIn={k.signedIn}
        saveStatus={k.saveStatus}
        onLogin={login}
        onNewDeck={() => setDialog({ kind: "newDeck" })}
        onOpen={(id) => actions.openDeck(id)}
        onQuickStart={(deck: Deck) => setDialog({ kind: "start", id: deck.id })}
        master={inSplit}
        selectedId={selectedDeckId(view)}
      />
    );
    if (!inSplit) body = deckList;
    else {
      const deck = view.name === "deck" ? k.deckById(view.id) : undefined;
      const hint = detailPlaceholder(data.decks.length);
      const detail = view.name === "deck" && deck ? deckView(deck, view.tab, false) : (
        <Panel style={styles.placeholder}><EmptyCard compact title={hint.title} message={hint.message} /></Panel>
      );
      // iPad: Stapelliste links, gewählter Stapel rechts
      body = <TwoColumn split primary={deckList} secondary={detail} primaryWeight={2} secondaryWeight={3} />;
    }
  } else if (view.name === "loading") {
    body = <LoadingRound deck={k.deckById(view.round.deckId)} round={view.round} count={view.count} />;
  } else {
    const deck = viewDeckId ? k.deckById(viewDeckId) : undefined;
    if (!deck) body = <LoadingState />;
    else if (view.name === "deck") {
      body = deckView(deck, view.tab, true);
    } else if (view.name === "study") {
      body = (
        <StudyView
          deck={deck}
          round={view.round}
          onQuit={() => void actions.quit()}
          onFlip={actions.flip}
          onCheck={actions.check}
          onOverride={actions.override}
          onGrade={actions.grade}
          onNext={actions.next}
          reduceMotion={k.reduceMotion}
        />
      );
    } else {
      body = (
        <ResultView
          deck={deck}
          round={view.round}
          onToDeck={actions.toDeck}
          onAgain={() => void actions.start(deck.id, view.round.type)}
          onRetryWrong={() => void actions.start(deck.id, view.round.type, [...view.round.wrongIds])}
        />
      );
    }
  }

  const dialogDeck = dialog && dialog.kind !== "newDeck" ? k.deckById(dialog.kind === "editCard" ? dialog.deckId : dialog.id) : undefined;
  const closeDialog = () => setDialog(null);

  return (
    <Screen navigationTitle="Karteikarten" wide={split} scroll={!studying}>
      {k.notice ? (
        <PressableScale
          scaleTo={0.99}
          haptic="tap"
          onPress={k.dismissNotice}
          accessibilityRole="alert"
          accessibilityLabel={k.notice.text}
          accessibilityHint="Zum Schließen tippen"
          style={[styles.notice, { backgroundColor: colors.ink }]}
        >
          <AppText variant="bodySm" style={{ color: colors.onPrimary, fontWeight: k.notice.error ? "600" : "400" }}>{k.notice.text}</AppText>
        </PressableScale>
      ) : null}
      {studying ? (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={headerHeight} style={styles.fill}>
          <View style={[styles.body, styles.fill]}>{body}</View>
        </KeyboardAvoidingView>
      ) : <View style={styles.body}>{body}</View>}

      {dialog?.kind === "newDeck" ? (
        <DeckDialog kiTester={aiEnabled && k.kiTester} onSubmit={actions.createDeck} onKi={(id, input) => void actions.kiGenerate(id, input)} onClose={closeDialog} />
      ) : null}
      {dialog?.kind === "editDeck" && dialogDeck ? (
        <DeckDialog deck={dialogDeck} onSubmit={(name, mode) => actions.editDeck(dialogDeck.id, name, mode)} onDelete={() => actions.deleteDeck(dialogDeck.id)} onClose={closeDialog} />
      ) : null}
      {dialog?.kind === "editCard" && dialogDeck ? (
        (() => {
          const card = dialogDeck.cards.find((c) => c.id === dialog.cardId);
          return card ? <CardDialog card={card} onSubmit={(front, back) => actions.editCard(dialogDeck.id, card.id, front, back)} onClose={closeDialog} /> : null;
        })()
      ) : null}
      {dialog?.kind === "start" && dialogDeck ? (
        <StartDialog deck={dialogDeck} onStart={(type) => void actions.start(dialogDeck.id, type)} onClose={closeDialog} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  fill: { flex: 1 },
  placeholder: { minHeight: 320, justifyContent: "center" },
  notice: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.field, borderCurve: "continuous" },
});
