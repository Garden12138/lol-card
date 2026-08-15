import { describe, expect, it } from "vitest";
import { createFight } from "../../src/fight/engine/createFight";
import { tick } from "../../src/fight/engine/tick";
import { EMPTY_INPUT, INTRO_FRAMES, KO_FRAMES, WINS_NEEDED } from "../../src/fight/engine/types";

const empty = { ...EMPTY_INPUT };

describe("回合胜负", () => {
  it("一方生命归零后进入 KO，两胜结束比赛", () => {
    let state = createFight({ p1: "Ahri", p2: "Garen", versus: "local", aiDifficulty: "easy" });
    for (let index = 0; index < INTRO_FRAMES + 1; index += 1) state = tick(state, empty, empty);
    state.fighters[1].health = 0;
    state = tick(state, empty, empty);
    expect(state.phase).toBe("ko");
    for (let index = 0; index < KO_FRAMES; index += 1) state = tick(state, empty, empty);
    expect(state.wins[0]).toBe(1);
    expect(state.round).toBe(2);

    for (let index = 0; index < INTRO_FRAMES + 1; index += 1) state = tick(state, empty, empty);
    state.fighters[1].health = 0;
    state = tick(state, empty, empty);
    for (let index = 0; index < KO_FRAMES; index += 1) state = tick(state, empty, empty);
    expect(state.wins[0]).toBe(WINS_NEEDED);
    expect(state.phase).toBe("matchOver");
  });

  it("超时比较剩余生命", () => {
    let state = createFight({ p1: "Lux", p2: "Ezreal", versus: "local", aiDifficulty: "easy" });
    for (let index = 0; index < INTRO_FRAMES + 1; index += 1) state = tick(state, empty, empty);
    state.timer = 1;
    state.fighters[0].health = 800;
    state.fighters[1].health = 400;
    state = tick(state, empty, empty);
    expect(state.phase).toBe("timeout");
    for (let index = 0; index < KO_FRAMES; index += 1) state = tick(state, empty, empty);
    expect(state.wins[0]).toBe(1);
  });
});
