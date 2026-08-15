import { legalActions } from "../engine/legal";
import type { Action, GameState, PlayerId } from "../engine/types";

export function PromptBar({
  state,
  mySeat,
  onAction,
}: {
  state: GameState;
  mySeat: PlayerId;
  onAction: (action: Action) => void;
}) {
  const options = legalActions(state).filter((action) => {
    if (state.prompt.actor !== mySeat) return false;
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
  return (
    <div className="rift-prompt">
      <p>{state.prompt.message}</p>
      <div className="rift-prompt__actions">
        {skills.slice(0, 6).map((action, index) => (
          <button key={index} type="button" onClick={() => onAction(action)}>
            发动技能
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
