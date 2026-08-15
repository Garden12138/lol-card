import type { CardKind, Identity, Winner } from "../engine/types";

export const GAME_TITLE = "峡谷身份战";

export const IDENTITY_NAMES: Record<Identity, string> = {
  baron: "男爵",
  vanguard: "先锋",
  invader: "入侵者",
  shadow: "影刃",
};

export const CARD_NAMES: Record<CardKind, string> = {
  strike: "普攻",
  dodge: "闪避",
  heal: "治疗",
  barrier: "屏障",
  supply: "补给",
  smite: "惩戒",
  plunder: "掠夺",
  duel: "单挑",
  stun: "晕眩",
  minionWave: "小兵潮",
  volley: "齐射",
  doransBlade: "多兰之刃",
  infinityEdge: "无尽之刃",
  adaptiveHelm: "自适应头盔",
  thornmail: "荆棘之甲",
  boots: "疾行之靴",
  gargoyle: "石像鬼板甲",
};

export const WINNER_NAMES: Record<NonNullable<Winner>, string> = {
  baronSide: "男爵阵营",
  invaders: "入侵者",
  shadow: "影刃",
};

export const SUIT_SYMBOL = {
  spade: "♠",
  heart: "♥",
  club: "♣",
  diamond: "♦",
} as const;
