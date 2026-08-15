import { getChampionById } from "../../data/champions";
import { getGameChampion } from "../data/champions";
import { legalActions } from "../engine/legal";
import type { Action, GameState, PlayerId } from "../engine/types";

export function PromptBar({
  state,
  mySeat,
  pendingCardId,
  onAction,
}: {
  state: GameState;
  mySeat: PlayerId;
  pendingCardId: string | null;
  onAction: (action: Action) => void;
}) {
  const mine = state.prompt.actor === mySeat;
  const actor = state.players[state.prompt.actor]!;
  const actorName = getChampionById(actor.championId)?.name ?? `座位 ${actor.id}`;
  const options = legalActions(state).filter((action) => {
    if (!mine) return false;
    return (
      action.type === "endPlay" ||
      action.type === "respond" ||
      action.type === "useSkill" ||
      action.type === "discard"
    );
  });
  const cancel = options.find((action) => action.type === "respond" && !action.cardId);
  const endPlay = options.find((action) => action.type === "endPlay");
  const skills = options.filter((action) => action.type === "useSkill");
  const discard = options.find((action) => action.type === "discard");
  const def = getGameChampion(state.players[mySeat]!.championId);
  const message = !mine
    ? `等待 ${actorName}…`
    : pendingCardId
      ? "请选择目标"
      : state.prompt.message;
  return (
    <div className="rift-prompt">
      <p>{message}</p>
      <div className="rift-prompt__actions">
        {skills.slice(0, 6).map((action, index) => (
          <button key={index} type="button" onClick={() => onAction(action)}>
            {def?.skillName ?? "发动技能"}
          </button>
        ))}
        {discard && (
          <button type="button" onClick={() => onAction(discard)}>
            弃牌
          </button>
        )}
        {cancel && (
          <button type="button" onClick={() => onAction(cancel)}>
            取消
          </button>
        )}
        {endPlay && (
          <button type="button" onClick={() => onAction(endPlay)}>
            结束出牌
          </button>
        )}
      </div>
    </div>
  );
}
