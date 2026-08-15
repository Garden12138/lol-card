import { describe, expect, it } from "vitest";
import { chooseAiAction } from "../../src/ygo/ai/chooseAction";
import { legalActions } from "../../src/ygo/engine/legal";
import { reduce } from "../../src/ygo/engine/reduce";
import { duel } from "./helpers";

describe("ygo ai", () => {
  it("always returns a currently legal action", () => {
    let state = duel("piltover", "shadow");
    state.players[1].controller = "ai";
    for (let i = 0; i < 30; i += 1) {
      if (state.phase === "gameOver") break;
      const actions = legalActions(state);
      if (actions.length === 0) break;
      const action = chooseAiAction(state);
      expect(actions).toContainEqual(action);
      state = reduce(state, action);
    }
  });
});
