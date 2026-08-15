import { describe, expect, it } from "vitest";
import { applyWinCheck, loseByDeckout } from "../../src/ygo/engine/win";
import { duel } from "./helpers";

describe("win", () => {
  it("ends the duel when LP hits 0", () => {
    const state = duel();
    state.players[1].lp = 0;
    const next = applyWinCheck(structuredClone(state));
    expect(next.winner).toBe(0);
    expect(next.winReason).toBe("lp");
    expect(next.phase).toBe("gameOver");
  });

  it("ends the duel on deckout", () => {
    const state = duel();
    const next = loseByDeckout(structuredClone(state), 1);
    expect(next.winner).toBe(0);
    expect(next.winReason).toBe("deckout");
  });
});
