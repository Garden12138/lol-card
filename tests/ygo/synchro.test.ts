import { describe, expect, it } from "vitest";
import { legalActions } from "../../src/ygo/engine/legal";
import { occupiedMonsters } from "../../src/ygo/engine/helpers";
import { act, duel, moveToHand, must, passBoth } from "./helpers";

function summonThenTeleportYone() {
  let state = duel("ionia", "demacia");
  state = act(state, must(state, (action) => action.type === "normalSummon"));
  state = moveToHand(state, 0, "yone");
  state = moveToHand(state, 0, "teleport");
  state = moveToHand(state, 0, "teleport");
  const yone = state.players[0].hand.find((card) => card.defId === "yone");
  const teleport = must(
    state,
    (action) =>
      action.type === "activate" &&
      action.targets[0] === yone?.uid &&
      state.players[0].hand.some((card) => card.uid === action.uid && card.defId === "teleport"),
  );
  state = act(state, teleport);
  state = passBoth(state);
  return state;
}

describe("synchro", () => {
  it("summons a level 7 synchro from a 3-star tuner and a 4-star non-tuner", () => {
    let state = summonThenTeleportYone();
    const synchro = must(state, (action) => action.type === "synchroSummon" && action.extraId === "windMoon");
    state = act(state, synchro);
    expect(occupiedMonsters(state.players[0]).map((card) => card.defId)).toEqual(["windMoon"]);
    expect(state.players[0].gy.some((card) => card.defId === "yasuo")).toBe(true);
    expect(state.players[0].gy.some((card) => card.defId === "yone")).toBe(true);
  });

  it("has no synchro summon without a tuner", () => {
    let state = duel("demacia", "ionia");
    state = act(state, must(state, (action) => action.type === "normalSummon"));
    expect(legalActions(state).some((action) => action.type === "synchroSummon")).toBe(false);
  });

  it("rejects a level sum that does not match", () => {
    let state = duel("ionia", "demacia");
    state = act(state, must(state, (action) => action.type === "normalSummon"));
    expect(legalActions(state).some((action) => action.type === "synchroSummon")).toBe(false);
  });

  it("cannot normal summon a synchro monster from the extra deck", () => {
    const state = duel("ionia", "demacia");
    const extra = state.players[0].extra[0]!;
    state.players[0].hand.push(extra);
    expect(
      legalActions(state).some(
        (action) => action.type === "normalSummon" && action.uid === extra.uid,
      ),
    ).toBe(false);
  });
});
