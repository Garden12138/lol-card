export const TICK_HZ = 60;
export const STAGE_WIDTH = 1400;
export const WALL_LEFT = 90;
export const WALL_RIGHT = 1310;
export const GRAVITY = 0.72;
export const JUMP_V = 16.2;
export const BUFFER_FRAMES = 14;
export const ROUND_FRAMES = 99 * 60;
export const WINS_NEEDED = 2;
export const MAX_HEALTH = 1000;
export const MAX_METER = 300;
export const INTRO_FRAMES = 90;
export const KO_FRAMES = 120;

export type FighterId =
  | "Ahri"
  | "Garen"
  | "Yasuo"
  | "Lux"
  | "LeeSin"
  | "Katarina"
  | "Ezreal"
  | "Thresh";

export type AiDifficulty = "easy" | "normal" | "hard";
export type VersusKind = "ai" | "local";
export type FightPhase = "intro" | "fight" | "ko" | "timeout" | "matchOver";
export type FighterPose =
  | "idle"
  | "walk"
  | "crouch"
  | "jump"
  | "attack"
  | "special"
  | "super"
  | "block"
  | "hitstun"
  | "knockdown"
  | "throw"
  | "crumple"
  | "ko"
  | "win";

export type AttackHeight = "high" | "mid" | "low" | "overhead";

export type Rect = { x: number; y: number; w: number; h: number };

export type InputBits = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  lp: boolean;
  lk: boolean;
  hp: boolean;
  hk: boolean;
};

export const EMPTY_INPUT: InputBits = {
  left: false,
  right: false,
  up: false,
  down: false,
  lp: false,
  lk: false,
  hp: false,
  hk: false,
};

export type MoveKind =
  | "normal"
  | "projectile"
  | "dp"
  | "dash"
  | "spin"
  | "beam"
  | "teleport"
  | "hook"
  | "aoe"
  | "slash"
  | "throw";

export type Motion = "236" | "214" | "623" | "236236" | "none";

export type MoveDef = {
  id: string;
  name: string;
  motion: Motion;
  button: "P" | "K" | "LP" | "LK" | "HP" | "HK" | "THROW";
  kind: MoveKind;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  chip: number;
  hitstun: number;
  blockstun: number;
  hitbox: Rect;
  height: AttackHeight;
  cancelSpecial: boolean;
  cancelSuper: boolean;
  meterCost: number;
  meterGain: number;
  knockup: number;
  knockdown: boolean;
  invuln: number;
  armor: number;
  vx: number;
  vy: number;
  projectile?: {
    vx: number;
    vy: number;
    life: number;
    w: number;
    h: number;
    returning?: boolean;
    delay?: number;
    hook?: boolean;
    beam?: boolean;
    mark?: boolean;
    bind?: boolean;
    trap?: boolean;
  };
};

export type FighterDef = {
  id: FighterId;
  name: string;
  title: string;
  color: string;
  walkSpeed: number;
  width: number;
  height: number;
  specials: MoveDef[];
};

export type Projectile = {
  id: number;
  owner: 0 | 1;
  moveId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  w: number;
  h: number;
  damage: number;
  chip: number;
  hitstun: number;
  blockstun: number;
  meterGain: number;
  height: AttackHeight;
  returning: boolean;
  delay: number;
  hook: boolean;
  beam: boolean;
  mark: boolean;
  bind: boolean;
  trap: boolean;
  hit: boolean;
};

export type Fighter = {
  id: FighterId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  health: number;
  meter: number;
  pose: FighterPose;
  poseFrame: number;
  moveId: string | null;
  hitConnect: boolean;
  lpChain: number;
  hitstun: number;
  blockstun: number;
  invuln: number;
  armor: number;
  knockdown: number;
  yasuoStacks: number;
  leeMarked: number;
  trapped: number;
  crumple: number;
};

export type FightState = {
  frame: number;
  round: number;
  timer: number;
  wins: [number, number];
  phase: FightPhase;
  phaseFrame: number;
  fighters: [Fighter, Fighter];
  projectiles: Projectile[];
  freeze: number;
  nextProjectileId: number;
  versus: VersusKind;
  aiDifficulty: AiDifficulty;
  buffers: [number[], number[]];
  prevInputs: [InputBits, InputBits];
  aiQueue: InputBits[];
  combo: number;
  lastHitBy: 0 | 1 | null;
};

export type FightConfig = {
  p1: FighterId;
  p2: FighterId;
  versus: VersusKind;
  aiDifficulty: AiDifficulty;
};
