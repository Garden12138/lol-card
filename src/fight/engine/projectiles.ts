import { getFighterDef } from "../data/roster";
import type { FightState, MoveDef, Projectile } from "./types";

export function spawnProjectile(state: FightState, owner: 0 | 1, move: MoveDef): void {
  const spec = move.projectile;
  if (!spec) return;
  const fighter = state.fighters[owner];
  const def = getFighterDef(fighter.id);
  state.projectiles.push({
    id: state.nextProjectileId++,
    owner,
    moveId: move.id,
    x: fighter.x + fighter.facing * (def.width / 2 + 20),
    y: fighter.y + def.height * 0.62,
    vx: spec.vx * fighter.facing,
    vy: spec.vy,
    life: spec.life,
    w: spec.w,
    h: spec.h,
    damage: move.damage,
    chip: move.chip,
    hitstun: move.hitstun,
    blockstun: move.blockstun,
    meterGain: move.meterGain,
    height: move.height,
    returning: Boolean(spec.returning),
    delay: spec.delay ?? 0,
    hook: Boolean(spec.hook),
    beam: Boolean(spec.beam),
    mark: Boolean(spec.mark),
    bind: Boolean(spec.bind),
    trap: Boolean(spec.trap),
    hit: false,
  });
}

export function advanceProjectiles(state: FightState): void {
  const next: Projectile[] = [];
  for (const shot of state.projectiles) {
    if (shot.delay > 0) {
      shot.delay -= 1;
      shot.life -= 1;
      if (shot.life > 0) next.push(shot);
      continue;
    }
    shot.x += shot.vx;
    shot.y += shot.vy;
    shot.life -= 1;
    if (shot.returning && shot.life === 28) shot.vx *= -1;
    if (shot.life > 0 && shot.x > -40 && shot.x < 1440) next.push(shot);
  }
  state.projectiles = next;
}
