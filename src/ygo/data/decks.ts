export interface PreconDeck {
  id: string;
  name: string;
  blurb: string;
  main: string[];
  extra: string[];
}

function copies(id: string, count: number): string[] {
  return Array.from({ length: count }, () => id);
}

export const DECKS: readonly PreconDeck[] = [
  {
    id: "demacia",
    name: "德玛西亚军势",
    blurb: "战士打手与装备，稳扎稳打。",
    main: [
      ...copies("garen", 2),
      ...copies("poppy", 2),
      ...copies("lux", 2),
      ...copies("jax", 2),
      ...copies("masterYi", 2),
      ...copies("ashe", 2),
      ...copies("infinityEdge", 2),
      "summonerRift",
      ...copies("smite", 2),
      ...copies("zhonya", 2),
      "barrier",
    ],
    extra: [],
  },
  {
    id: "piltover",
    name: "皮城工坊",
    blurb: "海克斯融合召唤皮城双杰。",
    main: [
      ...copies("vi", 2),
      ...copies("jinx", 2),
      ...copies("caitlyn", 2),
      ...copies("blitzcrank", 2),
      ...copies("teemo", 2),
      ...copies("hextechFusion", 3),
      ...copies("flash", 2),
      ...copies("teleport", 2),
      ...copies("barrier", 2),
      "mushroom",
    ],
    extra: copies("piltoverDuo", 2),
  },
  {
    id: "shadow",
    name: "暗影虚空",
    blurb: "法师、特召与双融合路线。",
    main: [
      ...copies("ahri", 2),
      ...copies("syndra", 2),
      ...copies("malzahar", 2),
      ...copies("thresh", 2),
      ...copies("zed", 2),
      "shen",
      "chogath",
      ...copies("hextechFusion", 2),
      ...copies("ignite", 2),
      ...copies("exhaust", 2),
      ...copies("chronoShift", 2),
    ],
    extra: ["shadowTwin", "voidArrival"],
  },
];

export function getDeck(id: string): PreconDeck {
  const deck = DECKS.find((item) => item.id === id);
  if (!deck) throw new Error(`Unknown deck ${id}`);
  return deck;
}
