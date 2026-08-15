import { reduce } from "../../src/game/engine/reduce";
import type { GameCard, GameState } from "../../src/game/engine/types";

export function pickAll(state: GameState): GameState {
  let next = state;
  const seats = next.players.length;
  for (let i = 0; i < seats; i += 1) {
    const actor = next.prompt.actor;
    const championId = next.players[actor]!.candidates[0]!;
    next = reduce(next, { type: "pickChampion", player: actor, championId });
  }
  return next;
}

export function card(partial: Partial<GameCard> & Pick<GameCard, "id" | "kind">): GameCard {
  return { suit: "spade", rank: 1, ...partial };
}
