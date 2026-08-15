import { getFighterDef } from "../data/roster";
import type { FightState } from "../engine/types";

export function ResultScreen({
  state,
  onRematch,
  onSelect,
  onExit,
}: {
  state: FightState;
  onRematch: () => void;
  onSelect: () => void;
  onExit: () => void;
}) {
  const winner = state.wins[0] >= state.wins[1] ? state.fighters[0] : state.fighters[1];
  const def = getFighterDef(winner.id);
  return (
    <div className="fight-result">
      <p>胜者</p>
      <h1>{def.name}</h1>
      <p>
        {state.wins[0]} - {state.wins[1]}
      </p>
      <div className="fight-result__actions">
        <button type="button" onClick={onRematch}>
          再来一局
        </button>
        <button type="button" onClick={onSelect}>
          重新选人
        </button>
        <button type="button" onClick={onExit}>
          返回鉴赏馆
        </button>
      </div>
    </div>
  );
}
