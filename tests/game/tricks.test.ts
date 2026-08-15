import { describe, expect, it } from "vitest";
import { createMatch } from "../../src/game/engine/createMatch";
import { beginTurn } from "../../src/game/engine/effects";
import { reduce } from "../../src/game/engine/reduce";
import type { PlayerId } from "../../src/game/engine/types";
import { card, pickAll } from "./helpers";

function passBarriers(state: ReturnType<typeof pickAll>) {
  let next = state;
  while (next.prompt.kind === "respondBarrier") {
    next = reduce(next, { type: "respond", player: next.prompt.actor });
  }
  return next;
}

describe("tricks", () => {
  it("lets barrier cancel supply", () => {
    const state = pickAll(createMatch(8));
    const actor = state.currentPlayer;
    const helper = ((actor + 1) % 4) as PlayerId;
    state.players[actor]!.hand = [card({ id: "sup", kind: "supply" })];
    state.players[helper]!.hand = [card({ id: "bar", kind: "barrier" })];
    const before = state.players[actor]!.hand.length;
    const asked = reduce(state, { type: "playCard", player: actor, cardId: "sup" });
    expect(asked.prompt.kind).toBe("respondBarrier");
    const cancelled = reduce(asked, { type: "respond", player: asked.prompt.actor, cardId: "bar" });
    expect(cancelled.players[actor]!.hand.length).toBe(before - 1);
    expect(cancelled.prompt.kind).toBe("playCard");
  });

  it("rejects plunder beyond distance 1", () => {
    const state = pickAll(createMatch(8));
    const actor = state.currentPlayer;
    const opposite = ((actor + 2) % 4) as PlayerId;
    state.players[actor]!.equipment = {};
    state.players[opposite]!.equipment = {};
    state.players[opposite]!.hand = [card({ id: "x", kind: "dodge" })];
    state.players[actor]!.hand = [card({ id: "p", kind: "plunder" })];
    const next = reduce(state, { type: "playCard", player: actor, cardId: "p", targetId: opposite });
    expect(next).toBe(state);
  });

  it("skips the play phase when stun judges a non-heart", () => {
    const state = pickAll(createMatch(8));
    const actor = state.currentPlayer;
    const victim = ((actor + 1) % 4) as PlayerId;
    state.players[victim]!.judged = [card({ id: "stun", kind: "stun", suit: "spade" })];
    state.deck.unshift(card({ id: "club", kind: "strike", suit: "club" }));
    const next = beginTurn(state, victim);
    expect(next.currentPlayer).not.toBe(victim);
  });

  it("lets a minion wave be cancelled by a strike", () => {
    const state = pickAll(createMatch(8));
    const actor = state.currentPlayer;
    const target = ((actor + 1) % 4) as PlayerId;
    for (const p of state.players) {
      p.hand = [];
      p.championId = p.championId === "Yasuo" ? "Lux" : p.championId;
    }
    state.players[actor]!.hand = [card({ id: "mw", kind: "minionWave" })];
    state.players[target]!.hand = [card({ id: "s2", kind: "strike" })];
    state.players[target]!.hp = 4;
    let next = reduce(state, { type: "playCard", player: actor, cardId: "mw" });
    next = passBarriers(next);
    expect(next.prompt.kind).toBe("respondMinionWave");
    const hp = next.players[target]!.hp;
    while (next.prompt.kind === "respondMinionWave") {
      const current = next.prompt.actor;
      const cardId = current === target ? "s2" : undefined;
      next = reduce(next, { type: "respond", player: current, cardId });
    }
    expect(next.players[target]!.hp).toBe(hp);
  });
});
