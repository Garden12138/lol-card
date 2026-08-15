import { getGameChampion } from "../data/champions";
import { CARD_NAMES } from "../data/copy";
import { equipmentList, inAttackRange } from "./distance";
import {
  discardFromHand,
  markStrikeUsed,
  playPhasePrompt,
  recover,
  startDying,
  startStrike,
} from "./effects";
import { log, player } from "./helpers";
import type { GameState, PlayerId } from "./types";

export function useSkill(
  state: GameState,
  playerId: PlayerId,
  targetId?: PlayerId,
  cardId?: string,
): GameState {
  if (state.phase !== "play" || state.currentPlayer !== playerId || state.prompt.kind !== "playCard") {
    return state;
  }
  const seat = player(state, playerId);
  const def = getGameChampion(seat.championId);
  if (!def || seat.skillUsedThisTurn) return state;
  switch (def.skillId) {
    case "ahri-charm": {
      if (targetId === undefined || !inAttackRange(state, playerId, targetId) || !cardId) return state;
      const discarded = discardFromHand(state, playerId, cardId);
      if (!discarded) return state;
      seat.skillUsedThisTurn = true;
      markStrikeUsed(state, playerId);
      log(state, `${seat.championId} 发动魅惑。`);
      return startStrike(state, playerId, targetId, undefined, 2, true);
    }
    case "thresh-death-sentence": {
      if (targetId === undefined || targetId === playerId) return state;
      const eq = equipmentList(state, targetId);
      if (eq.length === 0) return state;
      state.pending = { type: "equipOrHand", source: playerId, target: targetId, take: true };
      state.prompt = {
        kind: "chooseCardInArea",
        actor: playerId,
        source: targetId,
        legalCardIds: eq.map((card) => card.id),
        legalTargetIds: [],
        canCancel: false,
        message: "选择一张装备收入手牌",
      };
      seat.skillUsedThisTurn = true;
      return state;
    }
    case "lux-final-spark":
    case "template-mage": {
      if (targetId === undefined || !cardId || !inAttackRange(state, playerId, targetId)) return state;
      const shown = player(state, playerId).hand.find((card) => card.id === cardId);
      if (!shown) return state;
      seat.skillUsedThisTurn = true;
      log(state, `${seat.championId} 展示 ${CARD_NAMES[shown.kind]}，发动终极闪光。`);
      const matches = player(state, targetId).hand.filter((card) => card.suit === shown.suit);
      state.pending = { type: "luxDiscard", source: playerId, target: targetId, suit: shown.suit };
      state.prompt = {
        kind: "respondLux",
        actor: targetId,
        source: playerId,
        revealedSuit: shown.suit,
        legalCardIds: matches.map((card) => card.id),
        legalTargetIds: [],
        canCancel: true,
        message: "弃置一张同花色牌，否则受到 1 点伤害",
      };
      return state;
    }
    case "zed-death-mark":
    case "template-assassin": {
      if (seat.limitedUsed) return state;
      seat.hp -= 1;
      seat.damagedThisTurn = true;
      seat.limitedUsed = true;
      seat.skillUsedThisTurn = true;
      seat.unlimitedStrikeThisTurn = true;
      log(state, `${seat.championId} 发动禁奥义。`);
      if (seat.hp <= 0) startDying(state, playerId, playerId);
      else playPhasePrompt(state);
      return state;
    }
    case "leona-solar-flare": {
      if (targetId === undefined || !inAttackRange(state, playerId, targetId)) return state;
      player(state, targetId).cannotDodgeUntilTurnEnd = true;
      seat.skillUsedThisTurn = true;
      log(state, `${seat.championId} 对 ${player(state, targetId).championId} 发动日炎耀斑。`);
      return state;
    }
    case "soraka-astral-infusion":
    case "template-support": {
      if (targetId === undefined || !cardId) return state;
      const target = player(state, targetId);
      if (!target.alive || target.hp >= target.maxHp) return state;
      const discarded = discardFromHand(state, playerId, cardId);
      if (!discarded) return state;
      recover(state, targetId, 1);
      seat.skillUsedThisTurn = true;
      log(state, `${seat.championId} 发动星体恩典。`);
      return state;
    }
    default:
      return state;
  }
}
