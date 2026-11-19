/* Spiele – Vier gewinnt gegen den Computer (nativ). Web-Quelle: tools/spiele/ui-vier.js, spiele.js (Pensum, Web-Commit 770dbe4).
 * Arcade-Spiele, Schach und der Katalog sind nicht portiert, siehe OPEN.md. */
import { useStoreDeps } from "../../storage";
import { AppText, LoadingState, Screen } from "../../ui";
import { Board } from "./components/Board";
import { LevelPicker } from "./components/LevelPicker";
import { StatusCard } from "./components/StatusCard";
import { LEVELS } from "./model";
import { useConnect4 } from "./useConnect4";
import { useReduceMotion } from "./useReduceMotion";

export function SpieleScreen() {
  const deps = useStoreDeps();
  return (
    <Screen title="Vier gewinnt" description="Gegen den Computer. Du spielst gelb und beginnst." navigationTitle="Spiele">
      {deps ? <Game kv={deps.kv} /> : <LoadingState />}
    </Screen>
  );
}

function Game({ kv }: { kv: Parameters<typeof useConnect4>[0] }) {
  const reduceMotion = useReduceMotion();
  const c4 = useConnect4(kv);
  return (
    <>
      <LevelPicker level={c4.level} onPick={c4.setLevel} />
      <StatusCard status={c4.status} wins={c4.wins} levelLabel={LEVELS[c4.level].label} onRestart={c4.restart} />
      <Board game={c4.game} locked={c4.game.over || c4.thinking} reduceMotion={reduceMotion} onColumn={c4.humanMove} />
      <AppText variant="caption" tone="muted">Tippe auf eine Spalte, um einen Stein zu setzen. Vier in einer Reihe gewinnen.</AppText>
    </>
  );
}

export default SpieleScreen;
