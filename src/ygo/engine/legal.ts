import { getCardDef } from "../data/cards";
import { computedAtk, emptyZones, isMainPhase, occupiedMonsters, occupiedSpells, other, tributeRequired } from "./helpers";
import { canNormalSummon } from "./summon";
import type { Action, CardInstance, DuelState, PlayerState } from "./types";

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > items.length) return [];
  const result: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) {
      result.push([...acc]);
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      acc.push(items[i]!);
      rec(i + 1, acc);
      acc.pop();
    }
  };
  rec(0, []);
  return result;
}

function summonActions(state: DuelState, player: PlayerState, type: "normalSummon" | "setMonster"): Action[] {
  const actions: Action[] = [];
  const monsters = occupiedMonsters(player);
  let zones = emptyZones(player.monsters);
  for (const card of player.hand) {
    const def = getCardDef(card.defId);
    if (def.kind !== "monster" || def.monsterType === "fusion") continue;
    const need = tributeRequired(def.level ?? 1);
    const tributeSets = need === 0 ? [[]] : combinations(monsters, need);
    for (const tributes of tributeSets) {
      if (!canNormalSummon(state, player.id, card.uid, tributes.map((t) => t.uid))) continue;
      const freed = tributes.length > 0;
      const available = freed ? [...new Set([...zones, ...tributes.map((t) => player.monsters.indexOf(t))])].filter((z) => z >= 0) : zones;
      for (const zone of available.length ? available : zones) {
        if (zone === undefined) continue;
        actions.push({
          type,
          uid: card.uid,
          zone,
          tributes: tributes.map((t) => t.uid),
        });
      }
    }
  }
  return actions;
}

function fusionOptions(state: DuelState, player: PlayerState, fusionUid: string): Action[] {
  const hex = player.hand.find((c) => c.uid === fusionUid) ?? occupiedSpells(player).find((c) => c.uid === fusionUid);
  if (!hex || hex.defId !== "hextechFusion") return [];
  const actions: Action[] = [];
  const pool = [
    ...player.hand.filter((c) => getCardDef(c.defId).kind === "monster"),
    ...occupiedMonsters(player),
  ];
  for (const extra of player.extra) {
    const fusion = getCardDef(extra.defId);
    const mats = fusion.fusionMaterials;
    if (!mats) continue;
    const first = pool.filter((c) => c.defId === mats[0]);
    const second = pool.filter((c) => c.defId === mats[1]);
    for (const a of first) {
      for (const b of second) {
        if (a.uid === b.uid) continue;
        if (emptyZones(player.monsters).length === 0 && ![a, b].some((m) => occupiedMonsters(player).includes(m))) {
          continue;
        }
        actions.push({
          type: "activate",
          uid: hex.uid,
          targets: [],
          fusionId: extra.defId,
          materials: [a.uid, b.uid],
        });
      }
    }
  }
  return actions;
}

function activateTargets(state: DuelState, player: PlayerState, card: CardInstance): string[][] {
  const def = getCardDef(card.defId);
  const foe = state.players[other(player.id)];
  switch (def.resolve) {
    case "damageLp":
    case "negateAttack":
    case "fusionSummon":
      return [[]];
    case "destroyTarget": {
      const cap = def.resolveValue ?? 99999;
      return occupiedMonsters(foe)
        .concat(occupiedMonsters(player))
        .filter((m) => m.face === "up" && computedAtk(state, m) <= cap)
        .map((m) => [m.uid]);
    }
    case "atkBuff":
      return occupiedMonsters(foe).map((m) => [m.uid]);
    case "returnToHand":
      return occupiedMonsters(player).map((m) => [m.uid]);
    case "protectDestroy":
      return occupiedMonsters(player).map((m) => [m.uid]);
    case "destroySpellTrap":
      return occupiedSpells(foe)
        .concat(occupiedSpells(player))
        .map((s) => [s.uid]);
    case "addFromGy":
      return player.gy.filter((c) => getCardDef(c.defId).kind === "monster").map((c) => [c.uid]);
    case "specialSummonHand":
      return player.hand
        .filter((c) => {
          const d = getCardDef(c.defId);
          return d.kind === "monster" && (d.level ?? 99) <= 4 && d.monsterType !== "fusion";
        })
        .map((c) => [c.uid]);
    case "equipBuff":
      return occupiedMonsters(player).map((m) => [m.uid]);
    default:
      return [];
  }
}

function canActivateNow(state: DuelState, player: PlayerState, card: CardInstance, fromHand: boolean): boolean {
  const def = getCardDef(card.defId);
  if (def.resolve === "none" && def.spellType !== "field") return false;
  if (def.id === "lux") {
    return state.prompt.kind === "free" && isMainPhase(state) && state.turnPlayer === player.id && card.face === "up";
  }
  if (def.kind === "trap") {
    if (fromHand) return false;
    if (card.face !== "down") return false;
    if (def.resolve === "negateAttack" && !state.attack) return false;
    return state.prompt.kind === "respond" || (state.prompt.kind === "free" && (isMainPhase(state) || state.phase === "battle"));
  }
  if (def.kind === "spell") {
    if (def.speed === 1) {
      return (
        state.prompt.kind === "free" &&
        isMainPhase(state) &&
        state.turnPlayer === player.id &&
        state.chain.length === 0
      );
    }
    return (
      (fromHand || card.face === "down" || def.spellType === "quick") &&
      (state.prompt.kind === "respond" ||
        (state.prompt.kind === "free" && (isMainPhase(state) || state.phase === "battle") && state.turnPlayer === player.id))
    );
  }
  return false;
}

export function legalActions(state: DuelState): Action[] {
  if (state.phase === "gameOver" || state.winner !== null) return [];
  const actor = state.players[state.prompt.actor];
  const actions: Action[] = [];

  if (state.prompt.kind === "respond") {
    for (const card of [...actor.hand, ...occupiedSpells(actor)]) {
      const fromHand = actor.hand.includes(card);
      if (!canActivateNow(state, actor, card, fromHand)) continue;
      if (card.defId === "hextechFusion") continue;
      for (const targets of activateTargets(state, actor, card)) {
        if (needsTarget(card) && targets.length === 0) continue;
        actions.push({ type: "activate", uid: card.uid, targets });
      }
    }
    actions.push({ type: "respondPass" });
    return uniqueActions(actions);
  }

  if (state.prompt.kind !== "free") return [];

  if (isMainPhase(state) && state.turnPlayer === actor.id) {
    actions.push(...summonActions(state, actor, "normalSummon"));
    actions.push(...summonActions(state, actor, "setMonster"));
    for (const card of occupiedMonsters(actor)) {
      if (card.summonedThisTurn || card.attackedThisTurn || card.changedThisTurn) continue;
      actions.push({ type: "changePosition", uid: card.uid });
    }
    for (const card of actor.hand) {
      const def = getCardDef(card.defId);
      if (def.kind !== "spell" && def.kind !== "trap") continue;
      for (const zone of emptyZones(actor.spells)) {
        if (def.spellType === "field") continue;
        actions.push({ type: "setSpellTrap", uid: card.uid, zone });
      }
    }
    for (const card of [...actor.hand, ...occupiedSpells(actor), ...occupiedMonsters(actor)]) {
      const fromHand = actor.hand.includes(card);
      if (card.defId === "hextechFusion") {
        actions.push(...fusionOptions(state, actor, card.uid));
        continue;
      }
      if (!canActivateNow(state, actor, card, fromHand)) continue;
      const targetSets = activateTargets(state, actor, card);
      for (const targets of targetSets) {
        if (needsTarget(card) && targets.length === 0) continue;
        actions.push({ type: "activate", uid: card.uid, targets });
      }
      if (getCardDef(card.defId).spellType === "field" && fromHand) {
        actions.push({ type: "activate", uid: card.uid, targets: [] });
      }
    }
  }

  if (state.phase === "battle" && state.turnPlayer === actor.id && !state.attack) {
    const foe = occupiedMonsters(state.players[other(actor.id)]);
    for (const card of occupiedMonsters(actor)) {
      if (card.face !== "up" || card.position !== "atk" || card.attackedThisTurn) continue;
      if (foe.length === 0) actions.push({ type: "attack", attackerUid: card.uid, targetUid: "direct" });
      else for (const target of foe) actions.push({ type: "attack", attackerUid: card.uid, targetUid: target.uid });
    }
  }

  if (state.turnPlayer === actor.id && (isMainPhase(state) || state.phase === "battle")) {
    actions.push({ type: "nextPhase" });
  }

  return uniqueActions(actions);
}

function needsTarget(card: CardInstance): boolean {
  const def = getCardDef(card.defId);
  return [
    "destroyTarget",
    "atkBuff",
    "returnToHand",
    "protectDestroy",
    "destroySpellTrap",
    "addFromGy",
    "specialSummonHand",
    "equipBuff",
  ].includes(def.resolve);
}

function uniqueActions(actions: Action[]): Action[] {
  const seen = new Set<string>();
  const result: Action[] = [];
  for (const action of actions) {
    const key = JSON.stringify(action);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }
  return result;
}
