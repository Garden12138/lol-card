import { champions } from "../../data/champions";
import type { ChampionTag } from "../../types/cards";
import type { SkillId, SkillKind } from "../engine/types";

export interface GameChampionDef {
  championId: string;
  maxHp: 3 | 4;
  skillId: SkillId;
  skillKind: SkillKind;
  skillName: string;
  skillText: string;
}

const OVERRIDES: Record<string, GameChampionDef> = {
  Garen: {
    championId: "Garen",
    maxHp: 4,
    skillId: "garen-perseverance",
    skillKind: "locked",
    skillName: "坚韧",
    skillText: "结束阶段，若你本回合未受到伤害，回复 1 点体力。",
  },
  Ahri: {
    championId: "Ahri",
    maxHp: 3,
    skillId: "ahri-charm",
    skillKind: "active",
    skillName: "魅惑",
    skillText: "出牌阶段限一次，弃置一张牌，视为对攻击范围内一名角色使用一张普攻，需两张闪避才能抵消。",
  },
  Yasuo: {
    championId: "Yasuo",
    maxHp: 3,
    skillId: "yasuo-steel-tempest",
    skillKind: "locked",
    skillName: "斩钢",
    skillText: "你可以将一张闪避当普攻使用。",
  },
  Thresh: {
    championId: "Thresh",
    maxHp: 3,
    skillId: "thresh-death-sentence",
    skillKind: "active",
    skillName: "死神宣判",
    skillText: "出牌阶段限一次，将一名其他角色装备区的一张牌收入你的手牌。",
  },
  Jinx: {
    championId: "Jinx",
    maxHp: 3,
    skillId: "jinx-get-excited",
    skillKind: "locked",
    skillName: "暴走",
    skillText: "当你杀死一名角色后，摸三张牌。",
  },
  Darius: {
    championId: "Darius",
    maxHp: 4,
    skillId: "darius-noxian-might",
    skillKind: "locked",
    skillName: "诺克萨斯之力",
    skillText: "你对体力值不大于 2 的角色使用的普攻不能被闪避。",
  },
  Lux: {
    championId: "Lux",
    maxHp: 3,
    skillId: "lux-final-spark",
    skillKind: "active",
    skillName: "终极闪光",
    skillText: "出牌阶段限一次，展示一张手牌并选择攻击范围内一名角色，其需弃置一张同花色牌，否则受到 1 点伤害。",
  },
  Zed: {
    championId: "Zed",
    maxHp: 3,
    skillId: "zed-death-mark",
    skillKind: "limited",
    skillName: "禁奥义",
    skillText: "限定技，出牌阶段，失去 1 点体力，本回合你使用普攻无次数限制。",
  },
  Leona: {
    championId: "Leona",
    maxHp: 4,
    skillId: "leona-solar-flare",
    skillKind: "active",
    skillName: "日炎耀斑",
    skillText: "出牌阶段限一次，选择攻击范围内一名角色，直到回合结束其不能使用闪避。",
  },
  Soraka: {
    championId: "Soraka",
    maxHp: 3,
    skillId: "soraka-astral-infusion",
    skillKind: "active",
    skillName: "星体恩典",
    skillText: "出牌阶段限一次，弃置一张牌，令一名已受伤角色回复 1 点体力。",
  },
};

const TEMPLATES: Record<ChampionTag, Omit<GameChampionDef, "championId">> = {
  Tank: {
    maxHp: 4,
    skillId: "template-tank",
    skillKind: "locked",
    skillName: "坚韧",
    skillText: "结束阶段，若你本回合未受到伤害，回复 1 点体力。",
  },
  Fighter: {
    maxHp: 4,
    skillId: "template-fighter",
    skillKind: "locked",
    skillName: "压制",
    skillText: "你对体力值不大于 2 的角色使用的普攻不能被闪避。",
  },
  Assassin: {
    maxHp: 3,
    skillId: "template-assassin",
    skillKind: "limited",
    skillName: "绝杀",
    skillText: "限定技，出牌阶段，失去 1 点体力，本回合你使用普攻无次数限制。",
  },
  Mage: {
    maxHp: 3,
    skillId: "template-mage",
    skillKind: "active",
    skillName: "奥术",
    skillText: "出牌阶段限一次，展示一张手牌并选择攻击范围内一名角色，其需弃置一张同花色牌，否则受到 1 点伤害。",
  },
  Marksman: {
    maxHp: 3,
    skillId: "template-marksman",
    skillKind: "locked",
    skillName: "暴走",
    skillText: "当你杀死一名角色后，摸三张牌。",
  },
  Support: {
    maxHp: 3,
    skillId: "template-support",
    skillKind: "active",
    skillName: "守护",
    skillText: "出牌阶段限一次，弃置一张牌，令一名已受伤角色回复 1 点体力。",
  },
};

function fromGallery(): GameChampionDef[] {
  return champions.map((champion) => {
    const override = OVERRIDES[champion.id];
    if (override) return override;
    const tag = champion.tags[0] ?? "Fighter";
    return { championId: champion.id, ...TEMPLATES[tag] };
  });
}

export const GAME_CHAMPIONS: GameChampionDef[] = fromGallery();

export function getGameChampion(championId: string): GameChampionDef | undefined {
  return GAME_CHAMPIONS.find((item) => item.championId === championId);
}

export function isKillDrawSkill(skillId: SkillId): boolean {
  return skillId === "jinx-get-excited" || skillId === "template-marksman";
}

export function isEndHealSkill(skillId: SkillId): boolean {
  return skillId === "garen-perseverance" || skillId === "template-tank";
}

export function isExecuteStrikeSkill(skillId: SkillId): boolean {
  return skillId === "darius-noxian-might" || skillId === "template-fighter";
}
