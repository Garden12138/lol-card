export type PlayerId = 0 | 1;
export type Controller = "human" | "ai";
export type Phase = "draw" | "standby" | "main1" | "battle" | "main2" | "end" | "gameOver";
export type BattleStep = "start" | "battle" | "damage" | "end";
export type Attribute = "LIGHT" | "DARK" | "FIRE" | "WATER" | "EARTH" | "WIND";
export type Race =
  | "Warrior"
  | "Spellcaster"
  | "Beast"
  | "Dragon"
  | "Machine"
  | "Fiend"
  | "Fairy"
  | "Plant";
export type CardKind = "monster" | "spell" | "trap";
export type MonsterType = "normal" | "effect" | "fusion" | "synchro" | "xyz";
export type SpellType = "normal" | "quick" | "continuous" | "equip" | "field";
export type TrapType = "normal" | "continuous";
export type SpellSpeed = 1 | 2;
export type Position = "atk" | "def";
export type Face = "up" | "down";
export type ResolveId =
  | "destroyTarget"
  | "damageLp"
  | "atkBuff"
  | "draw"
  | "addFromGy"
  | "specialSummonHand"
  | "fusionSummon"
  | "negateAttack"
  | "protectDestroy"
  | "returnToHand"
  | "changeToDef"
  | "setFromDeck"
  | "equipBuff"
  | "destroySpellTrap"
  | "detachDestroy"
  | "detachDamage"
  | "none";

export type PromptKind =
  | "free"
  | "respond"
  | "tribute"
  | "target"
  | "attackTarget"
  | "fusionMaterials";

export interface CardDef {
  id: string;
  name: string;
  kind: CardKind;
  championId?: string;
  level?: number;
  atk?: number;
  def?: number;
  attr?: Attribute;
  race?: Race;
  monsterType?: MonsterType;
  tuner?: boolean;
  rank?: number;
  xyzCount?: 2;
  detachCost?: number;
  fusionMaterials?: [string, string];
  spellType?: SpellType;
  trapType?: TrapType;
  speed: SpellSpeed;
  text: string;
  resolve: ResolveId;
  resolveValue?: number;
}

export interface CardInstance {
  uid: string;
  defId: string;
  owner: PlayerId;
  position: Position;
  face: Face;
  summonedThisTurn: boolean;
  attackedThisTurn: boolean;
  changedThisTurn: boolean;
  atkBuff: number;
  protectedUntilEnd: boolean;
  equippedTo?: string;
  overlays?: CardInstance[];
}

export interface PlayerState {
  id: PlayerId;
  lp: number;
  controller: Controller;
  deckId: string;
  deck: CardInstance[];
  hand: CardInstance[];
  gy: CardInstance[];
  banished: CardInstance[];
  extra: CardInstance[];
  monsters: (CardInstance | null)[];
  spells: (CardInstance | null)[];
  field: CardInstance | null;
}

export interface ChainLink {
  uid: string;
  defId: string;
  effect: ResolveId;
  controller: PlayerId;
  targets: string[];
  fusionId?: string;
  materials?: string[];
}

export interface AttackState {
  attackerUid: string;
  targetUid: string | "direct";
  negated: boolean;
}

export interface Prompt {
  kind: PromptKind;
  actor: PlayerId;
}

export type Action =
  | {
      type: "normalSummon";
      uid: string;
      zone: number;
      tributes: string[];
    }
  | {
      type: "setMonster";
      uid: string;
      zone: number;
      tributes: string[];
    }
  | { type: "changePosition"; uid: string }
  | { type: "setSpellTrap"; uid: string; zone: number }
  | {
      type: "activate";
      uid: string;
      targets: string[];
      fusionId?: string;
      materials?: string[];
    }
  | { type: "attack"; attackerUid: string; targetUid: string | "direct" }
  | { type: "synchroSummon"; extraId: string; materials: string[]; zone: number }
  | { type: "xyzSummon"; extraId: string; materials: string[]; zone: number }
  | { type: "respondPass" }
  | { type: "nextPhase" };

export interface DuelState {
  seed: number;
  rng: number;
  turn: number;
  turnPlayer: PlayerId;
  phase: Phase;
  battleStep: BattleStep | null;
  attack: AttackState | null;
  chain: ChainLink[];
  respondPassed: number;
  prompt: Prompt;
  players: [PlayerState, PlayerState];
  winner: PlayerId | null;
  winReason: "lp" | "deckout" | null;
  log: string[];
  normalSummonUsed: boolean;
  uidSeq: number;
}
