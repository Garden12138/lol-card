import { describe, expect, it } from "vitest";
import { chooseAiAction } from "../../src/game/ai/chooseAction";
import { createMatch } from "../../src/game/engine/createMatch";
import type { MatchConfig } from "../../src/game/engine/types";
import { legalActions, reduce } from "../../src/game/engine/reduce";
import { card, pickAll } from "./helpers";

function simulate(config: number | MatchConfig, label: string): void {
  let state = createMatch(config);
  for (let step = 0; step < 8000; step += 1) {
    if (state.phase === "gameOver" || state.turnCount >= 200) break;
    const options = legalActions(state);
    expect(options.length, `${label} step ${step} ${state.prompt.kind}`).toBeGreaterThan(0);
    const action = chooseAiAction(state);
    expect(
      options.some((item) => JSON.stringify(item) === JSON.stringify(action)),
      `illegal ${JSON.stringify(action)} at ${state.prompt.kind} ${label}`,
    ).toBe(true);
    state = reduce(state, action);
  }
  expect(
    state.phase === "gameOver" || state.turnCount >= 200,
    `${label} phase=${state.phase} turns=${state.turnCount} prompt=${state.prompt.kind}`,
  ).toBe(true);
}

describe("chooseAiAction", () => {
  it("only selects legal actions and can finish or run 20 seeds without illegal stalls", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      simulate(seed * 17, `identity ${seed}`);
    }
  });

  it("finishes a handful of team and duel seeds", () => {
    for (let seed = 1; seed <= 3; seed += 1) {
      simulate(
        { mode: "team", seed: seed * 31, seatCount: 4, controllers: ["ai", "ai", "ai", "ai"] },
        `team ${seed}`,
      );
    }
    for (let seed = 1; seed <= 2; seed += 1) {
      simulate(
        { mode: "duel", seed: seed * 41, seatCount: 2, controllers: ["ai", "ai"] },
        `duel ${seed}`,
      );
    }
  });

  it("equips an empty weapon slot", () => {
    const state = pickAll(createMatch(3));
    const actor = state.currentPlayer;
    state.phase = "play";
    state.prompt = {
      kind: "playCard",
      actor,
      legalCardIds: [],
      legalTargetIds: [],
      canCancel: false,
      message: "出牌",
    };
    state.players[actor]!.equipment = {};
    state.players[actor]!.hand = [card({ id: "w1", kind: "doransBlade" })];
    const action = chooseAiAction(state);
    expect(action).toMatchObject({ type: "playCard", player: actor, cardId: "w1" });
  });

  it("does not last-hit an unpublished seat as baron", () => {
    const state = pickAll(createMatch(9));
    const baron = state.players.find((item) => item.identity === "baron")!;
    const target = state.players.find((item) => item.alive && item.identity !== "baron")!;
    state.currentPlayer = baron.id;
    state.phase = "play";
    state.strikeUsedThisTurn = false;
    state.prompt = {
      kind: "playCard",
      actor: baron.id,
      legalCardIds: [],
      legalTargetIds: [],
      canCancel: false,
      message: "出牌",
    };
    baron.equipment = {};
    baron.hand = [card({ id: "s1", kind: "strike" })];
    target.hp = 1;
    target.equipment = {};
    const action = chooseAiAction(state);
    expect(action.type === "playCard" && action.cardId === "s1" && action.targetId === target.id).toBe(
      false,
    );
  });

  it("saves a dying teammate in 2v2", () => {
    const state = pickAll(
      createMatch({
        mode: "team",
        seed: 12,
        seatCount: 4,
        controllers: ["ai", "ai", "ai", "ai"],
      }),
    );
    state.prompt = {
      kind: "dyingHeal",
      actor: 2,
      source: 0,
      legalCardIds: ["h1"],
      legalTargetIds: [],
      canCancel: true,
      message: "濒死",
    };
    state.players[2]!.hand = [card({ id: "h1", kind: "heal", suit: "heart" })];
    const action = chooseAiAction(state);
    expect(action).toEqual({ type: "respond", player: 2, cardId: "h1" });
  });
});
