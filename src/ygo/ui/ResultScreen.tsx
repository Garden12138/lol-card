import { YGO_TITLE } from "../data/copy";
import { getDeck } from "../data/decks";
import type { DuelState } from "../engine/types";

export function ResultScreen({
  state,
  onRematch,
  onLobby,
  onExit,
}: {
  state: DuelState;
  onRematch: () => void;
  onLobby: () => void;
  onExit: () => void;
}) {
  const won = state.winner === 0;
  return (
    <div className="ygo-result">
      <h1>{won ? "胜利" : "落败"}</h1>
      <p>
        {YGO_TITLE} · {getDeck(state.players[0].deckId).name}
        {state.winReason === "deckout" ? " · 卡组抽空" : " · 生命归零"}
      </p>
      <div className="ygo-result__actions">
        <button type="button" onClick={onRematch}>
          再来一局
        </button>
        <button type="button" onClick={onLobby}>
          更换卡组
        </button>
        <button type="button" onClick={onExit}>
          返回鉴赏馆
        </button>
      </div>
    </div>
  );
}
