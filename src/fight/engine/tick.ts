import { SHARED_NORMALS } from "../data/sharedNormals";
import { getFighterDef } from "../data/roster";
import { hurtbox, overlap, worldBox } from "./boxes";
import { addMeter, findMove, isActiveFrame, justiceDamage, moveDuration } from "./combat";
import { GRAVITY, JUMP_V, MAX_HEALTH, WALL_LEFT, WALL_RIGHT, type FightState, type Fighter, type InputBits, type MoveDef } from "./types";
import { detectMotion, edgePressed, holdingBack, numpadDir, pushBuffer } from "./input";
import { advanceProjectiles, spawnProjectile } from "./projectiles";
import { tickRounds } from "./rounds";
import { chooseAiInputs } from "../ai/chooseInputs";

function other(side: 0 | 1): 0 | 1 {
  return side === 0 ? 1 : 0;
}

function canAct(fighter: Fighter): boolean {
  return (
    fighter.hitstun <= 0 &&
    fighter.blockstun <= 0 &&
    fighter.knockdown <= 0 &&
    fighter.crumple <= 0 &&
    fighter.pose !== "attack" &&
    fighter.pose !== "special" &&
    fighter.pose !== "super" &&
    fighter.pose !== "throw" &&
    fighter.pose !== "ko"
  );
}

function inBusyMove(fighter: Fighter): boolean {
  return fighter.pose === "attack" || fighter.pose === "special" || fighter.pose === "super" || fighter.pose === "throw";
}

function startMove(fighter: Fighter, move: MoveDef, pose: Fighter["pose"]): void {
  fighter.pose = pose;
  fighter.poseFrame = 0;
  fighter.moveId = move.id;
  fighter.hitConnect = false;
  fighter.invuln = move.invuln;
  fighter.armor = move.armor;
  fighter.vx += move.vx * fighter.facing;
  if (move.vy) {
    fighter.vy = move.vy;
    fighter.y = Math.max(fighter.y, 0.01);
  }
}

function pickNormal(fighter: Fighter, input: InputBits, prev: InputBits): MoveDef | null {
  const airborne = fighter.y > 1;
  const crouch = input.down && !airborne;
  if (airborne && (edgePressed(prev, input, "hp") || edgePressed(prev, input, "hk"))) {
    return SHARED_NORMALS.find((move) => move.id === "jhp") ?? null;
  }
  if (crouch && edgePressed(prev, input, "hk")) return SHARED_NORMALS.find((move) => move.id === "2hk") ?? null;
  if (crouch && edgePressed(prev, input, "lk")) return SHARED_NORMALS.find((move) => move.id === "2lk") ?? null;
  if (edgePressed(prev, input, "hk")) return SHARED_NORMALS.find((move) => move.id === "5hk") ?? null;
  if (edgePressed(prev, input, "hp")) return SHARED_NORMALS.find((move) => move.id === "5hp") ?? null;
  if (edgePressed(prev, input, "lk")) return SHARED_NORMALS.find((move) => move.id === "5lk") ?? null;
  if (edgePressed(prev, input, "lp")) return SHARED_NORMALS.find((move) => move.id === "5lp") ?? null;
  return null;
}

function punchPressed(prev: InputBits, input: InputBits): boolean {
  return edgePressed(prev, input, "lp") || edgePressed(prev, input, "hp");
}

function kickPressed(prev: InputBits, input: InputBits): boolean {
  return edgePressed(prev, input, "lk") || edgePressed(prev, input, "hk");
}

function trySpecial(fighter: Fighter, input: InputBits, prev: InputBits, buffer: number[]): MoveDef | null {
  const motion = detectMotion(buffer);
  if (!motion) return null;
  const def = getFighterDef(fighter.id);
  const punch = punchPressed(prev, input);
  const kick = kickPressed(prev, input);
  if (!punch && !kick) return null;
  const ranked = [...def.specials].sort((a, b) => (a.motion === "236236" ? -1 : b.motion === "236236" ? 1 : 0));
  for (const move of ranked) {
    if (move.motion !== motion) continue;
    if (move.button === "K" && !kick) continue;
    if (move.button === "P" && !punch) continue;
    if (move.meterCost > 0 && fighter.meter < move.meterCost) continue;
    return move;
  }
  return null;
}

function tryThrow(self: Fighter, foe: Fighter, input: InputBits, prev: InputBits): MoveDef | null {
  const both =
    (edgePressed(prev, input, "lp") && input.lk) || (edgePressed(prev, input, "lk") && input.lp) || (input.lp && input.lk && (edgePressed(prev, input, "lp") || edgePressed(prev, input, "lk")));
  if (!both || self.y > 1 || foe.y > 1) return null;
  if (Math.abs(self.x - foe.x) > 70) return null;
  return SHARED_NORMALS.find((move) => move.id === "throw") ?? null;
}

function applyPhysics(fighter: Fighter): void {
  fighter.vy -= GRAVITY;
  fighter.x += fighter.vx;
  fighter.y += fighter.vy;
  if (fighter.y <= 0) {
    fighter.y = 0;
    fighter.vy = 0;
    if (fighter.pose === "jump") {
      fighter.pose = "idle";
      fighter.poseFrame = 0;
      fighter.moveId = null;
    }
  }
  fighter.x = Math.max(WALL_LEFT, Math.min(WALL_RIGHT, fighter.x));
  fighter.vx *= fighter.y > 0 ? 0.98 : 0.72;
  if (Math.abs(fighter.vx) < 0.08) fighter.vx = 0;
}

function faceOpponent(a: Fighter, b: Fighter): void {
  if (a.pose === "idle" || a.pose === "walk" || a.pose === "crouch" || a.pose === "block") {
    a.facing = a.x <= b.x ? 1 : -1;
  }
}

function applyHit(
  state: FightState,
  attacker: 0 | 1,
  defender: 0 | 1,
  move: Pick<MoveDef, "damage" | "chip" | "hitstun" | "blockstun" | "height" | "knockup" | "knockdown" | "meterGain" | "id">,
  blocked: boolean,
): void {
  const self = state.fighters[attacker];
  const foe = state.fighters[defender];
  if (foe.invuln > 0) return;
  let damage = move.damage;
  if (move.id === "justice") damage = justiceDamage(damage, foe.health);
  if (foe.armor > 0 && !blocked) {
    foe.armor -= 1;
    damage = Math.round(damage * 0.35);
  }
  if (blocked) {
    foe.health = Math.max(0, foe.health - move.chip);
    foe.blockstun = move.blockstun;
    foe.pose = "block";
    foe.poseFrame = 0;
    foe.vx = -foe.facing * 1.6;
    addMeter(self, Math.round(move.meterGain * 0.4));
    addMeter(foe, 6);
    state.combo = 0;
    return;
  }
  foe.health = Math.max(0, foe.health - damage);
  foe.hitstun = move.hitstun;
  foe.pose = move.knockup > 0 ? "hitstun" : move.knockdown ? "knockdown" : "hitstun";
  if (move.id === "charm" || move.id === "bind") {
    foe.crumple = 22;
    foe.pose = "crumple";
  }
  if (move.id === "box") foe.trapped = 40;
  foe.poseFrame = 0;
  foe.moveId = null;
  foe.vx = -foe.facing * (3 + (move.knockup > 0 ? 1 : 0));
  if (move.knockup > 0) {
    foe.vy = move.knockup;
    foe.y = Math.max(foe.y, 1);
  }
  if (move.knockdown) foe.knockdown = 28;
  if (move.id === "sonic") foe.leeMarked = 90;
  if (self.id === "Yasuo" && move.id === "steel") self.yasuoStacks = Math.min(3, self.yasuoStacks + 1);
  addMeter(self, move.meterGain);
  addMeter(foe, 10);
  state.lastHitBy = attacker;
  state.combo = state.lastHitBy === attacker ? state.combo + 1 : 1;
  state.freeze = move.id.includes("soul") || move.meterGain >= 18 ? 4 : 2;
}

function shouldBlock(foe: Fighter, input: InputBits, height: MoveDef["height"]): boolean {
  if (foe.y > 1) return false;
  if (!holdingBack(input, foe.facing)) return false;
  if (height === "low" && !input.down) return false;
  if (height === "overhead" && input.down) return false;
  return true;
}

function resolveMelee(state: FightState, inputs: [InputBits, InputBits]): void {
  for (const side of [0, 1] as const) {
    const self = state.fighters[side];
    const foe = state.fighters[other(side)];
    if (!self.moveId || self.hitConnect) continue;
    const move = findMove(self, self.moveId);
    if (!move || !isActiveFrame(move, self.poseFrame)) continue;
    const def = getFighterDef(self.id);
    const hit = worldBox(self.x, self.y, self.facing, move.hitbox);
    const hurt = hurtbox(
      foe.x,
      foe.y,
      getFighterDef(foe.id).width,
      getFighterDef(foe.id).height,
      foe.pose === "crouch" || (foe.pose === "block" && inputs[other(side)].down),
    );
    if (!overlap(hit, hurt)) continue;
    self.hitConnect = true;
    applyHit(state, side, other(side), move, shouldBlock(foe, inputs[other(side)], move.height));
    void def;
  }
}

function resolveProjectiles(state: FightState, inputs: [InputBits, InputBits]): void {
  for (const shot of state.projectiles) {
    if (shot.hit || shot.delay > 0) continue;
    const foe = state.fighters[other(shot.owner)];
    const box = { x: shot.x - shot.w / 2, y: shot.y - shot.h / 2, w: shot.w, h: shot.h };
    const hurt = hurtbox(foe.x, foe.y, getFighterDef(foe.id).width, getFighterDef(foe.id).height, foe.pose === "crouch");
    if (!overlap(box, hurt)) continue;
    shot.hit = true;
    shot.life = Math.min(shot.life, 1);
    const blocked = shouldBlock(foe, inputs[other(shot.owner)], shot.height);
    applyHit(
      state,
      shot.owner,
      other(shot.owner),
      {
        id: shot.moveId,
        damage: shot.damage,
        chip: shot.chip,
        hitstun: shot.hitstun,
        blockstun: shot.blockstun,
        height: shot.height,
        knockup: 0,
        knockdown: shot.hook,
        meterGain: shot.meterGain,
      },
      blocked,
    );
    if (shot.hook && !blocked) {
      foe.x += (state.fighters[shot.owner].x - foe.x) * 0.45;
    }
    if (shot.mark) foe.leeMarked = 90;
    if (shot.bind) foe.crumple = 20;
  }
}

function cancelWindow(self: Fighter, next: MoveDef): boolean {
  if (!self.moveId || !self.hitConnect) return false;
  const current = findMove(self, self.moveId);
  if (!current) return false;
  if (next.motion === "236236") return current.cancelSuper || current.cancelSpecial;
  if (next.kind !== "normal") return current.cancelSpecial;
  return current.id === "5lp" && self.lpChain < 2 && next.id === "5lp";
}

function controlFighter(state: FightState, side: 0 | 1, input: InputBits): void {
  const self = state.fighters[side];
  const foe = state.fighters[other(side)];
  const prev = state.prevInputs[side];
  const dir = numpadDir(input, self.facing);
  state.buffers[side] = pushBuffer(state.buffers[side], dir);

  if (self.invuln > 0) self.invuln -= 1;
  if (self.leeMarked > 0) self.leeMarked -= 1;
  if (self.trapped > 0) {
    self.trapped -= 1;
    self.vx = 0;
  }
  if (self.hitstun > 0) {
    self.hitstun -= 1;
    self.pose = "hitstun";
    if (self.hitstun <= 0 && self.y <= 0) {
      self.pose = "idle";
      self.poseFrame = 0;
    }
    return;
  }
  if (self.crumple > 0) {
    self.crumple -= 1;
    self.pose = "crumple";
    return;
  }
  if (self.blockstun > 0) {
    self.blockstun -= 1;
    self.pose = "block";
    if (self.blockstun <= 0) {
      self.pose = "idle";
      self.poseFrame = 0;
    }
    return;
  }
  if (self.knockdown > 0) {
    self.knockdown -= 1;
    self.pose = "knockdown";
    if (self.knockdown <= 0) {
      self.pose = "idle";
      self.poseFrame = 0;
    }
    return;
  }

  if (inBusyMove(self) && self.moveId) {
    const move = findMove(self, self.moveId);
    if (move) {
      if (self.poseFrame === move.startup && (move.kind === "projectile" || move.kind === "hook" || move.kind === "beam")) {
        spawnProjectile(state, side, move);
        if (move.id === "steel" && self.yasuoStacks >= 2 && move.projectile) {
          spawnProjectile(state, side, {
            ...move,
            projectile: { ...move.projectile, vx: 9, life: 40, w: 48, h: 36 },
          });
          self.yasuoStacks = 0;
        }
      }
      const special = trySpecial(self, input, prev, state.buffers[side]);
      if (special && cancelWindow(self, special)) {
        if (special.meterCost) addMeter(self, -special.meterCost);
        startMove(self, special, special.meterCost ? "super" : "special");
        return;
      }
      const chain = pickNormal(self, input, prev);
      if (chain && cancelWindow(self, chain)) {
        self.lpChain += 1;
        startMove(self, chain, "attack");
        return;
      }
      self.poseFrame += 1;
      if (self.poseFrame >= moveDuration(move)) {
        self.pose = self.y > 1 ? "jump" : "idle";
        self.poseFrame = 0;
        self.moveId = null;
        self.lpChain = 0;
      }
    }
    return;
  }

  const special = trySpecial(self, input, prev, state.buffers[side]);
  if (special && (canAct(self) || self.pose === "jump")) {
    if (special.meterCost) addMeter(self, -special.meterCost);
    if (special.id === "resonate" && foe.leeMarked <= 0) {
      /* still dash */
    }
    startMove(self, special, special.meterCost ? "super" : "special");
    if (special.kind === "teleport" || special.kind === "dash") {
      self.x += special.vx * self.facing;
    }
    return;
  }

  const thrown = tryThrow(self, foe, input, prev);
  if (thrown && canAct(self)) {
    startMove(self, thrown, "throw");
    return;
  }

  const normal = pickNormal(self, input, prev);
  if (normal && (canAct(self) || self.pose === "jump")) {
    if (normal.id === "5lp") self.lpChain = 1;
    startMove(self, normal, "attack");
    return;
  }

  if (!canAct(self) && self.pose !== "jump") return;

  if (self.y > 1) {
    self.pose = "jump";
    return;
  }

  if (input.up && self.y <= 0) {
    self.pose = "jump";
    self.poseFrame = 0;
    self.vy = JUMP_V;
    const forward = self.facing === 1 ? input.right : input.left;
    const back = self.facing === 1 ? input.left : input.right;
    self.vx = forward ? self.facing * getFighterDef(self.id).walkSpeed * 1.4 : back ? -self.facing * getFighterDef(self.id).walkSpeed * 1.1 : 0;
    return;
  }

  if (input.down && self.y <= 0) {
    self.pose = holdingBack(input, self.facing) ? "block" : "crouch";
    self.vx = 0;
    return;
  }

  const def = getFighterDef(self.id);
  if (input.right || input.left) {
    const forward = self.facing === 1 ? input.right : input.left;
    self.pose = holdingBack(input, self.facing) ? "walk" : "walk";
    self.vx = (input.right ? 1 : -1) * def.walkSpeed;
    if (!forward && holdingBack(input, self.facing)) self.pose = "walk";
    return;
  }

  self.pose = "idle";
  self.vx = 0;
}

export function tick(state: FightState, p1: InputBits, p2: InputBits): FightState {
  const next: FightState = structuredClone(state);
  next.frame += 1;

  let inputs: [InputBits, InputBits] = [p1, p2];
  if (next.versus === "ai") {
    inputs = [p1, chooseAiInputs(next, p2)];
  }

  if (next.freeze > 0) {
    next.freeze -= 1;
    next.prevInputs = [{ ...inputs[0] }, { ...inputs[1] }];
    return next;
  }

  tickRounds(next);
  if (next.phase !== "fight") {
    next.prevInputs = [{ ...inputs[0] }, { ...inputs[1] }];
    return next;
  }

  faceOpponent(next.fighters[0], next.fighters[1]);
  faceOpponent(next.fighters[1], next.fighters[0]);
  controlFighter(next, 0, inputs[0]);
  controlFighter(next, 1, inputs[1]);
  applyPhysics(next.fighters[0]);
  applyPhysics(next.fighters[1]);
  advanceProjectiles(next);
  resolveMelee(next, inputs);
  resolveProjectiles(next, inputs);

  const [a, b] = next.fighters;
  if (Math.abs(a.x - b.x) < 40 && a.y < 20 && b.y < 20) {
    if (a.x < b.x) {
      a.x -= 2;
      b.x += 2;
    } else {
      a.x += 2;
      b.x -= 2;
    }
  }

  next.prevInputs = [{ ...inputs[0] }, { ...inputs[1] }];
  return next;
}

export function healthRatio(fighter: Fighter): number {
  return fighter.health / MAX_HEALTH;
}
