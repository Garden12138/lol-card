import { describe, expect, it } from "vitest";
import { champions } from "../../src/data/champions";
import { GAME_CHAMPIONS, getGameChampion } from "../../src/game/data/champions";
import { createMatch } from "../../src/game/engine/createMatch";
import { reduce } from "../../src/game/engine/reduce";
import { pickAll } from "./helpers";

describe("full roster", () => {
  it("covers every gallery champion", () => {
    expect(GAME_CHAMPIONS.length).toBe(champions.length);
    expect(GAME_CHAMPIONS.length).toBeGreaterThanOrEqual(170);
    const ids = new Set(GAME_CHAMPIONS.map((item) => item.championId));
    for (const champion of champions) {
      expect(ids.has(champion.id)).toBe(true);
    }
  });

  it("keeps unique skills for the original ten", () => {
    expect(getGameChampion("Ahri")?.skillId).toBe("ahri-charm");
    expect(getGameChampion("Garen")?.skillId).toBe("garen-perseverance");
    expect(getGameChampion("Leona")?.skillId).toBe("leona-solar-flare");
  });

  it("maps non-override champions onto tag templates", () => {
    expect(getGameChampion("Malphite")?.skillId).toBe("template-tank");
    expect(getGameChampion("Sett")?.skillId).toBe("template-fighter");
    expect(getGameChampion("Talon")?.skillId).toBe("template-assassin");
    expect(getGameChampion("Annie")?.skillId).toBe("template-mage");
    expect(getGameChampion("Ashe")?.skillId).toBe("template-marksman");
    expect(getGameChampion("Nami")?.skillId).toBe("template-support");
  });

  it("draws three unique candidates from the full pool", () => {
    const state = createMatch(21);
    const all = state.players.flatMap((p) => p.candidates);
    expect(all).toHaveLength(12);
    expect(new Set(all).size).toBe(12);
    expect(all.every((id) => GAME_CHAMPIONS.some((c) => c.championId === id))).toBe(true);
  });

  it("lets a template tank heal like Garen at end of turn", () => {
    const state = pickAll(createMatch(9));
    const actor = state.currentPlayer;
    state.players[actor]!.championId = "Malphite";
    state.players[actor]!.hp = 3;
    state.players[actor]!.maxHp = 4;
    state.players[actor]!.damagedThisTurn = false;
    state.players[actor]!.hand = [];
    const next = reduce(state, { type: "endPlay", player: actor });
    expect(next.players[actor]!.hp).toBe(4);
  });
});
