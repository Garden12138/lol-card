import { describe, expect, it } from "vitest";
import { createMatch } from "../../src/game/engine/createMatch";
import { beginTurn } from "../../src/game/engine/effects";
import { reduce } from "../../src/game/engine/reduce";
import type { PlayerId } from "../../src/game/engine/types";
import { card, pickAll } from "./helpers";

function forceChampion(state: ReturnType<typeof pickAll>, id: string) {
  const actor = state.currentPlayer;
  state.players[actor]!.championId = id;
  state.players[actor]!.skillUsedThisTurn = false;
  state.players[actor]!.limitedUsed = false;
  state.players[actor]!.equipment = {};
  return actor;
}

describe("champion skills", () => {
  it("garen heals at end of turn if undamaged", () => {
    const state = pickAll(createMatch(9));
    const actor = forceChampion(state, "Garen");
    state.players[actor]!.hp = 3;
    state.players[actor]!.maxHp = 5;
    state.players[actor]!.damagedThisTurn = false;
    state.players[actor]!.hand = [];
    const next = reduce(state, { type: "endPlay", player: actor });
    expect(state.players[actor]!.hp).toBe(3);
    expect(next.players[actor]!.hp).toBe(4);
  });

  it("ahri charm requires two dodges", () => {
    const state = pickAll(createMatch(9));
    const actor = forceChampion(state, "Ahri");
    const target = ((actor + 1) % 4) as PlayerId;
    state.players[target]!.championId = "Lux";
    state.players[target]!.equipment = {};
    state.players[target]!.hp = 4;
    state.players[target]!.hand = [
      card({ id: "d1", kind: "dodge" }),
      card({ id: "d2", kind: "dodge" }),
    ];
    state.players[actor]!.hand = [card({ id: "c1", kind: "heal" })];
    const asked = reduce(state, { type: "useSkill", player: actor, targetId: target, cardId: "c1" });
    expect(asked.prompt.kind).toBe("respondDodge");
    expect(asked.prompt.extraDodgesNeeded).toBe(2);
    const once = reduce(asked, { type: "respond", player: target, cardId: "d1" });
    expect(once.prompt.kind).toBe("respondDodge");
    const twice = reduce(once, { type: "respond", player: target, cardId: "d2" });
    expect(twice.players[target]!.hp).toBe(4);
  });

  it("yasuo can play dodge as a strike", () => {
    const state = pickAll(createMatch(9));
    const actor = forceChampion(state, "Yasuo");
    const target = ((actor + 1) % 4) as PlayerId;
    state.players[target]!.championId = "Lux";
    state.players[target]!.equipment = {};
    state.players[target]!.hand = [];
    state.players[target]!.hp = 4;
    state.players[actor]!.hand = [card({ id: "d1", kind: "dodge" })];
    const asked = reduce(state, { type: "playCard", player: actor, cardId: "d1", targetId: target });
    expect(asked.prompt.kind).toBe("respondDodge");
  });

  it("thresh steals an equipment card", () => {
    const state = pickAll(createMatch(9));
    const actor = forceChampion(state, "Thresh");
    const target = ((actor + 1) % 4) as PlayerId;
    const blade = card({ id: "blade", kind: "doransBlade" });
    state.players[target]!.equipment = { weapon: blade };
    state.players[actor]!.hand = [];
    const asked = reduce(state, { type: "useSkill", player: actor, targetId: target });
    const taken = reduce(asked, { type: "respond", player: actor, cardId: "blade" });
    expect(taken.players[target]!.equipment.weapon).toBeUndefined();
    expect(taken.players[actor]!.hand.some((item) => item.id === "blade")).toBe(true);
  });

  it("jinx draws 3 extra on a kill", () => {
    const state = pickAll(createMatch(9));
    const actor = forceChampion(state, "Jinx");
    const target = ((actor + 1) % 4) as PlayerId;
    state.players[target]!.championId = "Lux";
    state.players[target]!.identity = "vanguard";
    state.players[actor]!.identity = "invader";
    state.players[target]!.equipment = {};
    state.players[target]!.hp = 1;
    state.players[target]!.hand = [];
    for (const p of state.players) {
      if (p.id !== actor) p.hand = [];
    }
    state.players[actor]!.hand = [card({ id: "s1", kind: "strike" })];
    const before = state.players[actor]!.hand.length;
    let next = reduce(state, { type: "playCard", player: actor, cardId: "s1", targetId: target });
    while (next.prompt.kind === "respondDodge" || next.prompt.kind === "dyingHeal") {
      next = reduce(next, { type: "respond", player: next.prompt.actor });
    }
    expect(next.players[target]!.alive).toBe(false);
    expect(next.players[actor]!.hand.length).toBeGreaterThanOrEqual(before - 1 + 3);
  });

  it("darius strike against 2 hp cannot be dodged", () => {
    const state = pickAll(createMatch(9));
    const actor = forceChampion(state, "Darius");
    const target = ((actor + 1) % 4) as PlayerId;
    state.players[target]!.championId = "Lux";
    state.players[target]!.equipment = {};
    state.players[target]!.hp = 2;
    state.players[target]!.hand = [card({ id: "d1", kind: "dodge" })];
    state.players[actor]!.hand = [card({ id: "s1", kind: "strike" })];
    const next = reduce(state, { type: "playCard", player: actor, cardId: "s1", targetId: target });
    expect(next.players[target]!.hp).toBe(1);
    expect(next.prompt.kind).not.toBe("respondDodge");
  });

  it("lux final spark damages if the suit is not discarded", () => {
    const state = pickAll(createMatch(9));
    const actor = forceChampion(state, "Lux");
    const target = ((actor + 1) % 4) as PlayerId;
    state.players[target]!.championId = "Garen";
    state.players[target]!.hp = 4;
    state.players[target]!.hand = [card({ id: "h", kind: "heal", suit: "heart" })];
    state.players[actor]!.hand = [card({ id: "show", kind: "strike", suit: "spade" })];
    const asked = reduce(state, {
      type: "useSkill",
      player: actor,
      targetId: target,
      cardId: "show",
    });
    expect(asked.prompt.kind).toBe("respondLux");
    const hit = reduce(asked, { type: "respond", player: target });
    expect(hit.players[target]!.hp).toBe(3);
  });

  it("zed limited skill allows a second strike", () => {
    const state = pickAll(createMatch(9));
    const actor = forceChampion(state, "Zed");
    const target = ((actor + 1) % 4) as PlayerId;
    state.players[target]!.championId = "Lux";
    state.players[target]!.equipment = {};
    state.players[target]!.hp = 4;
    state.players[target]!.hand = [];
    state.players[actor]!.hp = 3;
    state.players[actor]!.hand = [
      card({ id: "s1", kind: "strike" }),
      card({ id: "s2", kind: "strike" }),
    ];
    const marked = reduce(state, { type: "useSkill", player: actor });
    expect(marked.players[actor]!.hp).toBe(2);
    const first = reduce(marked, { type: "playCard", player: actor, cardId: "s1", targetId: target });
    const afterFirst = reduce(first, { type: "respond", player: target });
    const second = reduce(afterFirst, { type: "playCard", player: actor, cardId: "s2", targetId: target });
    expect(second.prompt.kind).toBe("respondDodge");
  });

  it("leona prevents dodge for the rest of the turn", () => {
    const state = pickAll(createMatch(9));
    const actor = forceChampion(state, "Leona");
    const target = ((actor + 1) % 4) as PlayerId;
    state.players[target]!.championId = "Lux";
    state.players[target]!.equipment = {};
    state.players[target]!.hp = 4;
    state.players[target]!.hand = [card({ id: "d1", kind: "dodge" })];
    state.players[actor]!.hand = [card({ id: "s1", kind: "strike" })];
    const flared = reduce(state, { type: "useSkill", player: actor, targetId: target });
    const hit = reduce(flared, { type: "playCard", player: actor, cardId: "s1", targetId: target });
    expect(hit.players[target]!.hp).toBe(3);
    expect(hit.prompt.kind).toBe("playCard");
  });

  it("soraka discards a card to heal an injured ally", () => {
    const state = pickAll(createMatch(9));
    const actor = forceChampion(state, "Soraka");
    const target = ((actor + 1) % 4) as PlayerId;
    state.players[target]!.hp = 2;
    state.players[target]!.maxHp = 4;
    state.players[actor]!.hand = [card({ id: "c1", kind: "dodge" })];
    const next = reduce(state, { type: "useSkill", player: actor, targetId: target, cardId: "c1" });
    expect(next.players[target]!.hp).toBe(3);
    expect(next.players[actor]!.hand).toHaveLength(0);
  });
});
