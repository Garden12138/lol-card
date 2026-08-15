import { describe, expect, it } from "vitest";
import { CARDS } from "../../src/ygo/data/cards";
import { DECKS } from "../../src/ygo/data/decks";
import { MAIN_SIZE } from "../../src/ygo/engine/createDuel";

describe("ygo roster", () => {
  it("has a first-slice pool of at least 36 original cards", () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(36);
  });

  it("keeps precon mains at 20 cards", () => {
    for (const deck of DECKS) {
      expect(deck.main).toHaveLength(MAIN_SIZE);
    }
  });
});
