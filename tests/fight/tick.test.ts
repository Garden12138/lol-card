import { describe, expect, it } from "vitest";
import { createFight } from "../../src/fight/engine/createFight";
import { tick } from "../../src/fight/engine/tick";
import { EMPTY_INPUT, INTRO_FRAMES, type FightState, type InputBits } from "../../src/fight/engine/types";

function empty(): InputBits {
  return { ...EMPTY_INPUT };
}

function run(state: FightState, frames: number, p1 = empty(), p2 = empty()): FightState {
  let current = state;
  for (let index = 0; index < frames; index += 1) current = tick(current, p1, p2);
  return current;
}

function afterIntro(versus: "ai" | "local" = "local"): FightState {
  return run(createFight({ p1: "Ahri", p2: "Garen", versus, aiDifficulty: "easy" }), INTRO_FRAMES + 1);
}

describe("格斗步进", () => {
  it("开局前摇结束后进入 fight，向前走会增加 x", () => {
    const started = afterIntro();
    expect(started.phase).toBe("fight");
    const moved = run(started, 20, { ...empty(), right: true });
    expect(moved.fighters[0].x).toBeGreaterThan(started.fighters[0].x);
  });

  it("236+拳会打出阿狸宝珠", () => {
    let state = afterIntro();
    const seq: InputBits[] = [
      { ...empty(), down: true },
      { ...empty(), down: true, right: true },
      { ...empty(), right: true },
      { ...empty(), right: true, lp: true },
    ];
    for (const input of seq) state = tick(state, input, empty());
    state = run(state, 16, empty());
    expect(state.projectiles.length).toBeGreaterThan(0);
    expect(state.fighters[0].pose).toBe("special");
  });

  it("跳跃后 y 会离开地面", () => {
    const jumped = run(afterIntro(), 4, { ...empty(), up: true });
    expect(jumped.fighters[0].y).toBeGreaterThan(0);
    expect(jumped.fighters[0].pose).toBe("jump");
  });
});
