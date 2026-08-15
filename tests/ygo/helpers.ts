import { createDuel } from "../../src/ygo/engine/createDuel";
import { reduce } from "../../src/ygo/engine/reduce";
import { legalActions } from "../../src/ygo/engine/legal";
import type { Action, DuelState } from "../../src/ygo/engine/types";

export function duel(p0 = "demacia", p1 = "shadow"): DuelState {
  return createDuel({
    seed: 1,
    p0DeckId: p0,
    p1DeckId: p1,
    shuffle: false,
    p0Controller: "human",
    p1Controller: "human",
  });
}

export function act(state: DuelState, action: Action): DuelState {
  return reduce(state, action);
}

export function must(state: DuelState, pred: (action: Action) => boolean): Action {
  const action = legalActions(state).find(pred);
  if (!action) throw new Error("missing legal action");
  return action;
}

export function passBoth(state: DuelState): DuelState {
  let next = state;
  if (legalActions(next).some((action) => action.type === "respondPass")) {
    next = reduce(next, { type: "respondPass" });
  }
  if (legalActions(next).some((action) => action.type === "respondPass")) {
    next = reduce(next, { type: "respondPass" });
  }
  return next;
}

export function moveToHand(state: DuelState, player: 0 | 1, defId: string): DuelState {
  const next = structuredClone(state);
  const owner = next.players[player];
  const card = owner.deck.find((item) => item.defId === defId);
  if (!card) throw new Error(`no ${defId} in deck`);
  owner.deck = owner.deck.filter((item) => item.uid !== card.uid);
  owner.hand.push(card);
  return next;
}
