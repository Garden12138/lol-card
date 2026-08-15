import { isEnemy, player } from "./helpers";
import type { GameState, PlayerId } from "./types";

export function seatDistance(state: GameState, from: PlayerId, to: PlayerId): number {
  if (from === to) return 0;
  const aliveIds = state.players.filter((item) => item.alive).map((item) => item.id);
  const fromIndex = aliveIds.indexOf(from);
  const toIndex = aliveIds.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) return 99;
  const n = aliveIds.length;
  const cw = (toIndex - fromIndex + n) % n;
  const ccw = (fromIndex - toIndex + n) % n;
  return Math.min(cw, ccw);
}

export function distance(state: GameState, from: PlayerId, to: PlayerId): number {
  let value = seatDistance(state, from, to);
  if (player(state, from).equipment.offensiveMount) value -= 1;
  if (player(state, to).equipment.defensiveMount) value += 1;
  return Math.max(1, value);
}

export function attackRange(state: GameState, id: PlayerId): number {
  const weapon = player(state, id).equipment.weapon;
  if (weapon?.kind === "infinityEdge") return 3;
  if (weapon?.kind === "doransBlade") return 2;
  return 1;
}

export function inAttackRange(state: GameState, from: PlayerId, to: PlayerId): boolean {
  return (
    from !== to &&
    player(state, to).alive &&
    isEnemy(state, from, to) &&
    distance(state, from, to) <= attackRange(state, from)
  );
}

export function equipmentList(state: GameState, id: PlayerId) {
  const eq = player(state, id).equipment;
  return [eq.weapon, eq.armor, eq.offensiveMount, eq.defensiveMount].filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );
}
