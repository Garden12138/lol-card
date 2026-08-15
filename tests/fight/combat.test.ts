import { describe, expect, it } from "vitest";
import { overlap, worldBox } from "../../src/fight/engine/boxes";
import { justiceDamage } from "../../src/fight/engine/combat";
import { createFight } from "../../src/fight/engine/createFight";
import { tick } from "../../src/fight/engine/tick";
import { EMPTY_INPUT, INTRO_FRAMES, MAX_HEALTH, type InputBits } from "../../src/fight/engine/types";

function empty(): InputBits {
  return { ...EMPTY_INPUT };
}

describe("判定与伤害", () => {
  it("面向翻转命中框", () => {
    const right = worldBox(100, 0, 1, { x: 10, y: 0, w: 20, h: 10 });
    const left = worldBox(100, 0, -1, { x: 10, y: 0, w: 20, h: 10 });
    expect(right.x).toBe(110);
    expect(left.x).toBe(70);
    expect(overlap(right, { x: 115, y: 0, w: 10, h: 10 })).toBe(true);
  });

  it("残血时德玛西亚正义加伤", () => {
    expect(justiceDamage(220, 200)).toBeGreaterThan(220);
  });

  it("近身轻拳能扣血", () => {
    let state = createFight({ p1: "Ahri", p2: "Garen", versus: "local", aiDifficulty: "easy" });
    for (let index = 0; index < INTRO_FRAMES + 1; index += 1) state = tick(state, empty(), empty());
    state.fighters[0].x = 500;
    state.fighters[1].x = 540;
    state = tick(state, { ...empty(), lp: true }, empty());
    for (let index = 0; index < 8; index += 1) state = tick(state, empty(), empty());
    expect(state.fighters[1].health).toBeLessThan(MAX_HEALTH);
  });
});
