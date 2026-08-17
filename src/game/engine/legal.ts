import { getGameChampion } from "../data/champions";
import { equipmentList, inAttackRange, distance } from "./distance";
import { canUseStrikeThisTurn, cardCanBeStrike, isEquip, isTrick } from "./effects";
import { isEnemy, player } from "./helpers";
import type { Action, GameCard, GameState, PlayerId } from "./types";

function otherAlive(state: GameState, id: PlayerId): PlayerId[] {
  return state.players.filter((item) => item.alive && isEnemy(state, id, item.id)).map((item) => item.id);
}

function targetsForCard(state: GameState, actor: PlayerId, card: GameCard): PlayerId[] {
  const others = otherAlive(state, actor);
  if (card.kind === "strike" || (card.kind === "dodge" && cardCanBeStrike(state, actor, card))) {
    return others.filter((id) => inAttackRange(state, actor, id));
  }
  if (card.kind === "heal") {
    return state.players
      .filter((item) => {
        if (!item.alive || item.hp >= item.maxHp) return false;
        if (state.config.mode === "team") return !isEnemy(state, actor, item.id) || item.id === actor;
        return item.id === actor;
      })
      .map((item) => item.id);
  }
  if (isEquip(card.kind)) return [actor];
  if (card.kind === "supply" || card.kind === "minionWave" || card.kind === "volley") return [actor];
  if (card.kind === "plunder") {
    return others.filter((id) => {
      const t = player(state, id);
      return distance(state, actor, id) <= 1 && (t.hand.length > 0 || equipmentList(state, id).length > 0);
    });
  }
  if (card.kind === "smite" || card.kind === "stun" || card.kind === "duel") {
    return others.filter((id) => {
      if (card.kind === "smite") {
        return player(state, id).hand.length > 0 || equipmentList(state, id).length > 0;
      }
      return true;
    });
  }
  return [];
}

export function legalActions(state: GameState): Action[] {
  if (state.phase === "gameOver") return [];
  if (state.phase === "pick" && state.prompt.kind === "pickChampion") {
    const seat = state.players[state.prompt.actor]!;
    return seat.candidates.map((championId) => ({
      type: "pickChampion" as const,
      player: seat.id,
      championId,
    }));
  }
  const actor = state.prompt.actor;
  const seat = player(state, actor);
  const actions: Action[] = [];

  if (state.prompt.kind === "playCard") {
    for (const card of seat.hand) {
      if (card.kind === "strike" || (card.kind === "dodge" && cardCanBeStrike(state, actor, card))) {
        if (!canUseStrikeThisTurn(state, actor)) continue;
      }
      if (card.kind === "barrier") continue;
      if (isTrick(card.kind) || card.kind === "strike" || card.kind === "heal" || isEquip(card.kind) || card.kind === "dodge") {
        const targets = targetsForCard(state, actor, card);
        if (targets.length === 0) continue;
        for (const targetId of targets) {
          if (
            card.kind === "supply" ||
            card.kind === "minionWave" ||
            card.kind === "volley" ||
            isEquip(card.kind)
          ) {
            actions.push({ type: "playCard", player: actor, cardId: card.id });
            break;
          }
          actions.push({ type: "playCard", player: actor, cardId: card.id, targetId });
        }
      }
    }
    const def = getGameChampion(seat.championId);
    if (def && !seat.skillUsedThisTurn) {
      if (def.skillId === "ahri-charm") {
        for (const card of seat.hand) {
          for (const targetId of otherAlive(state, actor).filter((id) => inAttackRange(state, actor, id))) {
            if (!canUseStrikeThisTurn(state, actor)) continue;
            actions.push({ type: "useSkill", player: actor, targetId, cardId: card.id });
          }
        }
      }
      if (def.skillId === "thresh-death-sentence") {
        for (const targetId of otherAlive(state, actor)) {
          if (equipmentList(state, targetId).length > 0) {
            actions.push({ type: "useSkill", player: actor, targetId });
          }
        }
      }
      if (def.skillId === "lux-final-spark" || def.skillId === "template-mage") {
        for (const card of seat.hand) {
          for (const targetId of otherAlive(state, actor).filter((id) => inAttackRange(state, actor, id))) {
            actions.push({ type: "useSkill", player: actor, targetId, cardId: card.id });
          }
        }
      }
      if ((def.skillId === "zed-death-mark" || def.skillId === "template-assassin") && !seat.limitedUsed) {
        actions.push({ type: "useSkill", player: actor });
      }
      if (def.skillId === "leona-solar-flare") {
        for (const targetId of otherAlive(state, actor).filter((id) => inAttackRange(state, actor, id))) {
          actions.push({ type: "useSkill", player: actor, targetId });
        }
      }
      if (def.skillId === "soraka-astral-infusion" || def.skillId === "template-support") {
        for (const card of seat.hand) {
          for (const target of state.players) {
            if (target.alive && target.hp < target.maxHp) {
              actions.push({ type: "useSkill", player: actor, targetId: target.id, cardId: card.id });
            }
          }
        }
      }
    }
    actions.push({ type: "endPlay", player: actor });
    return actions;
  }

  if (state.prompt.kind === "discardToHp") {
    const need = seat.hand.length - seat.hp;
    if (need <= 0) return [{ type: "discard", player: actor, cardIds: [] }];
    const ids = seat.hand.map((card) => card.id);
    const pick = ids.slice(0, need);
    actions.push({ type: "discard", player: actor, cardIds: pick });
    if (ids.length > need) {
      actions.push({ type: "discard", player: actor, cardIds: ids.slice(-need) });
    }
    const ranked = [...seat.hand].sort((a, b) => discardKeepScore(a) - discardKeepScore(b));
    const preferred = ranked.slice(0, need).map((card) => card.id);
    if (!actions.some((action) => action.type === "discard" && JSON.stringify(action.cardIds) === JSON.stringify(preferred))) {
      actions.push({ type: "discard", player: actor, cardIds: preferred });
    }
    return actions;
  }

  const respondKinds = new Set([
    "respondDodge",
    "respondBarrier",
    "respondDuelStrike",
    "respondLux",
    "respondMinionWave",
    "respondVolley",
    "dyingHeal",
    "chooseCardInArea",
  ]);
  if (respondKinds.has(state.prompt.kind)) {
    for (const cardId of state.prompt.legalCardIds) {
      actions.push({ type: "respond", player: actor, cardId });
    }
    if (state.prompt.canCancel) {
      actions.push({ type: "respond", player: actor });
    }
  }
  return actions;
}

function discardKeepScore(card: GameCard): number {
  if (card.kind === "heal" || card.kind === "dodge") return 3;
  if (card.kind === "strike") return 2;
  if (isEquip(card.kind)) return 1;
  return 0;
}
