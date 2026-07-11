export const CHAMPION_TAGS = [
  "Fighter",
  "Mage",
  "Assassin",
  "Tank",
  "Marksman",
  "Support",
] as const;

export type ChampionTag = (typeof CHAMPION_TAGS)[number];

export type AbilitySlot = "P" | "Q" | "W" | "E" | "R";

export interface SkinEdition {
  id: string;
  num: number;
  name: string;
  isBase: boolean;
  splashUrl: string;
  loadingUrl: string;
}

export interface Ability {
  slot: AbilitySlot;
  name: string;
  description: string;
  iconUrl: string;
}

export interface ChampionInfo {
  attack: number;
  defense: number;
  magic: number;
  difficulty: number;
}

export interface ChampionStats {
  hp: number;
  mp: number;
  movespeed: number;
  armor: number;
  spellblock: number;
  attackrange: number;
  attackdamage: number;
  attackspeed: number;
}

export interface ChampionCard {
  /** Data Dragon's stable English identifier, for example `Ahri`. */
  id: string;
  /** Riot's stable numeric champion key, serialized as a string. */
  key: string;
  name: string;
  title: string;
  lore: string;
  tags: ChampionTag[];
  info: ChampionInfo;
  stats: ChampionStats;
  passive: Ability;
  spells: Ability[];
  skins: SkinEdition[];
  iconUrl: string;
}

export interface ChampionDataSnapshot {
  version: string;
  locale: "zh_CN";
  generatedAt: string;
  champions: ChampionCard[];
}

export type CardEditionKey = `${string}:${number}`;
