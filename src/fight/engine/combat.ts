import { SHARED_NORMALS } from "../data/sharedNormals";
import { getFighterDef } from "../data/roster";
import type { Fighter, MoveDef } from "./types";

export function findMove(fighter: Fighter, moveId: string): MoveDef | undefined {
  return (
    SHARED_NORMALS.find((move) => move.id === moveId) ??
    getFighterDef(fighter.id).specials.find((move) => move.id === moveId)
  );
}

export function moveDuration(move: MoveDef): number {
  return move.startup + move.active + move.recovery;
}

export function isActiveFrame(move: MoveDef, frame: number): boolean {
  return frame >= move.startup && frame < move.startup + move.active;
}

export function addMeter(fighter: Fighter, amount: number): void {
  fighter.meter = Math.max(0, Math.min(300, fighter.meter + amount));
}

export function justiceDamage(base: number, health: number): number {
  if (health <= 300) return Math.round(base * 1.45);
  if (health <= 500) return Math.round(base * 1.2);
  return base;
}
