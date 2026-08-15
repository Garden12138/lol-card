import { useEffect, useState } from "react";
import { GAME_TITLE } from "../data/copy";
import { chooseAiAction } from "../ai/chooseAction";
import { createMatch } from "../engine/createMatch";
import { legalActions, reduce } from "../engine/reduce";
import type { Action, GameCard, GameState, PlayerId } from "../engine/types";
import { CastOverlay } from "./CastOverlay";
import { PickScreen } from "./PickScreen";
import { ResultScreen } from "./ResultScreen";
import { TableScreen } from "./TableScreen";

export function GameApp({
  onExit,
  initialState,
}: {
  onExit: () => void;
  initialState?: GameState;
}) {
  const [state, setState] = useState<GameState>(() => initialState ?? createMatch(Date.now() >>> 0));
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<{ championId?: string; card?: GameCard } | null>(null);

  useEffect(() => {
    if (state.phase === "gameOver") return;
    if (state.prompt.actor === 0) return;
    const frame = window.requestAnimationFrame(() => {
      setState((current) => {
        if (current.prompt.actor === 0 || current.phase === "gameOver") return current;
        return reduce(current, chooseAiAction(current));
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state]);

  const dispatch = (action: Action) => {
    setPendingCardId(null);
    setState((current) => reduce(current, action));
  };

  const playCard = (card: GameCard) => {
    if (state.prompt.actor !== 0) return;
    if (state.prompt.kind !== "playCard") {
      setOverlay({ card });
      dispatch({ type: "respond", player: 0, cardId: card.id });
      return;
    }
    const matches = legalActions(state).filter(
      (action) => action.type === "playCard" && action.cardId === card.id,
    );
    if (matches.length === 1) {
      setOverlay({ card });
      dispatch(matches[0]!);
      return;
    }
    if (matches.length > 1) {
      setPendingCardId(card.id);
    }
  };

  const selectSeat = (id: PlayerId) => {
    setOverlay({ championId: state.players[id]!.championId || undefined });
    if (!pendingCardId) return;
    const match = legalActions(state).find(
      (action) =>
        action.type === "playCard" && action.cardId === pendingCardId && action.targetId === id,
    );
    if (match) dispatch(match);
  };

  return (
    <div className="rift-shell">
      <header className="rift-header">
        <strong>{GAME_TITLE}</strong>
        <button type="button" onClick={onExit}>
          返回鉴赏馆
        </button>
      </header>
      {state.phase === "pick" && <PickScreen state={state} onPick={dispatch} />}
      {state.phase !== "pick" && state.phase !== "gameOver" && (
        <TableScreen
          state={state}
          selectedTarget={null}
          onPlayCard={playCard}
          onAction={dispatch}
          onSelectSeat={selectSeat}
        />
      )}
      {state.phase === "gameOver" && (
        <ResultScreen state={state} onReplay={() => setState(createMatch(Date.now() >>> 0))} />
      )}
      {overlay && (
        <CastOverlay
          championId={overlay.championId}
          card={overlay.card}
          onClose={() => setOverlay(null)}
        />
      )}
      <p className="rift-disclaimer">
        峡谷身份战是非官方粉丝作品，规则受经典身份卡牌启发，未获得 Riot Games
        或任何卡牌厂商授权。单机本地对局，不支持联机。
      </p>
    </div>
  );
}
