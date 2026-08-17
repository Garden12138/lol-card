import { getCardDef } from "../data/cards";
import { detachFromZone, emptyZones, isExtraMonster, log, occupiedMonsters, sendToGy } from "./helpers";
import { placeMonster } from "./summon";
import type { Action, CardInstance, DuelState, PlayerState } from "./types";

function hasXyzLevel(card: CardInstance): boolean {
  const def = getCardDef(card.defId);
  return def.kind === "monster" && !isExtraMonster(def.monsterType) && typeof def.level === "number";
}

export function xyzOptions(player: PlayerState): Action[] {
  const field = occupiedMonsters(player).filter((card) => card.face === "up" && hasXyzLevel(card));
  const actions: Action[] = [];
  for (const extra of player.extra) {
    const def = getCardDef(extra.defId);
    if (def.monsterType !== "xyz" || (def.xyzCount ?? 2) !== 2) continue;
    const rank = def.rank ?? 0;
    const matches = field.filter((card) => getCardDef(card.defId).level === rank);
    for (let i = 0; i < matches.length; i += 1) {
      for (let j = i + 1; j < matches.length; j += 1) {
        const materials = [matches[i]!, matches[j]!];
        const indexes = materials
          .map((card) => player.monsters.findIndex((slot) => slot?.uid === card.uid))
          .filter((index) => index >= 0);
        const zone = [...new Set([...emptyZones(player.monsters), ...indexes])][0];
        if (zone === undefined) continue;
        actions.push({
          type: "xyzSummon",
          extraId: extra.defId,
          materials: materials.map((card) => card.uid),
          zone,
        });
      }
    }
  }
  return actions;
}

export function applyXyz(state: DuelState, action: Extract<Action, { type: "xyzSummon" }>): void {
  const player = state.players[state.prompt.actor];
  const extra = player.extra.find((card) => card.defId === action.extraId);
  if (!extra) return;
  const overlays: CardInstance[] = [];
  for (const uid of action.materials) {
    const card = detachFromZone(state, uid);
    if (card) overlays.push(card);
  }
  extra.overlays = overlays;
  player.extra = player.extra.filter((card) => card.uid !== extra.uid);
  placeMonster(state, player.id, extra, action.zone, "atk", "up");
  log(state, `超量召唤 ${getCardDef(extra.defId).name}`);
}

export function detachOverlays(state: DuelState, card: CardInstance, count: number): void {
  const player = state.players[card.owner];
  const overlays = card.overlays ?? [];
  for (let i = 0; i < count; i += 1) {
    const material = overlays.shift();
    if (material) sendToGy(player, material);
  }
  card.overlays = overlays;
}
