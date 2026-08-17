import { getCardDef } from "../data/cards";
import {
  emptyZones,
  findOnField,
  isExtraMonster,
  log,
  occupiedMonsters,
  removeFromHand,
  sendToGy,
  tributeRequired,
} from "./helpers";
import type { Action, CardInstance, DuelState, PlayerId } from "./types";

export function placeMonster(
  state: DuelState,
  playerId: PlayerId,
  card: CardInstance,
  zone: number,
  position: "atk" | "def",
  face: "up" | "down",
): void {
  const player = state.players[playerId];
  card.owner = playerId;
  card.position = position;
  card.face = face;
  card.summonedThisTurn = true;
  card.attackedThisTurn = false;
  card.changedThisTurn = false;
  player.monsters[zone] = card;
}

export function tributeCards(state: DuelState, playerId: PlayerId, uids: string[]): void {
  const player = state.players[playerId];
  for (const uid of uids) {
    const located = findOnField(state, uid);
    if (!located || located.player.id !== playerId || located.zone !== "monster") continue;
    located.player.monsters[located.index] = null;
    sendToGy(player, located.card);
  }
}

export function canNormalSummon(state: DuelState, playerId: PlayerId, uid: string, tributes: string[]): boolean {
  if (state.normalSummonUsed) return false;
  const player = state.players[playerId];
  const card = player.hand.find((item) => item.uid === uid);
  if (!card) return false;
  const def = getCardDef(card.defId);
  if (def.kind !== "monster" || isExtraMonster(def.monsterType)) return false;
  const need = tributeRequired(def.level ?? 1);
  if (tributes.length !== need) return false;
  const field = occupiedMonsters(player);
  if (need > 0 && tributes.some((id) => !field.some((m) => m.uid === id))) return false;
  const remaining = field.length - need;
  if (remaining >= 5) return false;
  return emptyZones(player.monsters).length > 0 || need > 0;
}

export function applySummon(state: DuelState, action: Extract<Action, { type: "normalSummon" | "setMonster" }>): void {
  const player = state.players[state.prompt.actor];
  const card = removeFromHand(player, action.uid);
  if (!card) return;
  tributeCards(state, player.id, action.tributes);
  const set = action.type === "setMonster";
  placeMonster(state, player.id, card, action.zone, set ? "def" : "atk", set ? "down" : "up");
  state.normalSummonUsed = true;
  log(state, `${set ? "盖放" : "通常召唤"} ${getCardDef(card.defId).name}`);
  onSummon(state, card);
}

export function onSummon(state: DuelState, card: CardInstance): void {
  if (card.face !== "up") return;
  if (card.defId === "ahri") {
    const owner = state.players[card.owner];
    const drawn = owner.deck.shift();
    if (drawn) {
      owner.hand.push(drawn);
      log(state, "九尾妖狐：抽 1 张");
    }
  }
  if (card.defId === "malzahar") {
    const foe = state.players[card.owner === 0 ? 1 : 0];
    foe.lp -= 400;
    log(state, "虚空先知：400 伤害");
  }
  if (card.defId === "blitzcrank") {
    const foe = state.players[card.owner === 0 ? 1 : 0];
    const target = occupiedMonsters(foe).find((m) => m.face === "up" && m.position === "atk");
    if (target) {
      target.position = "def";
      log(state, "蒸汽机器人：改成守备");
    }
  }
}
