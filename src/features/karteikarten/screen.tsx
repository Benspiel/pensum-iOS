/* Karteikarten – Screen (Route app/tools/karteikarten.tsx liest `deck` aus useLocalSearchParams und reicht es als deckParam durch).
 * Web-Quelle: tools/karteikarten/karteikarten.js (Web-Commit 770dbe4). Zustand: hooks.ts, Logik: session-model.ts. Ohne KI-Block (Folgepaket). */
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { Deck, StudyType } from "./core";
import { useKarteikarten } from "./hooks";
import { CardDialog, DeckDialog, StartDialog } from "./components/Dialogs";
import { DeckList } from "./components/DeckList";
import { DeckView } from "./components/DeckView";
import { LoadingRound, ResultView, StudyView } from "./components/Study";
import { spacing, usePensumTheme } from "../../theme";
import { AppText, ErrorState, LoadingState, Screen } from "../../ui";
import { useSession } from "../../account/session";

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
  const login = () => router.push("/konto");

  // Verwaister Stapel (z. B. gelöscht): zurück zur Liste
  const viewDeckId = view.name === "deck" ? view.id : view.name === "study" || view.name === "result" ? view.round.deckId : null;
  const missing = viewDeckId !== null && !k.deckById(viewDeckId);
  useEffect(() => { if (missing) actions.showList(); }, [missing]); // eslint-disable-line react-hooks/exhaustive-deps

  let body;
  if (state.status === "loading") body = <LoadingState title="Deine Karten werden geladen" />;
  else if (state.status === "error") body = <ErrorState message={state.error.message} />;
  else if (k.loadError) body = <ErrorState title="Laden fehlgeschlagen." message={k.loadError} onRetry={actions.retryLoad} />;
  else if (view.name === "boot") body = <LoadingState title="Deine Karten werden geladen" />;
  else if (view.name === "list") {
    body = (
      <DeckList
        data={data}
        signedIn={k.signedIn}
        saveStatus={k.saveStatus}
        onLogin={login}
        onNewDeck={() => setDialog({ kind: "newDeck" })}
        onOpen={(id) => actions.openDeck(id)}
        onQuickStart={(deck: Deck) => setDialog({ kind: "start", id: deck.id })}
      />
    );
  } else if (view.name === "loading") {
    body = <LoadingRound deck={k.deckById(view.round.deckId)} round={view.round} count={view.count} />;
  } else {
    const deck = viewDeckId ? k.deckById(viewDeckId) : undefined;
    if (!deck) body = <LoadingState />;
    else if (view.name === "deck") {
      body = (
        <DeckView
          deck={deck}
          tab={view.tab}
          onTab={actions.setTab}
          onBack={actions.showList}
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
    <Screen navigationTitle="Karteikarten">
      {k.notice ? (
        <Pressable
          onPress={k.dismissNotice}
          accessibilityRole="alert"
          accessibilityLabel={k.notice.text}
          accessibilityHint="Zum Schließen tippen"
          style={[styles.notice, { backgroundColor: k.notice.error ? colors.dangerSurface : colors.accentSurface }]}
        >
          <AppText tone={k.notice.error ? "danger" : "default"}>{k.notice.text}</AppText>
        </Pressable>
      ) : null}
      <View style={styles.body}>{body}</View>

      {dialog?.kind === "newDeck" ? (
        <DeckDialog kiTester={k.kiTester} onSubmit={actions.createDeck} onKi={(id, input) => void actions.kiGenerate(id, input)} onClose={closeDialog} />
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
  notice: { padding: spacing.md, borderRadius: 16 },
});
