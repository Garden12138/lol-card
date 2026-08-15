import type { Action, DuelState } from "../engine/types";
import { CardView } from "./CardView";

export function HandDock({
  state,
  actions,
  onAct,
}: {
  state: DuelState;
  actions: Action[];
  onAct: (action: Action) => void;
}) {
  const human = state.players[0].controller === "human" ? 0 : 1;
  const player = state.players[human];
  return (
    <div className="ygo-hand">
      {player.hand.map((card) => (
        <CardView
          key={card.uid}
          card={card}
          state={state}
          onClick={() => {
            const summon = actions.find((action) => action.type === "normalSummon" && action.uid === card.uid);
            const setM = actions.find((action) => action.type === "setMonster" && action.uid === card.uid);
            const setS = actions.find((action) => action.type === "setSpellTrap" && action.uid === card.uid);
            const activate = actions.find((action) => action.type === "activate" && action.uid === card.uid);
            if (activate) onAct(activate);
            else if (summon) onAct(summon);
            else if (setS) onAct(setS);
            else if (setM) onAct(setM);
          }}
        />
      ))}
    </div>
  );
}
