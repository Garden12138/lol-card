import { getCardDef } from "../data/cards";
import { computedAtk, computedDef, emptyZones, findOnField, log, occupiedMonsters, other, sendToGy } from "./helpers";
import type { CardInstance, DuelState, PlayerState } from "./types";

export function destroyMonster(state: DuelState, card: CardInstance): void {
  if (card.protectedUntilEnd) {
    log(state, `${getCardDef(card.defId).name} 被屏障保护`);
    return;
  }
  const located = findOnField(state, card.uid);
  if (!located || located.zone !== "monster") return;
  located.player.monsters[located.index] = null;
  sendToGy(located.player, card);
  log(state, `${getCardDef(card.defId).name} 被破坏`);
  if (card.defId === "teemo") {
    const mushroom = located.player.deck.find((item) => item.defId === "mushroom");
    const zone = emptyZones(located.player.spells)[0];
    if (mushroom && zone !== undefined) {
      located.player.deck = located.player.deck.filter((item) => item.uid !== mushroom.uid);
      mushroom.face = "down";
      located.player.spells[zone] = mushroom;
      log(state, "迅捷斥候：盖放毒蘑菇");
    }
  }
}

export function resolveBattle(state: DuelState): void {
  const attack = state.attack;
  if (!attack || attack.negated) {
    state.attack = null;
    return;
  }
  const attackerLoc = findOnField(state, attack.attackerUid);
  if (!attackerLoc) {
    state.attack = null;
    return;
  }
  const attacker = attackerLoc.card;
  attacker.attackedThisTurn = true;
  const atk = computedAtk(state, attacker);
  if (attack.targetUid === "direct") {
    const foe = state.players[other(attacker.owner)];
    foe.lp -= atk;
    log(state, `直接攻击，造成 ${atk} 伤害`);
    state.attack = null;
    return;
  }
  const defenderLoc = findOnField(state, attack.targetUid);
  if (!defenderLoc) {
    state.attack = null;
    return;
  }
  const defender = defenderLoc.card;
  applyThornmail(state, attackerLoc.player, defenderLoc.player, defender);
  if (defender.position === "atk" && defender.face === "up") {
    const defAtk = computedAtk(state, defender);
    if (atk > defAtk) {
      destroyMonster(state, defender);
      defenderLoc.player.lp -= atk - defAtk;
      maybeExtraAttack(state, attacker);
    } else if (atk < defAtk) {
      destroyMonster(state, attacker);
      attackerLoc.player.lp -= defAtk - atk;
    } else {
      destroyMonster(state, attacker);
      destroyMonster(state, defender);
    }
  } else {
    defender.face = "up";
    const def = computedDef(defender);
    if (atk > def) {
      destroyMonster(state, defender);
      maybeExtraAttack(state, attacker);
    } else if (atk < def) {
      attackerLoc.player.lp -= def - atk;
    }
  }
  state.attack = null;
}

function applyThornmail(
  state: DuelState,
  _attackerOwner: PlayerState,
  defenderOwner: PlayerState,
  defender: CardInstance,
): void {
  const thorn = defenderOwner.spells.find((spell) => spell?.defId === "thornmail" && spell.equippedTo === defender.uid);
  if (thorn) {
    const attackerOwner = state.players[other(defender.owner)];
    attackerOwner.lp -= 500;
    log(state, "荆棘之甲：500 伤害");
  }
}

function maybeExtraAttack(state: DuelState, attacker: CardInstance): void {
  if (attacker.defId === "masterYi" && attacker.attackedThisTurn) {
    attacker.attackedThisTurn = false;
    log(state, "无极剑圣：可以再攻击一次");
  }
}

export function declareAttack(state: DuelState, attackerUid: string, targetUid: string | "direct"): boolean {
  if (state.phase !== "battle") return false;
  const located = findOnField(state, attackerUid);
  if (!located || located.card.owner !== state.turnPlayer) return false;
  const card = located.card;
  if (card.face !== "up" || card.position !== "atk" || card.attackedThisTurn) return false;
  const foe = state.players[other(state.turnPlayer)];
  const foes = occupiedMonsters(foe);
  if (targetUid === "direct") {
    if (foes.length > 0) return false;
  } else if (!foes.some((m) => m.uid === targetUid)) {
    return false;
  }
  state.attack = { attackerUid, targetUid, negated: false };
  state.battleStep = "battle";
  log(state, `${getCardDef(card.defId).name} 攻击宣言`);
  return true;
}
