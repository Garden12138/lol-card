import { describe, expect, it } from "vitest";
import { createMatch } from "../../src/game/engine/createMatch";
import { legalActions, reduce } from "../../src/game/engine/reduce";
import { applyDeath } from "../../src/game/engine/win";
import { card, pickAll } from "./helpers";

describe("duel and team modes", () => {
  it("ends a duel when the opponent dies", () => {
    const state = pickAll(
      createMatch({
        mode: "duel",
        seed: 4,
        seatCount: 2,
        controllers: ["human", "ai"],
      }),
    );
    expect(state.players).toHaveLength(2);
    const next = applyDeath(state, 1, 0);
    expect(next.winner).toBe("duel");
    expect(next.winnerSeat).toBe(0);
  });

  it("rejects striking a teammate in 2v2", () => {
    const state = pickAll(
      createMatch({
        mode: "team",
        seed: 5,
        seatCount: 4,
        controllers: ["human", "ai", "ai", "ai"],
      }),
    );
    const actor = 0;
    state.currentPlayer = actor;
    state.phase = "play";
    state.prompt = {
      kind: "playCard",
      actor,
      legalCardIds: [],
      legalTargetIds: [],
      canCancel: false,
      message: "出牌",
    };
    state.players[actor]!.championId = "Garen";
    state.players[actor]!.hand = [card({ id: "s1", kind: "strike" })];
    const teammate = 2;
    const illegal = reduce(state, { type: "playCard", player: actor, cardId: "s1", targetId: teammate });
    expect(illegal).toBe(state);
    expect(
      legalActions(state).some(
        (action) => action.type === "playCard" && action.cardId === "s1" && action.targetId === teammate,
      ),
    ).toBe(false);
  });

  it("awards blue when the red team is eliminated", () => {
    const state = pickAll(
      createMatch({
        mode: "team",
        seed: 6,
        seatCount: 4,
        controllers: ["human", "ai", "ai", "ai"],
      }),
    );
    let next = applyDeath(state, 1, 0);
    next = applyDeath(next, 3, 0);
    expect(next.winner).toBe("blue");
  });

  it("allows healing an injured teammate but not an enemy in 2v2", () => {
    const state = pickAll(
      createMatch({
        mode: "team",
        seed: 7,
        seatCount: 4,
        controllers: ["human", "ai", "ai", "ai"],
      }),
    );
    state.currentPlayer = 0;
    state.phase = "play";
    state.prompt = {
      kind: "playCard",
      actor: 0,
      legalCardIds: [],
      legalTargetIds: [],
      canCancel: false,
      message: "出牌",
    };
    state.players[0]!.hand = [card({ id: "h1", kind: "heal", suit: "heart" })];
    state.players[2]!.hp = 2;
    state.players[2]!.maxHp = 4;
    state.players[1]!.hp = 2;
    state.players[1]!.maxHp = 4;
    const actions = legalActions(state);
    expect(
      actions.some((action) => action.type === "playCard" && action.cardId === "h1" && action.targetId === 2),
    ).toBe(true);
    expect(
      actions.some((action) => action.type === "playCard" && action.cardId === "h1" && action.targetId === 1),
    ).toBe(false);
  });

  it("does not ask the duel opponent to save a dying player", () => {
    const state = pickAll(
      createMatch({
        mode: "duel",
        seed: 8,
        seatCount: 2,
        controllers: ["human", "ai"],
      }),
    );
    state.currentPlayer = 0;
    state.phase = "play";
    state.prompt = {
      kind: "playCard",
      actor: 0,
      legalCardIds: [],
      legalTargetIds: [],
      canCancel: false,
      message: "出牌",
    };
    state.players[0]!.championId = "Garen";
    state.players[1]!.championId = "Lux";
    state.players[0]!.equipment = {};
    state.players[1]!.equipment = {};
    state.players[0]!.hand = [
      card({ id: "s1", kind: "strike" }),
      card({ id: "h1", kind: "heal", suit: "heart" }),
    ];
    state.players[1]!.hand = [];
    state.players[1]!.hp = 1;
    const asked = reduce(state, { type: "playCard", player: 0, cardId: "s1", targetId: 1 });
    const after = reduce(asked, { type: "respond", player: 1 });
    expect(after.prompt.kind).not.toBe("dyingHeal");
    expect(after.players[1]!.alive).toBe(false);
  });
});
