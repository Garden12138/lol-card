import { describe, expect, it } from "vitest";
import { viewFor } from "../../src/game/engine/view";
import { createMatch } from "../../src/game/engine/createMatch";
import { pickAll } from "./helpers";

describe("viewFor", () => {
  it("hides another player's real hand kinds", () => {
    const state = pickAll(createMatch(11));
    const viewer = state.currentPlayer;
    const other = (viewer + 1) % state.players.length;
    state.players[other]!.hand = [
      { id: "secret", kind: "heal", suit: "heart", rank: 7 },
    ];
    const view = viewFor(state, viewer);
    expect(view.players[other]!.hand[0]!.kind).toBe("strike");
    expect(view.players[other]!.hand[0]!.rank).toBe(0);
    expect(view.players[viewer]!.hand.length).toBe(state.players[viewer]!.hand.length);
  });
});
