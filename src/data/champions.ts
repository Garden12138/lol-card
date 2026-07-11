import generatedData from "./champions.generated.json";
import type {
  CardEditionKey,
  ChampionCard,
  ChampionDataSnapshot,
  SkinEdition,
} from "../types/cards";

export const championData = generatedData as ChampionDataSnapshot;

function runtimeAssetUrl(url: string): string {
  if (!import.meta.env.DEV || !url.startsWith("https://ddragon.leagueoflegends.com/")) {
    return url;
  }

  return `/ddragon${new URL(url).pathname}`;
}

function withRuntimeAssetUrls(champion: ChampionCard): ChampionCard {
  return {
    ...champion,
    iconUrl: runtimeAssetUrl(champion.iconUrl),
    passive: { ...champion.passive, iconUrl: runtimeAssetUrl(champion.passive.iconUrl) },
    spells: champion.spells.map((spell) => ({ ...spell, iconUrl: runtimeAssetUrl(spell.iconUrl) })),
    skins: champion.skins.map((skin) => ({
      ...skin,
      splashUrl: runtimeAssetUrl(skin.splashUrl),
      loadingUrl: runtimeAssetUrl(skin.loadingUrl),
    })),
  };
}

export const champions = championData.champions.map(withRuntimeAssetUrls);
export const dataVersion = championData.version;
export const championById = new Map(
  champions.map((champion) => [champion.id.toLowerCase(), champion] as const),
);

export function getChampionById(id: string): ChampionCard | undefined {
  return championById.get(id.toLowerCase());
}

export function getSkinByNum(
  champion: ChampionCard,
  skinNum: number,
): SkinEdition | undefined {
  return champion.skins.find((skin) => skin.num === skinNum);
}

export function toCardEditionKey(
  championId: string,
  skinNum: number,
): CardEditionKey {
  return `${championId}:${skinNum}`;
}
