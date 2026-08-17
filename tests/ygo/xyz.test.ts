import { describe, expect, it } from "vitest";
import { destroyMonster } from "../../src/ygo/engine/battle";
import { occupiedMonsters } from "../../src/ygo/engine/helpers";
import { legalActions } from "../../src/ygo/engine/legal";
import type { DuelState } from "../../src/ygo/engine/types";
import { act, duel, moveToHand, must, passBoth } from "./helpers";

function summonThenTeleportFour() {
  let state = duel("overlay", "demacia");
  state = act(state, must(state, (action) => action.type === "normalSummon"));
  const four = state.players[0].hand.find((card) => card.defId !== "teleport");
  state = moveToHand(state, 0, "teleport");
  const teleport = must(
    state,
    (action) =>
      action.type === "activate" &&
      action.targets[0] === four?.uid &&
      state.players[0].hand.some((card) => card.uid === action.uid && card.defId === "teleport"),
  );
  state = act(state, teleport);
  return passBoth(state);
}

function xyzCannon(): DuelState {
  const state = summonThenTeleportFour();
  return act(state, must(state, (action) => action.type === "xyzSummon" && action.extraId === "runeCannon"));
}

describe("xyz", () => {
  it("overlays two face-up level 4s under a rank 4 and keeps materials off the gy", () => {
    const state = xyzCannon();
    const cannon = occupiedMonsters(state.players[0])[0]!;
    expect(cannon.defId).toBe("runeCannon");
    expect(cannon.overlays).toHaveLength(2);
    expect(state.players[0].gy.some((card) => cannon.overlays?.some((m) => m.uid === card.uid))).toBe(false);
  });

  it("rejects xyz when face-up monsters have different levels", () => {
    let state = duel("overlay", "demacia");
    state = act(state, must(state, (action) => action.type === "normalSummon"));
    const next = structuredClone(state);
    next.players[0].monsters[1] = {
      uid: "planted-darius",
      defId: "darius",
      owner: 0,
      position: "atk",
      face: "up",
      summonedThisTurn: false,
      attackedThisTurn: false,
      changedThisTurn: false,
      atkBuff: 0,
      protectedUntilEnd: false,
      overlays: [],
    };
    expect(legalActions(next).some((action) => action.type === "xyzSummon")).toBe(false);
  });

  it("cannot normal summon an xyz monster from the extra deck", () => {
    const state = duel("overlay", "demacia");
    const extra = state.players[0].extra[0]!;
    state.players[0].hand.push(extra);
    expect(
      legalActions(state).some((action) => action.type === "normalSummon" && action.uid === extra.uid),
    ).toBe(false);
  });

  it("detaches one overlay to resolve 500 damage", () => {
    let state = xyzCannon();
    const cannon = occupiedMonsters(state.players[0])[0]!;
    state = act(state, must(state, (action) => action.type === "activate" && action.uid === cannon.uid));
    state = passBoth(state);
    expect(occupiedMonsters(state.players[0])[0]?.overlays).toHaveLength(1);
    expect(state.players[1].lp).toBe(3500);
  });

  it("sends overlays to GY when the xyz monster is destroyed", () => {
    const state = structuredClone(xyzCannon());
    const xyzCard = occupiedMonsters(state.players[0])[0]!;
    const overlayIds = xyzCard.overlays?.map((card) => card.defId) ?? [];
    destroyMonster(state, xyzCard);
    expect(occupiedMonsters(state.players[0])).toHaveLength(0);
    const gy = state.players[0].gy.map((card) => card.defId);
    expect(gy).toContain("runeCannon");
    for (const id of overlayIds) expect(gy).toContain(id);
  });
});
