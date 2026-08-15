import { applyPick } from "./createMatch";
import { distance } from "./distance";
import {
  canUseStrikeThisTurn,
  cardCanBeStrike,
  chooseAreaCard,
  discardFromHand,
  enterDiscard,
  handleLuxRespond,
  installEquip,
  isEquip,
  isTrick,
  markStrikeUsed,
  recover,
  respondAoe,
  respondBarrier,
  respondDuel,
  respondDodge,
  respondHeal,
  startStrike,
  startTrick,
  takeCardFromHand,
} from "./effects";
import { cloneState, player } from "./helpers";
import { useSkill } from "./skills";
import type { Action, GameState } from "./types";
import { legalActions } from "./legal";

function isLegal(state: GameState, action: Action): boolean {
  return legalActions(state).some((item) => JSON.stringify(item) === JSON.stringify(action));
}

export function reduce(state: GameState, action: Action): GameState {
  if (state.phase === "gameOver") return state;
  const next = cloneState(state);
  if (action.type === "pickChampion") {
    return applyPick(next, action.player, action.championId);
  }
  if (!isLegal(next, action)) return state;

  if (action.type === "endPlay") {
    return enterDiscard(next);
  }
  if (action.type === "discard") {
    if (next.prompt.kind !== "discardToHp" || next.prompt.actor !== action.player) return state;
    const seat = player(next, action.player);
    const need = seat.hand.length - seat.hp;
    if (action.cardIds.length !== need) return state;
    for (const cardId of action.cardIds) {
      if (!discardFromHand(next, action.player, cardId)) return state;
    }
    return enterDiscard(next);
  }
  if (action.type === "useSkill") {
    return useSkill(next, action.player, action.targetId, action.cardId);
  }
  if (action.type === "respond") {
    switch (next.prompt.kind) {
      case "respondDodge":
        return respondDodge(next, action.player, action.cardId);
      case "respondBarrier":
        return respondBarrier(next, action.player, action.cardId);
      case "respondDuelStrike":
        return respondDuel(next, action.player, action.cardId);
      case "respondMinionWave":
      case "respondVolley":
        return respondAoe(next, action.player, action.cardId);
      case "dyingHeal":
        return respondHeal(next, action.player, action.cardId);
      case "respondLux":
        return handleLuxRespond(next, action.player, action.cardId);
      case "chooseCardInArea":
        return chooseAreaCard(next, action.player, action.cardId);
      default:
        return state;
    }
  }
  if (action.type === "playCard") {
    const seat = player(next, action.player);
    const card = seat.hand.find((item) => item.id === action.cardId);
    if (!card) return state;
    if (card.kind === "heal") {
      takeCardFromHand(seat, card.id);
      next.discard.push(card);
      const target = action.targetId ?? action.player;
      recover(next, target, 1);
      return next;
    }
    if (isEquip(card.kind)) {
      takeCardFromHand(seat, card.id);
      installEquip(next, action.player, card);
      return next;
    }
    if (cardCanBeStrike(next, action.player, card) && (card.kind === "strike" || card.kind === "dodge")) {
      if (!canUseStrikeThisTurn(next, action.player) || action.targetId === undefined) return state;
      takeCardFromHand(seat, card.id);
      next.discard.push(card);
      markStrikeUsed(next, action.player);
      return startStrike(next, action.player, action.targetId, card, 1, false);
    }
    if (isTrick(card.kind)) {
      if (card.kind === "plunder" && action.targetId !== undefined) {
        if (distance(next, action.player, action.targetId) > 1) return state;
      }
      takeCardFromHand(seat, card.id);
      if (card.kind !== "stun") next.discard.push(card);
      return startTrick(next, action.player, card, action.targetId);
    }
  }
  return state;
}

export { legalActions };
