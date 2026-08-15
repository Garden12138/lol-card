import type { SkillId, SkillKind } from "../engine/types";

export interface GameChampionDef {
  championId: string;
  maxHp: 3 | 4;
  skillId: SkillId;
  skillKind: SkillKind;
  skillName: string;
  skillText: string;
}

export const GAME_CHAMPIONS: GameChampionDef[] = [
  {
    championId: "Garen",
    maxHp: 4,
    skillId: "garen-perseverance",
    skillKind: "locked",
    skillName: "坚韧",
    skillText: "结束阶段，若你本回合未受到伤害，回复 1 点体力。",
  },
  {
    championId: "Ahri",
    maxHp: 3,
    skillId: "ahri-charm",
    skillKind: "active",
    skillName: "魅惑",
    skillText: "出牌阶段限一次，弃置一张牌，视为对攻击范围内一名角色使用一张普攻，需两张闪避才能抵消。",
  },
  {
    championId: "Yasuo",
    maxHp: 3,
    skillId: "yasuo-steel-tempest",
    skillKind: "locked",
    skillName: "斩钢",
    skillText: "你可以将一张闪避当普攻使用。",
  },
  {
    championId: "Thresh",
    maxHp: 3,
    skillId: "thresh-death-sentence",
    skillKind: "active",
    skillName: "死神宣判",
    skillText: "出牌阶段限一次，将一名其他角色装备区的一张牌收入你的手牌。",
  },
  {
    championId: "Jinx",
    maxHp: 3,
    skillId: "jinx-get-excited",
    skillKind: "locked",
    skillName: "暴走",
    skillText: "当你杀死一名角色后，摸三张牌。",
  },
  {
    championId: "Darius",
    maxHp: 4,
    skillId: "darius-noxian-might",
    skillKind: "locked",
    skillName: "诺克萨斯之力",
    skillText: "你对体力值不大于 2 的角色使用的普攻不能被闪避。",
  },
  {
    championId: "Lux",
    maxHp: 3,
    skillId: "lux-final-spark",
    skillKind: "active",
    skillName: "终极闪光",
    skillText: "出牌阶段限一次，展示一张手牌并选择攻击范围内一名角色，其需弃置一张同花色牌，否则受到 1 点伤害。",
  },
  {
    championId: "Zed",
    maxHp: 3,
    skillId: "zed-death-mark",
    skillKind: "limited",
    skillName: "禁奥义",
    skillText: "限定技，出牌阶段，失去 1 点体力，本回合你使用普攻无次数限制。",
  },
  {
    championId: "Leona",
    maxHp: 4,
    skillId: "leona-solar-flare",
    skillKind: "active",
    skillName: "日炎耀斑",
    skillText: "出牌阶段限一次，选择攻击范围内一名角色，直到回合结束其不能使用闪避。",
  },
  {
    championId: "Soraka",
    maxHp: 3,
    skillId: "soraka-astral-infusion",
    skillKind: "active",
    skillName: "星体恩典",
    skillText: "出牌阶段限一次，弃置一张牌，令一名已受伤角色回复 1 点体力。",
  },
];

export function getGameChampion(championId: string): GameChampionDef | undefined {
  return GAME_CHAMPIONS.find((item) => item.championId === championId);
}
