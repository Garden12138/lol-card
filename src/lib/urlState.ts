import type { CardEditionKey, ChampionCard } from "../types/cards";

export const MAX_COMPARE_CARDS = 6;

export type UrlState = {
  championId: string;
  skinNum: number;
  compareKeys: CardEditionKey[];
  mode: "gallery" | "play" | "fight" | "ygo";
};

type CardSelection = Pick<UrlState, "championId" | "skinNum">;

const DEFAULT_CHAMPION_ID = "Ahri";
const CHAMPION_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;
const SKIN_NUM_PATTERN = /^(0|[1-9]\d*)$/;

function parseSkinNum(value: string | null): number | null {
  if (value === null || !SKIN_NUM_PATTERN.test(value)) return null;

  const skinNum = Number(value);
  return Number.isSafeInteger(skinNum) ? skinNum : null;
}

function getDefaultSelection(
  champions: readonly ChampionCard[],
  requestedChampionId: string,
): CardSelection {
  const champion =
    champions.find(({ id }) => id === requestedChampionId) ?? champions[0];
  const skin = champion?.skins.find(({ isBase }) => isBase) ?? champion?.skins[0];

  return {
    championId: champion?.id ?? requestedChampionId,
    skinNum: skin?.num ?? 0,
  };
}

export function toCardEditionKey(
  championId: string,
  skinNum: number,
): CardEditionKey {
  if (
    !CHAMPION_ID_PATTERN.test(championId) ||
    !Number.isSafeInteger(skinNum) ||
    skinNum < 0
  ) {
    throw new TypeError("Invalid card edition key");
  }

  return `${championId}:${skinNum}` as CardEditionKey;
}

export function parseCardEditionKey(value: string): CardSelection | null {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex !== value.lastIndexOf(":")) return null;

  const championId = value.slice(0, separatorIndex);
  const skinNum = parseSkinNum(value.slice(separatorIndex + 1));
  if (!CHAMPION_ID_PATTERN.test(championId) || skinNum === null) return null;

  return { championId, skinNum };
}

function getSearchParams(search: string): URLSearchParams {
  const questionMarkIndex = search.indexOf("?");
  const query = questionMarkIndex >= 0 ? search.slice(questionMarkIndex + 1) : search;
  const hashIndex = query.indexOf("#");

  return new URLSearchParams(hashIndex >= 0 ? query.slice(0, hashIndex) : query);
}

/**
 * Parses the gallery URL state against the supplied Data Dragon snapshot.
 * Missing or unknown active editions fall back to Ahri's base skin (or the
 * requested default), while malformed/unknown comparison entries are omitted.
 */
export function parseUrlState(
  search: string,
  champions: readonly ChampionCard[],
  defaultChampionId = DEFAULT_CHAMPION_ID,
): UrlState {
  const params = getSearchParams(search);
  const fallback = getDefaultSelection(champions, defaultChampionId);
  const validEditions = new Set<CardEditionKey>();

  for (const champion of champions) {
    for (const skin of champion.skins) {
      validEditions.add(toCardEditionKey(champion.id, skin.num));
    }
  }

  const requestedChampionId = params.get("champion");
  const requestedSkinNum = parseSkinNum(params.get("skin"));
  const requestedKey =
    requestedChampionId !== null && requestedSkinNum !== null
      ? (`${requestedChampionId}:${requestedSkinNum}` as CardEditionKey)
      : null;

  const active =
    requestedKey !== null && validEditions.has(requestedKey)
      ? { championId: requestedChampionId!, skinNum: requestedSkinNum! }
      : fallback;

  const compareKeys: CardEditionKey[] = [];
  const seen = new Set<CardEditionKey>();

  for (const rawKey of params.getAll("compare")) {
    const parsed = parseCardEditionKey(rawKey);
    if (!parsed) continue;

    const key = toCardEditionKey(parsed.championId, parsed.skinNum);
    if (!validEditions.has(key) || seen.has(key)) continue;

    seen.add(key);
    compareKeys.push(key);
    if (compareKeys.length === MAX_COMPARE_CARDS) break;
  }

  const modeParam = params.get("mode");
  const mode =
    modeParam === "ygo"
      ? "ygo"
      : modeParam === "fight"
        ? "fight"
        : modeParam === "play"
          ? "play"
          : "gallery";

  return { ...active, compareKeys, mode };
}

/** Returns a canonical query string, including the leading question mark. */
export function serializeUrlState(state: UrlState): string {
  const params = new URLSearchParams();
  const championId = CHAMPION_ID_PATTERN.test(state.championId)
    ? state.championId
    : DEFAULT_CHAMPION_ID;
  const skinNum =
    Number.isSafeInteger(state.skinNum) && state.skinNum >= 0 ? state.skinNum : 0;

  params.set("champion", championId);
  params.set("skin", String(skinNum));
  if (state.mode === "play" || state.mode === "fight" || state.mode === "ygo") {
    params.set("mode", state.mode);
  }

  const seen = new Set<CardEditionKey>();
  for (const key of state.compareKeys) {
    if (compareKeyCanBeSerialized(key, seen)) params.append("compare", key);
    if (seen.size === MAX_COMPARE_CARDS) break;
  }

  return `?${params.toString()}`;
}

function compareKeyCanBeSerialized(
  key: CardEditionKey,
  seen: Set<CardEditionKey>,
): boolean {
  if (seen.has(key) || parseCardEditionKey(key) === null) return false;
  seen.add(key);
  return true;
}
