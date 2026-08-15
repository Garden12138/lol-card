import { getGameChampion } from "../data/champions";
import { legalActions } from "../engine/legal";
import { isEnemy, player } from "../engine/helpers";
import type { Action, GameState, PlayerId } from "../engine/types";

function enemies(state: GameState, me: PlayerId): PlayerId[] {
  if (state.config.mode !== "identity") {
    return state.players.filter((item) => isEnemy(state, me, item.id)).map((item) => item.id);
  }
  const mine = player(state, me);
  const baron = state.players.find((item) => item.identity === "baron")!;
  if (mine.identity === "invader" || mine.identity === "shadow") {
    return baron.alive && baron.id !== me
      ? [baron.id]
      : state.players.filter((item) => item.alive && item.id !== me).map((item) => item.id);
  }
  return state.players
    .filter((item) => item.alive && item.id !== me && item.identity !== "baron")
    .map((item) => item.id);
}

function pick<T>(items: T[], fallback: T): T {
  return items[0] ?? fallback;
}

export function chooseAiAction(state: GameState): Action {
  const options = legalActions(state);
  if (options.length === 0) {
    return { type: "endPlay", player: state.prompt.actor };
  }
  const actor = state.prompt.actor;
  const seat = player(state, actor);
  const kind = state.prompt.kind;

  if (kind === "pickChampion") {
    return options[0]!;
  }

  if (kind === "dyingHeal") {
    const heal = options.find((action) => action.type === "respond" && action.cardId);
    return heal ?? options[0]!;
  }

  if (
    kind === "respondDodge" ||
    kind === "respondDuelStrike" ||
    kind === "respondMinionWave" ||
    kind === "respondVolley"
  ) {
    const play = options.find((action) => action.type === "respond" && action.cardId);
    if (seat.hp <= 1 && play) return play;
    if (play && seat.hp <= 2) return play;
    return options.find((action) => action.type === "respond" && !action.cardId) ?? options[0]!;
  }

  if (kind === "respondBarrier") {
    const play = options.find((action) => action.type === "respond" && action.cardId);
    if (play && seat.hp <= 2) return play;
    return options.find((action) => action.type === "respond" && !action.cardId) ?? options[0]!;
  }

  if (kind === "respondLux" || kind === "chooseCardInArea" || kind === "discardToHp") {
    return options[0]!;
  }

  if (kind === "playCard") {
    const heals = options.filter(
      (action) =>
        action.type === "playCard" &&
        seat.hand.find((card) => card.id === action.cardId)?.kind === "heal" &&
        (action.targetId === actor || action.targetId === undefined),
    );
    if (seat.hp === 1 && heals[0]) return heals[0];

    const foe = enemies(state, actor);
    const def = getGameChampion(seat.championId);
    const skill = options.find((action) => {
      if (action.type !== "useSkill") return false;
      if (!action.targetId) {
        return def?.skillId === "zed-death-mark" || def?.skillId === "template-assassin";
      }
      return (
        foe.includes(action.targetId) &&
        (def?.skillId === "leona-solar-flare" ||
          def?.skillId === "ahri-charm" ||
          def?.skillId === "darius-noxian-might" ||
          def?.skillId === "template-fighter" ||
          def?.skillId === "template-mage")
      );
    });
    if (skill) return skill;

    const strike = options.find((action) => {
      if (action.type !== "playCard" || action.targetId === undefined) return false;
      const card = seat.hand.find((item) => item.id === action.cardId);
      return (card?.kind === "strike" || card?.kind === "dodge") && foe.includes(action.targetId);
    });
    if (strike) return strike;

    const trick = options.find((action) => {
      if (action.type !== "playCard") return false;
      const card = seat.hand.find((item) => item.id === action.cardId);
      if (card?.kind === "supply") return seat.hand.length <= 3;
      return card?.kind === "minionWave" || card?.kind === "volley";
    });
    if (trick) return trick;

    const end = options.find((action) => action.type === "endPlay");
    if (end) return end;
  }

  return pick(options, options[0]!);
}
