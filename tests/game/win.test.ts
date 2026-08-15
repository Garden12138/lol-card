import { describe, expect, it } from "vitest";
import { GAME_CHAMPIONS } from "../../src/game/data/champions";
import { createMatch } from "../../src/game/engine/createMatch";
import { reduce } from "../../src/game/engine/reduce";
import type { GameState, PlayerId, PlayerState } from "../../src/game/engine/types";
import { applyDeath } from "../../src/game/engine/win";

function pickAll(state: GameState): GameState {
  let next = state;
  for (let i = 0; i < 4; i += 1) {
    const actor = next.prompt.actor;
    const championId = next.players[actor]!.candidates[0]!;
    next = reduce(next, { type: "pickChampion", player: actor, championId });
  }
  return next;
}

function alive(player: Partial<PlayerState> & Pick<PlayerState, "id" | "identity">): PlayerState {
  return {
    championId: "Garen",
    hp: 4,
    maxHp: 4,
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
    candidates: [],
    controller: "ai",
    ...player,
  };
}

function baseState(players: PlayerState[]): GameState {
  return {
    config: { mode: "identity", seed: 1, seatCount: 4, controllers: ["human", "ai", "ai", "ai"] },
    rngSeed: 1,
    rngState: 1,
    phase: "play",
    currentPlayer: 0,
    players,
    deck: [],
    discard: [],
    prompt: {
      kind: "playCard",
      actor: 0,
      legalCardIds: [],
      legalTargetIds: [],
      canCancel: false,
      message: "",
    },
    log: [],
    winner: null,
    strikeUsedThisTurn: false,
    skipPlayPhase: false,
    stack: [],
    pending: null,
    turnCount: 0,
  };
}

describe("createMatch", () => {
  it("is deterministic for the same seed", () => {
    const a = createMatch(42);
    const b = createMatch(42);
    expect(a.players.map((p) => p.identity)).toEqual(b.players.map((p) => p.identity));
    expect(a.players.map((p) => p.candidates)).toEqual(b.players.map((p) => p.candidates));
  });

  it("assigns four unique identities with one public baron", () => {
    const state = createMatch(7);
    const identities = state.players.map((p) => p.identity).sort();
    expect(identities).toEqual(["baron", "invader", "shadow", "vanguard"]);
    expect(state.players.filter((p) => p.identity === "baron")).toHaveLength(1);
    expect(state.phase).toBe("pick");
    const allCandidates = state.players.flatMap((p) => p.candidates);
    expect(allCandidates).toHaveLength(12);
    expect(new Set(allCandidates).size).toBe(12);
    expect(allCandidates.every((id) => GAME_CHAMPIONS.some((c) => c.championId === id))).toBe(
      true,
    );
  });

  it("enters the first turn after every seat picks a candidate", () => {
    const ready = pickAll(createMatch(3));
    expect(["play", "discard", "draw", "judge"]).toContain(ready.phase);
    expect(ready.players.every((p) => p.championId.length > 0)).toBe(true);
  });
});

describe("applyDeath", () => {
  it("awards baronSide when invaders and shadow are dead", () => {
    const state = baseState([
      alive({ id: 0, identity: "baron" }),
      alive({ id: 1, identity: "vanguard" }),
      alive({ id: 2, identity: "invader", alive: false, hp: 0 }),
      alive({ id: 3, identity: "shadow" }),
    ]);
    const next = applyDeath(state, 3, 0);
    expect(next.winner).toBe("baronSide");
    expect(next.phase).toBe("gameOver");
  });

  it("awards shadow when baron dies and shadow is the sole survivor", () => {
    const state = baseState([
      alive({ id: 0, identity: "baron" }),
      alive({ id: 1, identity: "vanguard", alive: false, hp: 0 }),
      alive({ id: 2, identity: "invader", alive: false, hp: 0 }),
      alive({ id: 3, identity: "shadow" }),
    ]);
    const next = applyDeath(state, 0, 3);
    expect(next.winner).toBe("shadow");
  });

  it("awards invaders when baron dies while an invader still lives", () => {
    const state = baseState([
      alive({ id: 0, identity: "baron" }),
      alive({ id: 1, identity: "vanguard" }),
      alive({ id: 2, identity: "invader" }),
      alive({ id: 3, identity: "shadow" }),
    ]);
    const next = applyDeath(state, 0, 2);
    expect(next.winner).toBe("invaders");
  });
});
