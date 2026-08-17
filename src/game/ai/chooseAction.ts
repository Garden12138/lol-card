import { getGameChampion } from "../data/champions";
import { equipSlot, isEquip, isTrick } from "../engine/effects";
import { legalActions } from "../engine/legal";
import { isAlly, isEnemy, player } from "../engine/helpers";
import type { Action, GameCard, GameState, PlayerId } from "../engine/types";

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

function handCard(state: GameState, actor: PlayerId, cardId?: string): GameCard | undefined {
  if (!cardId) return undefined;
  return player(state, actor).hand.find((card) => card.id === cardId);
}

function keepScore(card: GameCard): number {
  if (card.kind === "heal" || card.kind === "dodge") return 3;
  if (card.kind === "strike") return 2;
  if (isEquip(card.kind)) return 1;
  return 0;
}

function pickChampion(state: GameState, options: Action[]): Action {
  const ranked = options.filter((action) => action.type === "pickChampion");
  const best = ranked.find((action) => {
    if (action.type !== "pickChampion") return false;
    const def = getGameChampion(action.championId);
    return def && (def.maxHp === 4 || !def.skillId.startsWith("template-"));
  });
  return best ?? options[0]!;
}

export function chooseAiAction(state: GameState): Action {
  const options = legalActions(state);
  if (options.length === 0) {
    return { type: "endPlay", player: state.prompt.actor };
  }
  const actor = state.prompt.actor;
  const seat = player(state, actor);
  const kind = state.prompt.kind;

  if (kind === "pickChampion") return pickChampion(state, options);

  if (kind === "dyingHeal") {
    const victim = state.prompt.source;
    const heal = options.find((action) => action.type === "respond" && action.cardId);
    if (victim !== undefined && heal && isAlly(state, actor, victim)) return heal;
    return options.find((action) => action.type === "respond" && !action.cardId) ?? options[0]!;
  }

  if (
    kind === "respondDodge" ||
    kind === "respondDuelStrike" ||
    kind === "respondMinionWave" ||
    kind === "respondVolley"
  ) {
    const play = options.find((action) => action.type === "respond" && action.cardId);
    const dodges = seat.hand.filter((card) => card.kind === "dodge").length;
    if (play && (seat.hp <= 2 || dodges >= 2)) return play;
    return options.find((action) => action.type === "respond" && !action.cardId) ?? options[0]!;
  }

  if (kind === "respondBarrier") {
    const play = options.find((action) => action.type === "respond" && action.cardId);
    if (play && seat.hp <= 2) return play;
    return options.find((action) => action.type === "respond" && !action.cardId) ?? options[0]!;
  }

  if (kind === "discardToHp") {
    const discards = options.filter((action) => action.type === "discard");
    const best = discards.sort((a, b) => {
      if (a.type !== "discard" || b.type !== "discard") return 0;
      const score = (ids: string[]) =>
        ids.reduce((sum, id) => sum + keepScore(seat.hand.find((card) => card.id === id) ?? { id, kind: "strike", suit: "spade", rank: 1 }), 0);
      return score(a.cardIds) - score(b.cardIds);
    })[0];
    return best ?? options[0]!;
  }

  if (kind === "respondLux" || kind === "chooseCardInArea") {
    return options[0]!;
  }

  if (kind === "playCard") {
    const foe = enemies(state, actor);
    const def = getGameChampion(seat.championId);

    const equip = options.find((action) => {
      if (action.type !== "playCard") return false;
      const card = handCard(state, actor, action.cardId);
      if (!card || !isEquip(card.kind)) return false;
      const slot = equipSlot(card.kind);
      return slot !== undefined && !seat.equipment[slot];
    });
    if (equip) return equip;

    const heal = options.find((action) => {
      if (action.type !== "playCard") return false;
      const card = handCard(state, actor, action.cardId);
      if (card?.kind !== "heal") return false;
      const target = action.targetId ?? actor;
      const dest = player(state, target);
      if (dest.hp >= dest.maxHp) return false;
      if (target === actor) return seat.hp <= 2;
      return state.config.mode === "team" && isAlly(state, actor, target) && dest.hp <= 2;
    });
    if (heal) return heal;

    const trickKinds = new Set(["stun", "duel", "plunder", "smite"]);
    const trick = options.find((action) => {
      if (action.type !== "playCard" || action.targetId === undefined) return false;
      const card = handCard(state, actor, action.cardId);
      return card !== undefined && trickKinds.has(card.kind) && foe.includes(action.targetId);
    });
    if (trick) return trick;

    const skillIds = new Set([
      "zed-death-mark",
      "template-assassin",
      "leona-solar-flare",
      "ahri-charm",
      "lux-final-spark",
      "template-mage",
      "thresh-death-sentence",
      "soraka-astral-infusion",
      "template-support",
    ]);
    const skill = options.find((action) => {
      if (action.type !== "useSkill" || !def || !skillIds.has(def.skillId)) return false;
      if (!action.targetId) return def.skillId === "zed-death-mark" || def.skillId === "template-assassin";
      if (def.skillId === "soraka-astral-infusion" || def.skillId === "template-support") {
        return isAlly(state, actor, action.targetId) || action.targetId === actor;
      }
      return foe.includes(action.targetId);
    });
    if (skill) return skill;

    const strikes = options
      .filter((action) => {
        if (action.type !== "playCard" || action.targetId === undefined) return false;
        const card = handCard(state, actor, action.cardId);
        if (card?.kind !== "strike" && card?.kind !== "dodge") return false;
        if (!foe.includes(action.targetId)) return false;
        const target = player(state, action.targetId);
        if (seat.identity === "baron" && state.config.mode === "identity" && target.hp <= 1 && target.identity !== "baron") {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.type !== "playCard" || b.type !== "playCard") return 0;
        return player(state, a.targetId!).hp - player(state, b.targetId!).hp;
      });
    if (strikes[0]) return strikes[0];

    const filler = options.find((action) => {
      if (action.type !== "playCard") return false;
      const card = handCard(state, actor, action.cardId);
      if (card?.kind === "supply") return seat.hand.length <= 3;
      return card?.kind === "minionWave" || card?.kind === "volley" || (card !== undefined && isTrick(card.kind));
    });
    if (filler) return filler;

    const end = options.find((action) => action.type === "endPlay");
    if (end) return end;
  }

  return options[0]!;
}
