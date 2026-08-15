import { describe, expect, it } from "vitest";
import { legalActions } from "../../src/ygo/engine/legal";
import { act, duel, passBoth } from "./helpers";

describe("chain", () => {
  it("resolves last-in first-out: spell then trap response", () => {
    let state = duel("shadow", "demacia");
    const ignite = state.players[0].hand.find((card) => card.defId === "ignite");
    if (!ignite) {
      const fromDeck = state.players[0].deck.find((card) => card.defId === "ignite");
      if (fromDeck) {
        state = structuredClone(state);
        state.players[0].deck = state.players[0].deck.filter((card) => card.uid !== fromDeck.uid);
        state.players[0].hand.push(fromDeck);
      }
    }
    const set = legalActions(state).find((action) => {
      if (action.type !== "setSpellTrap") return false;
      const card = state.players[0].hand.find((item) => item.uid === action.uid);
      return card?.defId === "zhonya" || false;
    });
    const activate = legalActions(state).find((action) => action.type === "activate" && state.players[0].hand.some((c) => c.uid === action.uid && c.defId === "ignite"));
    expect(activate).toBeTruthy();
    if (!activate) return;
    state = act(state, activate);
    expect(state.prompt.kind).toBe("respond");
    expect(state.chain).toHaveLength(1);
    state = passBoth(state);
    expect(state.chain).toHaveLength(0);
    expect(state.players[1].lp).toBe(3500);
  });
});
