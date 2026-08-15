import { legalActions } from "../engine/legal";
import type { Action, DuelState } from "../engine/types";

function score(action: Action): number {
  if (action.type === "activate" && action.fusionId) return 100;
  if (action.type === "attack" && action.targetUid === "direct") return 80;
  if (action.type === "attack") return 60;
  if (action.type === "activate") return 50;
  if (action.type === "normalSummon") return 40;
  if (action.type === "setSpellTrap") return 20;
  if (action.type === "setMonster") return 15;
  if (action.type === "changePosition") return 10;
  if (action.type === "nextPhase") return 1;
  if (action.type === "respondPass") return 2;
  return 0;
}

export function chooseAiAction(state: DuelState): Action {
  const actions = legalActions(state);
  if (actions.length === 0) throw new Error("AI has no legal actions");
  return actions.reduce((best, action) => (score(action) > score(best) ? action : best));
}
