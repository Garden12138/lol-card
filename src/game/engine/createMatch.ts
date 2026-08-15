import { GAME_CHAMPIONS, getGameChampion } from "../data/champions";
import { IDENTITY_NAMES } from "../data/copy";
import { buildDeck, shuffleDeck } from "./deck";
import { beginTurn } from "./effects";
import { shuffleInPlace } from "./rng";
import type { GameState, Identity, PlayerId, PlayerState, Prompt } from "./types";

const IDENTITIES: Identity[] = ["baron", "vanguard", "invader", "shadow"];

function emptyPlayer(id: PlayerId, identity: Identity, candidates: string[]): PlayerState {
  return {
    id,
    identity,
    championId: "",
    hp: 0,
    maxHp: 0,
    hand: [],
    equipment: {},
    judged: [],
    skillUsedThisTurn: false,
    limitedUsed: false,
    damagedThisTurn: false,
    cannotDodgeUntilTurnEnd: false,
    extraDodgeRequired: 0,
    unlimitedStrikeThisTurn: false,
    alive: true,
    candidates,
  };
}

function pickPrompt(actor: PlayerId, candidates: string[]): Prompt {
  return {
    kind: "pickChampion",
    actor,
    legalCardIds: [],
    legalTargetIds: [],
    canCancel: false,
    message: `请选择英雄（${candidates.join(" / ")}）`,
  };
}

export function createMatch(seed: number): GameState {
  let rngState = seed >>> 0;
  const identities = [...IDENTITIES];
  rngState = shuffleInPlace(identities, rngState);
  const pool = GAME_CHAMPIONS.map((item) => item.championId);
  rngState = shuffleInPlace(pool, rngState);
  const shuffled = shuffleDeck(buildDeck(), rngState);
  rngState = shuffled.rngState;
  const players: PlayerState[] = [0, 1, 2, 3].map((id) => {
    const candidates = pool.splice(0, 2);
    return emptyPlayer(id as PlayerId, identities[id]!, candidates);
  });
  const baron = players.find((item) => item.identity === "baron")!;
  return {
    rngSeed: seed,
    rngState,
    phase: "pick",
    currentPlayer: baron.id,
    players,
    deck: shuffled.deck,
    discard: [],
    prompt: pickPrompt(baron.id, baron.candidates),
    log: [`对局开始，男爵是座位 ${baron.id}（${IDENTITY_NAMES.baron}）。`],
    winner: null,
    strikeUsedThisTurn: false,
    skipPlayPhase: false,
    stack: [],
    pending: null,
    turnCount: 0,
  };
}

export function applyPick(state: GameState, playerId: PlayerId, championId: string): GameState {
  const seat = state.players[playerId]!;
  if (state.phase !== "pick" || state.prompt.actor !== playerId) return state;
  if (!seat.candidates.includes(championId) || seat.championId) return state;
  const def = getGameChampion(championId);
  if (!def) return state;
  seat.championId = championId;
  const baronBonus = seat.identity === "baron" ? 1 : 0;
  seat.maxHp = (def.maxHp + baronBonus) as number;
  seat.hp = seat.maxHp;
  const nextPicker = [1, 2, 3]
    .map((step) => state.players[((playerId + step) % 4) as PlayerId]!)
    .find((item) => !item.championId);
  if (!nextPicker) {
    const baron = state.players.find((item) => item.identity === "baron")!;
    return beginTurn(state, baron.id);
  }
  state.prompt = pickPrompt(nextPicker.id, nextPicker.candidates);
  return state;
}

export { getGameChampion };
