import type { ChampionCard, ChampionTag } from "../types/cards";

export const CHAMPION_TAG_LABELS: Readonly<Record<ChampionTag, string>> = {
  Fighter: "战士",
  Mage: "法师",
  Assassin: "刺客",
  Tank: "坦克",
  Marksman: "射手",
  Support: "辅助",
};

export type ChampionTagFilter = ChampionTag | "all" | null | undefined;

function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("zh-CN");
}

/**
 * Searches the user-facing Chinese fields and the Data Dragon English id.
 * A selected tag is combined with the text query as an intersection.
 */
export function searchChampions(
  champions: readonly ChampionCard[],
  query = "",
  tag: ChampionTagFilter = "all",
): ChampionCard[] {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);

  return champions.filter((champion) => {
    if (tag && tag !== "all" && !champion.tags.includes(tag)) return false;

    if (terms.length === 0) return true;
    const searchableText = normalizeSearchText(
      `${champion.name} ${champion.title} ${champion.id}`,
    );

    return terms.every((term) => searchableText.includes(term));
  });
}
