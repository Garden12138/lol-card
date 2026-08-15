import { describe, expect, it } from "vitest";
import { DECK_SIZE } from "../../src/game/engine/deck";
import { createMatch } from "../../src/game/engine/createMatch";
import { legalActions, reduce } from "../../src/game/engine/reduce";
import type { GameCard, GameState, PlayerId } from "../../src/game/engine/types";
import { card, pickAll } from "./helpers";

function setupStrike(state: GameState, extra?: { targetHp?: number; targetHand?: GameCard[] }) {
  const actor = state.currentPlayer;
  const target = ((actor + 1) % 4) as PlayerId;
  state.players[actor]!.championId = "Garen";
  state.players[target]!.championId = "Lux";
  state.players[actor]!.equipment = {};
  state.players[target]!.equipment = {};
  state.players[actor]!.hand = [card({ id: "s1", kind: "strike" })];
  state.players[target]!.hand = extra?.targetHand ?? [];
  state.players[target]!.hp = extra?.targetHp ?? 4;
  return { actor, target, state };
}

describe("turn and deck", () => {
  it("builds a 74-card deck and draws 2 at the start of the first turn", () => {
    const match = createMatch(11);
    expect(match.deck.length).toBe(DECK_SIZE);
    const started = pickAll(match);
    const current = started.players[started.currentPlayer]!;
    expect(current.hand.length).toBe(2);
    expect(started.phase).toBe("play");
    expect(started.deck.length).toBe(DECK_SIZE - 2);
  });

  it("requires discarding down to hp after ending a turn with too many cards", () => {
    const state = pickAll(createMatch(11));
    const actor = state.currentPlayer;
    const seat = state.players[actor]!;
    seat.hp = 3;
    seat.maxHp = 3;
    seat.hand = [
      card({ id: "a", kind: "strike" }),
      card({ id: "b", kind: "strike", suit: "heart" }),
      card({ id: "c", kind: "dodge", suit: "club" }),
      card({ id: "d", kind: "heal", suit: "diamond" }),
      card({ id: "e", kind: "barrier" }),
    ];
    const ended = reduce(state, { type: "endPlay", player: actor });
    expect(ended.phase).toBe("discard");
    const discardAction = legalActions(ended).find((action) => action.type === "discard");
    expect(discardAction?.type).toBe("discard");
    if (discardAction?.type !== "discard") throw new Error("missing discard");
    expect(discardAction.cardIds).toHaveLength(2);
    const after = reduce(ended, discardAction);
    expect(after.players[actor]!.hand.length).toBe(3);
    expect(after.currentPlayer).not.toBe(actor);
    expect(after.phase).toBe("play");
  });
});

describe("strike dodge heal dying", () => {
  it("dodging a strike prevents damage", () => {
    const { actor, target, state } = setupStrike(pickAll(createMatch(2)), {
      targetHand: [card({ id: "d1", kind: "dodge" })],
    });
    const asked = reduce(state, { type: "playCard", player: actor, cardId: "s1", targetId: target });
    expect(asked.prompt.kind).toBe("respondDodge");
    const blocked = reduce(asked, { type: "respond", player: target, cardId: "d1" });
    expect(blocked.players[target]!.hp).toBe(4);
    expect(blocked.prompt.kind).toBe("playCard");
  });

  it("taking a strike deals one damage", () => {
    const { actor, target, state } = setupStrike(pickAll(createMatch(2)));
    const asked = reduce(state, { type: "playCard", player: actor, cardId: "s1", targetId: target });
    const hit = reduce(asked, { type: "respond", player: target });
    expect(hit.players[target]!.hp).toBe(3);
  });

  it("lets a dying player self-heal back to 1", () => {
    const { actor, target, state } = setupStrike(pickAll(createMatch(2)), {
      targetHp: 1,
      targetHand: [card({ id: "h1", kind: "heal" })],
    });
    const asked = reduce(state, { type: "playCard", player: actor, cardId: "s1", targetId: target });
    const dying = reduce(asked, { type: "respond", player: target });
    expect(dying.prompt.kind).toBe("dyingHeal");
    expect(dying.prompt.actor).toBe(target);
    const saved = reduce(dying, { type: "respond", player: target, cardId: "h1" });
    expect(saved.players[target]!.hp).toBe(1);
    expect(saved.players[target]!.alive).toBe(true);
  });

  it("kills a player when nobody heals and can end the game", () => {
    const { actor, target, state } = setupStrike(pickAll(createMatch(2)), { targetHp: 1 });
    state.players[actor]!.identity = "invader";
    state.players[target]!.identity = "baron";
    for (const p of state.players) {
      if (p.id !== actor) p.hand = [];
    }
    const asked = reduce(state, { type: "playCard", player: actor, cardId: "s1", targetId: target });
    let next = asked;
    while (next.prompt.kind === "respondDodge" || next.prompt.kind === "dyingHeal") {
      next = reduce(next, { type: "respond", player: next.prompt.actor });
    }
    expect(next.players[target]!.alive).toBe(false);
    expect(next.winner).toBe("invaders");
  });
});
