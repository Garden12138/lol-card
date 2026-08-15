import { describe, expect, it } from "vitest";
import { chooseAiAction } from "../../src/game/ai/chooseAction";
import { createMatch } from "../../src/game/engine/createMatch";
import { legalActions, reduce } from "../../src/game/engine/reduce";

describe("chooseAiAction", () => {
  it("only selects legal actions and can finish or run 20 seeds without illegal stalls", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      let state = createMatch(seed * 17);
      for (let step = 0; step < 8000; step += 1) {
        if (state.phase === "gameOver" || state.turnCount >= 200) break;
        const options = legalActions(state);
        expect(options.length, `seed ${seed} step ${step} ${state.prompt.kind}`).toBeGreaterThan(0);
        const action = chooseAiAction(state);
        const encoded = JSON.stringify(action);
        expect(
          options.some((item) => JSON.stringify(item) === encoded),
          `illegal ${encoded} at ${state.prompt.kind} seed ${seed}`,
        ).toBe(true);
        state = reduce(state, action);
      }
      expect(
        state.phase === "gameOver" || state.turnCount >= 200,
        `seed ${seed} phase=${state.phase} turns=${state.turnCount} prompt=${state.prompt.kind}`,
      ).toBe(true);
    }
  });
});
