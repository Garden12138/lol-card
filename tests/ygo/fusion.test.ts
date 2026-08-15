import { describe, expect, it } from "vitest";
import { legalActions } from "../../src/ygo/engine/legal";
import { occupiedMonsters } from "../../src/ygo/engine/helpers";
import { act, duel, moveToHand, passBoth } from "./helpers";

describe("fusion", () => {
  it("sends materials to GY and special summons the fusion monster", () => {
    let state = duel("piltover", "demacia");
    state = moveToHand(state, 0, "hextechFusion");
    const fusion = legalActions(state).find((action) => action.type === "activate" && action.fusionId === "piltoverDuo");
    expect(fusion).toBeTruthy();
    if (!fusion) return;
    state = act(state, fusion);
    state = passBoth(state);
    const names = occupiedMonsters(state.players[0]).map((card) => card.defId);
    expect(names).toContain("piltoverDuo");
    expect(state.players[0].gy.some((card) => card.defId === "vi")).toBe(true);
    expect(state.players[0].gy.some((card) => card.defId === "jinx")).toBe(true);
    expect(state.players[0].gy.some((card) => card.defId === "hextechFusion")).toBe(true);
  });

  it("lets Demacia fuse Garen and Lux into Judgment", () => {
    let state = duel("demacia", "shadow");
    state = moveToHand(state, 0, "hextechFusion");
    const fusion = legalActions(state).find(
      (action) => action.type === "activate" && action.fusionId === "demaciaJudgment",
    );
    expect(fusion).toBeTruthy();
    if (!fusion) return;
    state = act(state, fusion);
    state = passBoth(state);
    expect(occupiedMonsters(state.players[0]).some((card) => card.defId === "demaciaJudgment")).toBe(true);
  });
});
