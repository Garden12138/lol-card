import { getCardDef } from "../data/cards";
import { detachFromZone, emptyZones, log, occupiedMonsters, sendToGy } from "./helpers";
import { placeMonster } from "./summon";
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

function faceUp(player: PlayerState): CardInstance[] {
  return occupiedMonsters(player).filter((card) => card.face === "up");
}

function isTuner(card: CardInstance): boolean {
  return Boolean(getCardDef(card.defId).tuner);
}

export function synchroOptions(player: PlayerState): Action[] {
  const field = faceUp(player);
  const tuners = field.filter(isTuner);
  const nonTuners = field.filter((card) => !isTuner(card));
  if (tuners.length === 0 || nonTuners.length === 0) return [];
  const actions: Action[] = [];
  for (const extra of player.extra) {
    const def = getCardDef(extra.defId);
    if (def.monsterType !== "synchro") continue;
    const level = def.level ?? 0;
    for (const tuner of tuners) {
      for (let n = 1; n <= nonTuners.length; n += 1) {
        for (const rest of combinations(nonTuners, n)) {
          const materials = [tuner, ...rest];
          const sum = materials.reduce((total, card) => total + (getCardDef(card.defId).level ?? 0), 0);
          if (sum !== level) continue;
          const indexes = materials
            .map((card) => player.monsters.findIndex((slot) => slot?.uid === card.uid))
            .filter((index) => index >= 0);
          const zones = [...new Set([...emptyZones(player.monsters), ...indexes])];
          const zone = zones[0];
          if (zone === undefined) continue;
          actions.push({
            type: "synchroSummon",
            extraId: extra.defId,
            materials: materials.map((card) => card.uid),
            zone,
          });
        }
      }
    }
  }
  return actions;
}

export function applySynchro(
  state: DuelState,
  action: Extract<Action, { type: "synchroSummon" }>,
): void {
  const player = state.players[state.prompt.actor];
  const extra = player.extra.find((card) => card.defId === action.extraId);
  if (!extra) return;
  for (const uid of action.materials) {
    const card = detachFromZone(state, uid);
    if (card) sendToGy(player, card);
  }
  player.extra = player.extra.filter((card) => card.uid !== extra.uid);
  placeMonster(state, player.id, extra, action.zone, "atk", "up");
  log(state, `同调召唤 ${getCardDef(extra.defId).name}`);
}
