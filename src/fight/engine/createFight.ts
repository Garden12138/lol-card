import { getFighterDef } from "../data/roster";
import { EMPTY_INPUT, MAX_HEALTH, ROUND_FRAMES, type FightConfig, type FightState, type Fighter, type FighterId } from "./types";

function makeFighter(id: FighterId, x: number, facing: 1 | -1): Fighter {
  const def = getFighterDef(id);
  return {
    id,
    x,
    y: 0,
    vx: 0,
    vy: 0,
    facing,
    health: MAX_HEALTH,
    meter: 0,
    pose: "idle",
    poseFrame: 0,
    moveId: null,
    hitConnect: false,
    lpChain: 0,
    hitstun: 0,
    blockstun: 0,
    invuln: 0,
    armor: def.id === "Garen" ? 0 : 0,
    knockdown: 0,
    yasuoStacks: 0,
    leeMarked: 0,
    trapped: 0,
    crumple: 0,
  };
}

export function createFight(config: FightConfig): FightState {
  return {
    frame: 0,
    round: 1,
    timer: ROUND_FRAMES,
    wins: [0, 0],
    phase: "intro",
    phaseFrame: 0,
    fighters: [makeFighter(config.p1, 420, 1), makeFighter(config.p2, 980, -1)],
    projectiles: [],
    freeze: 0,
    nextProjectileId: 1,
    versus: config.versus,
    aiDifficulty: config.aiDifficulty,
    buffers: [[], []],
    prevInputs: [{ ...EMPTY_INPUT }, { ...EMPTY_INPUT }],
    aiQueue: [],
    combo: 0,
    lastHitBy: null,
  };
}

export function resetRound(state: FightState): FightState {
  const [a, b] = state.fighters;
  return {
    ...state,
    timer: ROUND_FRAMES,
    phase: "intro",
    phaseFrame: 0,
    projectiles: [],
    freeze: 0,
    combo: 0,
    lastHitBy: null,
    fighters: [
      { ...makeFighter(a.id, 420, 1), meter: a.meter },
      { ...makeFighter(b.id, 980, -1), meter: b.meter },
    ],
  };
}
