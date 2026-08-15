import { useEffect, useState } from "react";
import { chooseAiAction } from "./ai/chooseAction";
import { createDuel } from "./engine/createDuel";
import { reduce } from "./engine/reduce";
import type { Action, DuelState } from "./engine/types";
import { DuelScreen } from "./ui/DuelScreen";
import { LobbyScreen } from "./ui/LobbyScreen";
import { ResultScreen } from "./ui/ResultScreen";

type Screen = "lobby" | "duel" | "result";

export function YgoApp({ onExit }: { onExit: () => void }) {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [deckId, setDeckId] = useState("piltover");
  const [state, setState] = useState<DuelState | null>(null);

  const begin = () => {
    const next = createDuel({
      seed: Date.now() % 1_000_000,
      p0DeckId: deckId,
      p1DeckId: deckId === "piltover" ? "shadow" : "piltover",
      p0Controller: "human",
      p1Controller: "ai",
    });
    setState(next);
    setScreen("duel");
  };

  useEffect(() => {
    if (!state || state.phase === "gameOver") return;
    if (state.players[state.prompt.actor]?.controller !== "ai") return;
    const frame = window.requestAnimationFrame(() => {
      setState((current) => {
        if (!current || current.phase === "gameOver") return current;
        if (current.players[current.prompt.actor]?.controller !== "ai") return current;
        return reduce(current, chooseAiAction(current));
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state]);

  const onAct = (action: Action) => {
    setState((current) => (current ? reduce(current, action) : current));
  };

  if (screen === "lobby" || !state) {
    return <LobbyScreen deckId={deckId} onDeck={setDeckId} onStart={begin} onExit={onExit} />;
  }

  if (state.phase === "gameOver" || screen === "result") {
    return (
      <ResultScreen
        state={state}
        onRematch={begin}
        onLobby={() => {
          setState(null);
          setScreen("lobby");
        }}
        onExit={onExit}
      />
    );
  }

  return <DuelScreen state={state} onAct={onAct} onExit={onExit} />;
}
