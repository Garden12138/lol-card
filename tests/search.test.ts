import { describe, expect, it } from "vitest";
import type { ChampionCard, ChampionTag } from "../src/types/cards";
import { searchChampions } from "../src/lib/search";

function champion(
  id: string,
  name: string,
  title: string,
  tags: ChampionTag[],
): ChampionCard {
  return { id, name, title, tags } as ChampionCard;
}

const champions = [
  champion("Ahri", "阿狸", "九尾妖狐", ["Mage", "Assassin"]),
  champion("Garen", "盖伦", "德玛西亚之力", ["Fighter", "Tank"]),
  champion("MissFortune", "厄运小姐", "赏金猎人", ["Marksman"]),
  champion("Lulu", "璐璐", "仙灵女巫", ["Support", "Mage"]),
];

describe("searchChampions", () => {
  it("searches Chinese champion names", () => {
    expect(searchChampions(champions, "阿狸").map(({ id }) => id)).toEqual([
      "Ahri",
    ]);
  });

  it("searches titles", () => {
    expect(searchChampions(champions, "赏金").map(({ id }) => id)).toEqual([
      "MissFortune",
    ]);
  });

  it("searches English ids case-insensitively", () => {
    expect(searchChampions(champions, "  missFORTUNE ").map(({ id }) => id)).toEqual([
      "MissFortune",
    ]);
  });

  it("requires every whitespace-separated search term", () => {
    expect(searchChampions(champions, "Ahri 九尾").map(({ id }) => id)).toEqual([
      "Ahri",
    ]);
  });

  it("filters by the selected Data Dragon tag", () => {
    expect(searchChampions(champions, "", "Mage").map(({ id }) => id)).toEqual([
      "Ahri",
      "Lulu",
    ]);
    expect(searchChampions(champions, "德玛", "Fighter").map(({ id }) => id)).toEqual([
      "Garen",
    ]);
    expect(searchChampions(champions, "阿狸", "Support")).toEqual([]);
  });

  it("keeps source order when no filters are active", () => {
    expect(searchChampions(champions, "", "all")).toEqual(champions);
    expect(searchChampions(champions, "", null)).toEqual(champions);
  });
});
