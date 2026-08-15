import { getCardDef } from "../data/cards";
import type { CardInstance, DuelState, PlayerId, PlayerState } from "./types";

export function cloneState(state: DuelState): DuelState {
  return structuredClone(state);
}

export function other(id: PlayerId): PlayerId {
  return id === 0 ? 1 : 0;
}

export function log(state: DuelState, line: string): void {
  state.log.push(line);
}

export function emptyZones(slots: (CardInstance | null)[]): number[] {
  const zones: number[] = [];
  for (let i = 0; i < slots.length; i += 1) {
    if (!slots[i]) zones.push(i);
  }
  return zones;
}

export function occupiedMonsters(player: PlayerState): CardInstance[] {
  return player.monsters.filter((card): card is CardInstance => card !== null);
}

export function occupiedSpells(player: PlayerState): CardInstance[] {
  const field = player.field ? [player.field] : [];
  return [...player.spells.filter((card): card is CardInstance => card !== null), ...field];
}

export function findOnField(
  state: DuelState,
  uid: string,
): { player: PlayerState; zone: "monster" | "spell" | "field"; index: number; card: CardInstance } | null {
  for (const player of state.players) {
    for (let i = 0; i < player.monsters.length; i += 1) {
      const card = player.monsters[i];
      if (card?.uid === uid) return { player, zone: "monster", index: i, card };
    }
    for (let i = 0; i < player.spells.length; i += 1) {
      const card = player.spells[i];
      if (card?.uid === uid) return { player, zone: "spell", index: i, card };
    }
    if (player.field?.uid === uid) return { player, zone: "field", index: 0, card: player.field };
  }
  return null;
}

export function findAnywhere(state: DuelState, uid: string): CardInstance | null {
  for (const player of state.players) {
    for (const pile of [player.hand, player.deck, player.gy, player.extra, player.banished]) {
      const hit = pile.find((card) => card.uid === uid);
      if (hit) return hit;
    }
  }
  return findOnField(state, uid)?.card ?? null;
}

export function removeFromHand(player: PlayerState, uid: string): CardInstance | null {
  const index = player.hand.findIndex((card) => card.uid === uid);
  if (index < 0) return null;
  return player.hand.splice(index, 1)[0] ?? null;
}

export function sendToGy(player: PlayerState, card: CardInstance): void {
  card.face = "up";
  card.equippedTo = undefined;
  player.gy.unshift(card);
}

export function detachFromZone(state: DuelState, uid: string): CardInstance | null {
  const located = findOnField(state, uid);
  if (!located) return null;
  if (located.zone === "monster") located.player.monsters[located.index] = null;
  else if (located.zone === "spell") located.player.spells[located.index] = null;
  else located.player.field = null;
  return located.card;
}

export function tributeRequired(level: number): number {
  if (level <= 4) return 0;
  if (level <= 6) return 1;
  return 2;
}

export function computedAtk(state: DuelState, card: CardInstance): number {
  const def = getCardDef(card.defId);
  let atk = (def.atk ?? 0) + card.atkBuff;
  const owner = state.players[card.owner];
  const monsters = occupiedMonsters(owner);
  if (card.defId === "garen" && monsters.every((m) => getCardDef(m.defId).race === "Warrior")) {
    atk += 400;
  }
  if (card.defId === "jinx" && monsters.length === 1) atk += 500;
  if (card.defId === "vayne") {
    const foe = state.players[other(card.owner)];
    if (occupiedMonsters(foe).some((m) => m.position === "def")) atk += 400;
  }
  for (const player of state.players) {
    if (player.field?.defId === "summonerRift" && def.race === "Warrior") atk += 300;
    for (const spell of player.spells) {
      if (!spell || spell.equippedTo !== card.uid) continue;
      const spellDef = getCardDef(spell.defId);
      atk += spellDef.resolveValue ?? 0;
    }
  }
  return Math.max(0, atk);
}

export function computedDef(card: CardInstance): number {
  return Math.max(0, (getCardDef(card.defId).def ?? 0) + card.atkBuff);
}

export function isMainPhase(state: DuelState): boolean {
  return state.phase === "main1" || state.phase === "main2";
}

export function speedOf(defId: string): 1 | 2 {
  return getCardDef(defId).speed;
}
