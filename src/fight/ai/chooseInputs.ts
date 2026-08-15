import { EMPTY_INPUT, type FightState, type InputBits } from "../engine/types";
import { getFighterDef } from "../data/roster";

function hold(partial: Partial<InputBits>): InputBits {
  return { ...EMPTY_INPUT, ...partial };
}

function motion236P(): InputBits[] {
  return [hold({ down: true }), hold({ down: true, right: true }), hold({ right: true }), hold({ right: true, lp: true })];
}

function motion623P(): InputBits[] {
  return [hold({ right: true }), hold({ down: true }), hold({ down: true, right: true, lp: true })];
}

function flip(input: InputBits, facing: 1 | -1): InputBits {
  if (facing === 1) return input;
  return { ...input, left: input.right, right: input.left };
}

export function chooseAiInputs(state: FightState, _humanP2: InputBits): InputBits {
  if (state.aiQueue.length > 0) {
    return state.aiQueue.shift() ?? hold({});
  }

  const self = state.fighters[1];
  const foe = state.fighters[0];
  const delay = state.aiDifficulty === "easy" ? 18 : state.aiDifficulty === "normal" ? 8 : 3;
  if (state.frame % delay !== 0) return hold({});

  const dist = Math.abs(self.x - foe.x);
  const incoming = state.projectiles.some((shot) => shot.owner === 0 && Math.abs(shot.x - self.x) < 160);
  const jumpIn = foe.y > 40 && dist < 140;
  const facing = self.facing;

  const queue = (frames: InputBits[]) => {
    state.aiQueue.push(...frames.map((frame) => flip(frame, facing)));
  };

  if (state.aiDifficulty !== "easy" && jumpIn) {
    queue(motion623P());
    return state.aiQueue.shift() ?? hold({});
  }

  if (incoming) {
    queue([hold({ left: true }), hold({ left: true }), hold({ left: true, down: true })]);
    return state.aiQueue.shift() ?? hold({});
  }

  if (dist > 220 && getFighterDef(self.id).specials.some((move) => move.kind === "projectile")) {
    queue(motion236P());
    return state.aiQueue.shift() ?? hold({});
  }

  if (dist < 90) {
    if (state.aiDifficulty === "hard" && self.meter >= 100 && Math.random() < 0.2) {
      queue([
        hold({ down: true }),
        hold({ down: true, right: true }),
        hold({ right: true }),
        hold({ down: true }),
        hold({ down: true, right: true }),
        hold({ right: true, hp: true }),
      ]);
      return state.aiQueue.shift() ?? hold({});
    }
    queue([hold({ lp: true }), hold({}), hold({ hp: true })]);
    return state.aiQueue.shift() ?? hold({});
  }

  if (state.aiDifficulty === "easy" && Math.random() < 0.2) {
    queue([hold({ up: true, right: true })]);
    return state.aiQueue.shift() ?? hold({});
  }

  const walk = foe.x < self.x ? hold({ left: true }) : hold({ right: true });
  queue([walk, walk, walk]);
  return state.aiQueue.shift() ?? hold({});
}
