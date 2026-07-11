import { describe, expect, it } from "vitest";
import type { ChampionCard } from "../src/types/cards";
import {
  MAX_COMPARE_CARDS,
  parseCardEditionKey,
  parseUrlState,
  serializeUrlState,
  type UrlState,
} from "../src/lib/urlState";

function champion(
  id: string,
  skinNums: readonly number[],
  baseSkinNum = 0,
): ChampionCard {
  return {
    id,
    skins: skinNums.map((num) => ({ num, isBase: num === baseSkinNum })),
  } as ChampionCard;
}

const champions = [
  champion("Ahri", [0, 1, 2]),
  champion("Lux", [0, 1]),
  champion("Garen", [0, 1]),
  champion("Jinx", [0]),
  champion("Ashe", [0]),
  champion("Braum", [0]),
  champion("Teemo", [0]),
  champion("Nami", [0]),
];

describe("parseUrlState", () => {
  it("restores the active edition and preserves comparison order", () => {
    const state = parseUrlState(
      "?champion=Lux&skin=1&compare=Ahri%3A2&compare=Lux%3A0",
      champions,
    );

    expect(state).toEqual({
      championId: "Lux",
      skinNum: 1,
      compareKeys: ["Ahri:2", "Lux:0"],
    });
  });

  it("falls back to Ahri's base skin for an invalid active edition", () => {
    expect(parseUrlState("?champion=Unknown&skin=99", champions)).toMatchObject({
      championId: "Ahri",
      skinNum: 0,
    });
    expect(parseUrlState("?champion=Lux&skin=-1", champions)).toMatchObject({
      championId: "Ahri",
      skinNum: 0,
    });
  });

  it("supports another explicit default and its declared base skin", () => {
    const customChampions = [champion("Ahri", [0]), champion("Lux", [0, 7], 7)];
    expect(parseUrlState("", customChampions, "Lux")).toMatchObject({
      championId: "Lux",
      skinNum: 7,
    });
  });

  it("filters malformed and unknown comparisons, then deduplicates exactly", () => {
    const state = parseUrlState(
      "?compare=Ahri%3A0&compare=bad&compare=Ahri%3A0&compare=Ahri%3A999" +
        "&compare=ahri%3A0&compare=Lux%3A1.5&compare=Lux%3A1",
      champions,
    );

    expect(state.compareKeys).toEqual(["Ahri:0", "Lux:1"]);
  });

  it(`limits comparisons to ${MAX_COMPARE_CARDS} entries`, () => {
    const state = parseUrlState(
      "?compare=Ahri%3A0&compare=Lux%3A0&compare=Garen%3A0" +
        "&compare=Jinx%3A0&compare=Ashe%3A0&compare=Braum%3A0" +
        "&compare=Teemo%3A0&compare=Nami%3A0",
      champions,
    );

    expect(state.compareKeys).toEqual([
      "Ahri:0",
      "Lux:0",
      "Garen:0",
      "Jinx:0",
      "Ashe:0",
      "Braum:0",
    ]);
  });
});

describe("edition key helpers", () => {
  it("parses only canonical non-negative integer keys", () => {
    expect(parseCardEditionKey("AurelionSol:12")).toEqual({
      championId: "AurelionSol",
      skinNum: 12,
    });
    expect(parseCardEditionKey("Ahri:-1")).toBeNull();
    expect(parseCardEditionKey("Ahri:01")).toBeNull();
    expect(parseCardEditionKey("Ahri:1:2")).toBeNull();
  });

  it("serializes a canonical, repeatable query string", () => {
    const state: UrlState = {
      championId: "Lux",
      skinNum: 1,
      compareKeys: ["Ahri:0", "Lux:1", "Ahri:0"],
    };

    const serialized = serializeUrlState(state);
    expect(serialized).toBe(
      "?champion=Lux&skin=1&compare=Ahri%3A0&compare=Lux%3A1",
    );
    expect(parseUrlState(serialized, champions)).toEqual({
      championId: "Lux",
      skinNum: 1,
      compareKeys: ["Ahri:0", "Lux:1"],
    });
  });
});
