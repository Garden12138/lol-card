import { describe, expect, it } from "vitest";
import { createMatch } from "../../src/game/engine/createMatch";
import { attackRange, distance } from "../../src/game/engine/distance";
import { beginTurn } from "../../src/game/engine/effects";
import { reduce } from "../../src/game/engine/reduce";
import type { PlayerId } from "../../src/game/engine/types";
import { card, pickAll } from "./helpers";

describe("equipment and distance", () => {
  it("cannot strike the opposite seat with default range 1", () => {
    const state = pickAll(createMatch(5));
    const actor = state.currentPlayer;
    const opposite = ((actor + 2) % 4) as PlayerId;
    expect(distance(state, actor, opposite)).toBe(2);
    expect(attackRange(state, actor)).toBe(1);
    state.players[actor]!.championId = "Garen";
    state.players[opposite]!.championId = "Lux";
    state.players[actor]!.equipment = {};
    state.players[opposite]!.equipment = {};
    state.players[actor]!.hand = [card({ id: "s1", kind: "strike" })];
    const next = reduce(state, { type: "playCard", player: actor, cardId: "s1", targetId: opposite });
    expect(next).toBe(state);
  });

  it("can strike the opposite seat after equipping infinity edge", () => {
    const state = pickAll(createMatch(5));
    const actor = state.currentPlayer;
    const opposite = ((actor + 2) % 4) as PlayerId;
    state.players[actor]!.championId = "Garen";
    state.players[opposite]!.championId = "Lux";
    state.players[actor]!.hand = [
      card({ id: "ie", kind: "infinityEdge" }),
      card({ id: "s1", kind: "strike" }),
    ];
    const equipped = reduce(state, { type: "playCard", player: actor, cardId: "ie" });
    expect(attackRange(equipped, actor)).toBe(3);
    equipped.players[opposite]!.equipment = {};
    equipped.players[opposite]!.hand = [];
    equipped.players[opposite]!.hp = 4;
    const asked = reduce(equipped, { type: "playCard", player: actor, cardId: "s1", targetId: opposite });
    expect(asked.prompt.kind).toBe("respondDodge");
  });

  it("boots reduce attack distance by 1", () => {
    const state = pickAll(createMatch(5));
    const actor = state.currentPlayer;
    const opposite = ((actor + 2) % 4) as PlayerId;
    state.players[actor]!.equipment = { offensiveMount: card({ id: "b", kind: "boots" }) };
    expect(distance(state, actor, opposite)).toBe(1);
  });

  it("adaptive helm treats a red judge as a dodge", () => {
    const state = pickAll(createMatch(5));
    const actor = state.currentPlayer;
    const target = ((actor + 1) % 4) as PlayerId;
    state.players[actor]!.championId = "Garen";
    state.players[target]!.championId = "Lux";
    state.players[actor]!.equipment = {};
    state.players[target]!.equipment = { armor: card({ id: "helm", kind: "adaptiveHelm" }) };
    state.players[target]!.hand = [];
    state.players[target]!.hp = 4;
    state.players[actor]!.hand = [card({ id: "s1", kind: "strike" })];
    state.deck.unshift(card({ id: "heart", kind: "strike", suit: "heart" }));
    const after = reduce(state, { type: "playCard", player: actor, cardId: "s1", targetId: target });
    expect(after.players[target]!.hp).toBe(4);
    expect(after.prompt.kind).toBe("playCard");
  });

  it("thornmail damages the striker after a hit", () => {
    const state = pickAll(createMatch(5));
    const actor = state.currentPlayer;
    const target = ((actor + 1) % 4) as PlayerId;
    state.players[actor]!.championId = "Garen";
    state.players[target]!.championId = "Lux";
    state.players[actor]!.hp = 4;
    state.players[target]!.hp = 4;
    state.players[actor]!.equipment = {};
    state.players[target]!.equipment = { armor: card({ id: "thorn", kind: "thornmail" }) };
    state.players[actor]!.hand = [card({ id: "s1", kind: "strike" })];
    state.players[target]!.hand = [];
    const asked = reduce(state, { type: "playCard", player: actor, cardId: "s1", targetId: target });
    const hit = reduce(asked, { type: "respond", player: target });
    expect(hit.players[target]!.hp).toBe(3);
    expect(hit.players[actor]!.hp).toBe(3);
  });
});

describe("beginTurn stun", () => {
  it("is available for trick tests", () => {
    expect(typeof beginTurn).toBe("function");
  });
});
