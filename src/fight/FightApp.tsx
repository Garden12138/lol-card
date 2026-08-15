import { useCallback, useState } from "react";
import { createFight } from "./engine/createFight";
import type { AiDifficulty, FighterId, FightState, VersusKind } from "./engine/types";
import { FIGHT_TITLE } from "./data/copy";
import { MatchScreen } from "./ui/MatchScreen";
import { ResultScreen } from "./ui/ResultScreen";
import { SelectScreen } from "./ui/SelectScreen";
import { VersusScreen } from "./ui/VersusScreen";

type Screen = "select" | "versus" | "match" | "result";

export function FightApp({ onExit }: { onExit: () => void }) {
  const [screen, setScreen] = useState<Screen>("select");
  const [p1, setP1] = useState<FighterId>("Ahri");
  const [p2, setP2] = useState<FighterId>("Garen");
  const [versus, setVersus] = useState<VersusKind>("ai");
  const [difficulty, setDifficulty] = useState<AiDifficulty>("normal");
  const [match, setMatch] = useState<FightState | null>(null);

  const begin = () => {
    setMatch(createFight({ p1, p2, versus, aiDifficulty: difficulty }));
    setScreen("versus");
    window.setTimeout(() => setScreen("match"), 1600);
  };

  const onDone = useCallback((state: FightState) => {
    setMatch(state);
    setScreen("result");
  }, []);

  return (
    <div className="fight-shell">
      {screen === "select" && (
        <SelectScreen
          p1={p1}
          p2={p2}
          versus={versus}
          difficulty={difficulty}
          onP1={setP1}
          onP2={setP2}
          onVersus={setVersus}
          onDifficulty={setDifficulty}
          onStart={begin}
          onExit={onExit}
        />
      )}
      {screen === "versus" && match && <VersusScreen p1={match.fighters[0].id} p2={match.fighters[1].id} />}
      {screen === "match" && match && (
        <MatchScreen key={`${match.fighters[0].id}-${match.fighters[1].id}-${match.versus}`} initial={match} onDone={onDone} onExit={onExit} />
      )}
      {screen === "result" && match && (
        <ResultScreen
          state={match}
          onRematch={begin}
          onSelect={() => setScreen("select")}
          onExit={onExit}
        />
      )}
      {screen === "versus" && <p className="fight-title-ghost">{FIGHT_TITLE}</p>}
    </div>
  );
}
