import { getCardDef } from "../data/cards";
import { declareAttack } from "./battle";
import { openRespondAfterAttack, passResponse, pushChain } from "./chain";
import { cloneState, findOnField, log, other, removeFromHand } from "./helpers";
import { applySummon } from "./summon";
import { applySynchro } from "./synchro";
import { applyWinCheck, loseByDeckout } from "./win";
import { legalActions } from "./legal";
import type { Action, DuelState } from "./types";

export { legalActions } from "./legal";

function endTurn(state: DuelState): void {
  for (const player of state.players) {
    for (const card of player.monsters) {
      if (!card) continue;
      card.summonedThisTurn = false;
      card.attackedThisTurn = false;
      card.changedThisTurn = false;
      card.protectedUntilEnd = false;
    }
  }
  const next = other(state.turnPlayer);
  state.turnPlayer = next;
  state.turn += 1;
  state.normalSummonUsed = false;
  state.attack = null;
  state.battleStep = null;
  state.phase = "draw";
  const drawer = state.players[next];
  const drawn = drawer.deck.shift();
  if (!drawn) {
    loseByDeckout(state, next);
    return;
  }
  drawer.hand.push(drawn);
  log(state, `${next === 0 ? "先攻" : "后攻"} 抽卡`);
  state.phase = "main1";
  state.prompt = { kind: "free", actor: next };
}

function nextPhase(state: DuelState): void {
  if (state.phase === "main1") {
    state.phase = "battle";
    state.battleStep = "start";
    log(state, "进入战斗阶段");
    return;
  }
  if (state.phase === "battle") {
    state.phase = "main2";
    state.battleStep = null;
    state.attack = null;
    log(state, "进入主要阶段 2");
    return;
  }
  if (state.phase === "main2") {
    endTurn(state);
  }
}

export function reduce(state: DuelState, action: Action): DuelState {
  const next = cloneState(state);
  if (next.winner !== null || next.phase === "gameOver") return next;
  const legal = legalActions(state);
  if (!legal.some((item) => JSON.stringify(item) === JSON.stringify(action))) return next;

  switch (action.type) {
    case "normalSummon":
    case "setMonster":
      applySummon(next, action);
      break;
    case "changePosition": {
      const located = findOnField(next, action.uid);
      if (located?.zone === "monster") {
        const card = located.card;
        if (card.face === "down") {
          card.face = "up";
          card.position = "atk";
          log(next, `反转召唤 ${getCardDef(card.defId).name}`);
        } else {
          card.position = card.position === "atk" ? "def" : "atk";
          log(next, "变更表示形式");
        }
        card.changedThisTurn = true;
      }
      break;
    }
    case "setSpellTrap": {
      const player = next.players[next.prompt.actor];
      const card = removeFromHand(player, action.uid);
      if (card) {
        card.face = "down";
        player.spells[action.zone] = card;
        log(next, `盖放 ${getCardDef(card.defId).name}`);
      }
      break;
    }
    case "activate":
      pushChain(next, action);
      break;
    case "attack":
      if (declareAttack(next, action.attackerUid, action.targetUid)) {
        openRespondAfterAttack(next);
      }
      break;
    case "synchroSummon":
      applySynchro(next, action);
      break;
    case "respondPass":
      passResponse(next);
      break;
    case "nextPhase":
      nextPhase(next);
      break;
    default:
      break;
  }

  applyWinCheck(next);
  return next;
}
