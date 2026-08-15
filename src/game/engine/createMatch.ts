import { GAME_CHAMPIONS, getGameChampion } from "../data/champions";
import { IDENTITY_NAMES } from "../data/copy";
import { buildDeck, shuffleDeck } from "./deck";
import { beginTurn } from "./effects";
import { shuffleInPlace } from "./rng";
import type {
  Controller,
  GameState,
  Identity,
  MatchConfig,
  PlayerId,
  PlayerState,
  Prompt,
} from "./types";

const IDENTITIES: Identity[] = ["baron", "vanguard", "invader", "shadow"];

function emptyPlayer(
  id: PlayerId,
  identity: Identity,
  candidates: string[],
  controller: Controller,
): PlayerState {
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
    controller,
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

export function normalizeConfig(seedOrConfig: number | MatchConfig): MatchConfig {
  if (typeof seedOrConfig === "number") {
    return {
      mode: "identity",
      seed: seedOrConfig,
      seatCount: 4,
      controllers: ["human", "ai", "ai", "ai"],
    };
  }
  return seedOrConfig;
}

export function createMatch(seedOrConfig: number | MatchConfig): GameState {
  const config = normalizeConfig(seedOrConfig);
  let rngState = config.seed >>> 0;
  const n = config.seatCount;
  const identities: Identity[] =
    config.mode === "identity"
      ? (() => {
          const pool = [...IDENTITIES];
          rngState = shuffleInPlace(pool, rngState);
          return pool;
        })()
      : Array.from({ length: n }, () => "vanguard" as Identity);
  const pool = GAME_CHAMPIONS.map((item) => item.championId);
  rngState = shuffleInPlace(pool, rngState);
  const shuffled = shuffleDeck(buildDeck(), rngState);
  rngState = shuffled.rngState;
  const players: PlayerState[] = Array.from({ length: n }, (_, id) => {
    const candidates = pool.splice(0, 3);
    return emptyPlayer(id, identities[id]!, candidates, config.controllers[id] ?? "ai");
  });
  const first =
    config.mode === "identity" ? players.find((item) => item.identity === "baron")! : players[0]!;
  const opening =
    config.mode === "identity"
      ? `对局开始，男爵是座位 ${first.id}（${IDENTITY_NAMES.baron}）。`
      : config.mode === "duel"
        ? "1v1 单挑开始。"
        : "2v2 团队战开始。蓝方座位 0/2，红方座位 1/3。";
  return {
    config,
    rngSeed: config.seed,
    rngState,
    phase: "pick",
    currentPlayer: first.id,
    players,
    deck: shuffled.deck,
    discard: [],
    prompt: pickPrompt(first.id, first.candidates),
    log: [opening],
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
  const baronBonus = state.config.mode === "identity" && seat.identity === "baron" ? 1 : 0;
  seat.maxHp = def.maxHp + baronBonus;
  seat.hp = seat.maxHp;
  const n = state.players.length;
  const nextPicker = Array.from({ length: n }, (_, step) => state.players[(playerId + step + 1) % n]!).find(
    (item) => !item.championId,
  );
  if (!nextPicker) {
    const starter =
      state.config.mode === "identity"
        ? state.players.find((item) => item.identity === "baron")!
        : state.players[0]!;
    return beginTurn(state, starter.id);
  }
  state.prompt = pickPrompt(nextPicker.id, nextPicker.candidates);
  return state;
}

export { getGameChampion };
