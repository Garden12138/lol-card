import { getDeck } from "../data/decks";
import { shuffleInPlace } from "./rng";
import type { CardInstance, Controller, DuelState, PlayerId, PlayerState } from "./types";

export const START_LP = 4000;
export const START_HAND = 5;
export const MAIN_SIZE = 20;

function makeCard(uid: string, defId: string, owner: PlayerId): CardInstance {
  return {
    uid,
    defId,
    owner,
    position: "atk",
    face: "up",
    summonedThisTurn: false,
    attackedThisTurn: false,
    changedThisTurn: false,
    atkBuff: 0,
    protectedUntilEnd: false,
    overlays: [],
  };
}

function makePlayer(
  id: PlayerId,
  deckId: string,
  controller: Controller,
  startUid: number,
): { player: PlayerState; nextUid: number } {
  const precon = getDeck(deckId);
  let uid = startUid;
  const deck = precon.main.map((defId) => makeCard(`c${uid++}`, defId, id));
  const extra = precon.extra.map((defId) => makeCard(`c${uid++}`, defId, id));
  return {
    nextUid: uid,
    player: {
      id,
      lp: START_LP,
      controller,
      deckId,
      deck,
      extra,
      hand: [],
      gy: [],
      banished: [],
      monsters: [null, null, null, null, null],
      spells: [null, null, null, null, null],
      field: null,
    },
  };
}

export interface CreateDuelConfig {
  seed: number;
  p0DeckId: string;
  p1DeckId: string;
  p0Controller?: Controller;
  p1Controller?: Controller;
  shuffle?: boolean;
}

export function createDuel(config: CreateDuelConfig): DuelState {
  const p0 = makePlayer(0, config.p0DeckId, config.p0Controller ?? "human", 1);
  const p1 = makePlayer(1, config.p1DeckId, config.p1Controller ?? "ai", p0.nextUid);
  let rng = config.seed >>> 0;
  if (config.shuffle !== false) {
    rng = shuffleInPlace(p0.player.deck, rng);
    rng = shuffleInPlace(p1.player.deck, rng);
  }

  const state: DuelState = {
    seed: config.seed,
    rng,
    turn: 1,
    turnPlayer: 0,
    phase: "main1",
    battleStep: null,
    attack: null,
    chain: [],
    respondPassed: 0,
    prompt: { kind: "free", actor: 0 },
    players: [p0.player, p1.player],
    winner: null,
    winReason: null,
    log: ["峡谷决斗开始。先攻跳过抽卡。"],
    normalSummonUsed: false,
    uidSeq: p1.nextUid,
  };

  for (const player of state.players) {
    for (let i = 0; i < START_HAND; i += 1) {
      const card = player.deck.shift();
      if (card) player.hand.push(card);
    }
  }
  return state;
}
