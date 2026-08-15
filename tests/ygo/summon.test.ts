import { describe, expect, it } from "vitest";
import { MAIN_SIZE, START_HAND, START_LP } from "../../src/ygo/engine/createDuel";
import { legalActions } from "../../src/ygo/engine/legal";
import { act, duel, must } from "./helpers";

describe("createDuel", () => {
  it("starts with 20 cards, 5 in hand, 4000 LP, first turn skip draw", () => {
    const state = duel();
    expect(state.players[0].lp).toBe(START_LP);
    expect(state.players[0].hand.length).toBe(START_HAND);
    expect(state.players[0].deck.length + state.players[0].hand.length).toBe(MAIN_SIZE);
    expect(state.turnPlayer).toBe(0);
    expect(state.phase).toBe("main1");
    expect(state.log.some((line) => line.includes("跳过抽卡"))).toBe(true);
  });
});

describe("summon", () => {
  it("normal summons a level 4 monster", () => {
    const state = duel();
    const summon = must(state, (action) => action.type === "normalSummon");
    const next = act(state, summon);
    expect(next.players[0].monsters.some((card) => card !== null)).toBe(true);
    expect(next.normalSummonUsed).toBe(true);
    expect(legalActions(next).some((action) => action.type === "normalSummon")).toBe(false);
  });

  it("requires tribute for a level 6 monster", () => {
    let state = duel("shadow", "demacia");
    const first = must(state, (action) => action.type === "normalSummon");
    state = act(state, first);
    for (let i = 0; i < 6; i += 1) {
      state = act(state, { type: "nextPhase" });
    }
    expect(state.turnPlayer).toBe(0);
    const tribute = legalActions(state).find(
      (action) => action.type === "normalSummon" && action.tributes.length === 1,
    );
    expect(tribute).toBeTruthy();
    if (!tribute || tribute.type !== "normalSummon") return;
    const next = act(state, tribute);
    expect(next.players[0].gy.length).toBeGreaterThanOrEqual(1);
    expect(next.players[0].monsters.filter(Boolean)).toHaveLength(1);
  });
});
