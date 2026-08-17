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
      ...copies("infinityEdge", 2),
      "summonerRift",
      ...copies("smite", 2),
      ...copies("zhonya", 2),
      "barrier",
      ...copies("hextechFusion", 2),
    ],
    extra: ["demaciaJudgment"],
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
  {
    id: "ionia",
    name: "艾欧尼亚同调",
    blurb: "调整与非调整等级合计，固有同调。",
    main: [
      ...copies("yasuo", 2),
      ...copies("sona", 2),
      ...copies("lulu", 2),
      ...copies("yone", 2),
      ...copies("irelia", 2),
      ...copies("karma", 2),
      ...copies("flash", 2),
      ...copies("exhaust", 2),
      ...copies("windwall", 2),
      ...copies("teleport", 2),
    ],
    extra: ["ioniaDuet", "windMoon", "duskRebirth"],
  },
  {
    id: "noxus",
    name: "诺克萨斯超量",
    blurb: "两只 4 星叠放，卸素材破坏或打伤害。",
    main: [
      ...copies("draven", 2),
      ...copies("katarina", 2),
      ...copies("leblanc", 2),
      ...copies("swain", 2),
      ...copies("talon", 2),
      ...copies("teleport", 2),
      ...copies("ignite", 2),
      ...copies("exhaust", 2),
      ...copies("flash", 2),
      ...copies("smite", 2),
    ],
    extra: ["noxusReign", "noxusBlades"],
  },
  {
    id: "overlay",
    name: "符文叠层",
    blurb: "两只同星叠放，取除素材发动超量效果。",
    main: [
      ...copies("garen", 2),
      ...copies("jax", 2),
      ...copies("vi", 2),
      ...copies("caitlyn", 2),
      ...copies("zed", 2),
      ...copies("ahri", 2),
      ...copies("teleport", 2),
      ...copies("smite", 2),
      ...copies("exhaust", 2),
      ...copies("zhonya", 2),
    ],
    extra: ["runeCannon", "noxianStack", "demaciaBanner"],
  },
];

export function getDeck(id: string): PreconDeck {
  const deck = DECKS.find((item) => item.id === id);
  if (!deck) throw new Error(`Unknown deck ${id}`);
  return deck;
}
