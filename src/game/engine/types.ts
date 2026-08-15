export type PlayerId = number;
export type Identity = "baron" | "vanguard" | "invader" | "shadow";
export type GameMode = "identity" | "duel" | "team";
export type Controller = "human" | "ai";

export interface MatchConfig {
  mode: GameMode;
  seed: number;
  seatCount: 2 | 4;
  controllers: Controller[];
}
export type Suit = "spade" | "heart" | "club" | "diamond";
export type Phase =
  | "pick"
  | "ready"
  | "judge"
  | "draw"
  | "play"
  | "discard"
  | "end"
  | "gameOver";

export type CardKind =
  | "strike"
  | "dodge"
  | "heal"
  | "barrier"
  | "supply"
  | "smite"
  | "plunder"
  | "duel"
  | "stun"
  | "minionWave"
  | "volley"
  | "doransBlade"
  | "infinityEdge"
  | "adaptiveHelm"
  | "thornmail"
  | "boots"
  | "gargoyle";

export type SkillId =
  | "garen-perseverance"
  | "ahri-charm"
  | "yasuo-steel-tempest"
  | "thresh-death-sentence"
  | "jinx-get-excited"
  | "darius-noxian-might"
  | "lux-final-spark"
  | "zed-death-mark"
  | "leona-solar-flare"
  | "soraka-astral-infusion"
  | "template-tank"
  | "template-fighter"
  | "template-assassin"
  | "template-mage"
  | "template-marksman"
  | "template-support";

export type SkillKind = "locked" | "active" | "limited";

export interface GameCard {
  id: string;
  kind: CardKind;
  suit: Suit;
  rank: number;
}

export interface EquipmentSlots {
  weapon?: GameCard;
  armor?: GameCard;
  offensiveMount?: GameCard;
  defensiveMount?: GameCard;
}

export interface PlayerState {
  id: PlayerId;
  identity: Identity;
  championId: string;
  hp: number;
  maxHp: number;
  hand: GameCard[];
  equipment: EquipmentSlots;
  judged: GameCard[];
  skillUsedThisTurn: boolean;
  limitedUsed: boolean;
  damagedThisTurn: boolean;
  cannotDodgeUntilTurnEnd: boolean;
  extraDodgeRequired: number;
  unlimitedStrikeThisTurn: boolean;
  alive: boolean;
  candidates: string[];
  controller: Controller;
}

export type PromptKind =
  | "pickChampion"
  | "playCard"
  | "discardToHp"
  | "respondDodge"
  | "respondBarrier"
  | "respondDuelStrike"
  | "respondLux"
  | "respondMinionWave"
  | "respondVolley"
  | "dyingHeal"
  | "chooseCardInArea"
  | "chooseTarget"
  | "gameOver";

export interface Prompt {
  kind: PromptKind;
  actor: PlayerId;
  source?: PlayerId;
  cardId?: string;
  legalCardIds: string[];
  legalTargetIds: PlayerId[];
  canCancel: boolean;
  message: string;
  area?: "hand" | "equip" | "any";
  revealedSuit?: Suit;
  duelA?: PlayerId;
  duelB?: PlayerId;
  aoeRemaining?: PlayerId[];
  extraDodgesNeeded?: number;
}

export type StackKind =
  | "trick"
  | "strike"
  | "dying"
  | "duel"
  | "aoe"
  | "lux"
  | "smite"
  | "plunder"
  | "thresh";

export interface EffectFrame {
  kind: StackKind;
  card?: GameCard;
  source: PlayerId;
  target?: PlayerId;
  remaining: PlayerId[];
  extraDodgesNeeded?: number;
  virtualStrike?: boolean;
  skillId?: SkillId;
}

export type PendingChoice =
  | {
      type: "equipOrHand";
      source: PlayerId;
      target: PlayerId;
      take: boolean;
    }
  | {
      type: "luxDiscard";
      source: PlayerId;
      target: PlayerId;
      suit: Suit;
    }
  | {
      type: "ahriCard";
      source: PlayerId;
    }
  | {
      type: "sorakaCard";
      source: PlayerId;
      target: PlayerId;
    };

export interface GameState {
  config: MatchConfig;
  rngSeed: number;
  rngState: number;
  phase: Phase;
  currentPlayer: PlayerId;
  players: PlayerState[];
  deck: GameCard[];
  discard: GameCard[];
  prompt: Prompt;
  log: string[];
  winner: "baronSide" | "invaders" | "shadow" | "duel" | "blue" | "red" | null;
  winnerSeat?: PlayerId;
  strikeUsedThisTurn: boolean;
  skipPlayPhase: boolean;
  stack: EffectFrame[];
  pending: PendingChoice | null;
  turnCount: number;
}

export type Action =
  | { type: "pickChampion"; player: PlayerId; championId: string }
  | { type: "playCard"; player: PlayerId; cardId: string; targetId?: PlayerId }
  | { type: "useSkill"; player: PlayerId; targetId?: PlayerId; cardId?: string }
  | { type: "respond"; player: PlayerId; cardId?: string }
  | { type: "endPlay"; player: PlayerId }
  | { type: "discard"; player: PlayerId; cardIds: string[] };

export type Winner = GameState["winner"];
