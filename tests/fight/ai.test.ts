import { describe, expect, it } from "vitest";
import { chooseAiInputs } from "../../src/fight/ai/chooseInputs";
import { createFight } from "../../src/fight/engine/createFight";
import { EMPTY_INPUT } from "../../src/fight/engine/types";

describe("格斗 AI", () => {
  it("在可行动帧给出按键位图", () => {
    const state = createFight({ p1: "Ahri", p2: "Garen", versus: "ai", aiDifficulty: "normal" });
    state.phase = "fight";
    state.frame = 8;
    const input = chooseAiInputs(state, { ...EMPTY_INPUT });
    expect(input).toEqual(expect.objectContaining({
      left: expect.any(Boolean),
      right: expect.any(Boolean),
      lp: expect.any(Boolean),
    }));
  });
});
