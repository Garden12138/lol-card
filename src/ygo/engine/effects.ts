import { getCardDef } from "../data/cards";
import {
  detachFromZone,
  emptyZones,
  findOnField,
  log,
  occupiedMonsters,
  other,
  removeFromHand,
  sendToGy,
} from "./helpers";
import { placeMonster } from "./summon";
import type { ChainLink, DuelState } from "./types";

export function applyResolve(state: DuelState, link: ChainLink): void {
  const def = getCardDef(link.defId);
  switch (link.effect) {
    case "damageLp": {
      const foe = state.players[other(link.controller)];
      foe.lp -= def.resolveValue ?? 0;
      log(state, `${def.name}：${def.resolveValue ?? 0} 伤害`);
      break;
    }
    case "atkBuff": {
      const target = findOnField(state, link.targets[0] ?? "");
      if (target) {
        target.card.atkBuff += def.resolveValue ?? 0;
        log(state, `${def.name}：攻击力变化`);
      }
      break;
    }
    case "destroyTarget": {
      const target = findOnField(state, link.targets[0] ?? "");
      if (target?.zone === "monster") {
        if (target.card.protectedUntilEnd) {
          log(state, "屏障保护了那只怪兽");
          break;
        }
        target.player.monsters[target.index] = null;
        sendToGy(target.player, target.card);
        log(state, `${def.name}：破坏 ${getCardDef(target.card.defId).name}`);
      }
      break;
    }
    case "destroySpellTrap": {
      const target = findOnField(state, link.targets[0] ?? "");
      if (target && target.zone !== "monster") {
        detachFromZone(state, target.card.uid);
        sendToGy(target.player, target.card);
        log(state, `${def.name}：破坏魔陷`);
      }
      break;
    }
    case "returnToHand": {
      const target = findOnField(state, link.targets[0] ?? "");
      if (target?.zone === "monster") {
        target.player.monsters[target.index] = null;
        target.card.face = "up";
        target.player.hand.push(target.card);
        log(state, `${def.name}：回到手牌`);
      }
      break;
    }
    case "negateAttack": {
      if (state.attack) {
        state.attack.negated = true;
        log(state, "金身：攻击无效");
      }
      break;
    }
    case "protectDestroy": {
      const target = findOnField(state, link.targets[0] ?? "");
      if (target) {
        target.card.protectedUntilEnd = true;
        log(state, "屏障：直到回合结束不会被破坏");
      }
      break;
    }
    case "addFromGy": {
      const player = state.players[link.controller];
      const card = player.gy.find((item) => item.uid === link.targets[0]);
      if (card) {
        player.gy = player.gy.filter((item) => item.uid !== card.uid);
        player.hand.push(card);
        log(state, "时光守护：墓地怪兽加入手牌");
      }
      break;
    }
    case "specialSummonHand": {
      const player = state.players[link.controller];
      const card = removeFromHand(player, link.targets[0] ?? "");
      const zone = emptyZones(player.monsters)[0];
      if (card && zone !== undefined) {
        placeMonster(state, player.id, card, zone, "atk", "up");
        log(state, `传送：特殊召唤 ${getCardDef(card.defId).name}`);
      }
      break;
    }
    case "equipBuff": {
      const player = state.players[link.controller];
      const located = findOnField(state, link.uid);
      const target = findOnField(state, link.targets[0] ?? "");
      if (located && target?.zone === "monster") {
        located.card.equippedTo = target.card.uid;
        log(state, `${def.name}：装备`);
      } else if (player.hand.some((c) => c.uid === link.uid) && target?.zone === "monster") {
        const card = removeFromHand(player, link.uid);
        const zone = emptyZones(player.spells)[0];
        if (card && zone !== undefined) {
          card.face = "up";
          card.equippedTo = target.card.uid;
          player.spells[zone] = card;
          log(state, `${def.name}：装备`);
        }
      }
      break;
    }
    case "fusionSummon": {
      applyFusion(state, link);
      break;
    }
    default:
      break;
  }
}

function applyFusion(state: DuelState, link: ChainLink): void {
  const player = state.players[link.controller];
  const fusion = player.extra.find((card) => card.defId === link.fusionId);
  const zone = emptyZones(player.monsters)[0];
  if (!fusion || !link.materials || zone === undefined) return;
  for (const uid of link.materials) {
    const inHand = removeFromHand(player, uid);
    if (inHand) {
      sendToGy(player, inHand);
      continue;
    }
    const onField = findOnField(state, uid);
    if (onField) {
      detachFromZone(state, uid);
      sendToGy(onField.player, onField.card);
    }
  }
  player.extra = player.extra.filter((card) => card.uid !== fusion.uid);
  placeMonster(state, player.id, fusion, zone, "atk", "up");
  log(state, `融合召唤 ${getCardDef(fusion.defId).name}`);
}

export function consumeActivatedCard(state: DuelState, uid: string): void {
  const playerField = findOnField(state, uid);
  if (playerField && playerField.zone !== "monster") {
    const def = getCardDef(playerField.card.defId);
    if (def.spellType === "equip" || def.spellType === "field" || def.spellType === "continuous" || def.trapType === "continuous") {
      playerField.card.face = "up";
      return;
    }
    detachFromZone(state, uid);
    sendToGy(playerField.player, playerField.card);
    return;
  }
  for (const player of state.players) {
    const card = removeFromHand(player, uid);
    if (!card) continue;
    const def = getCardDef(card.defId);
    if (def.spellType === "field") {
      if (player.field) sendToGy(player, player.field);
      card.face = "up";
      player.field = card;
      return;
    }
    if (def.spellType === "equip" || def.spellType === "continuous") {
      const zone = emptyZones(player.spells)[0];
      if (zone !== undefined) {
        card.face = "up";
        player.spells[zone] = card;
      } else sendToGy(player, card);
      return;
    }
    sendToGy(player, card);
    return;
  }
}
