import { describe, expect, it } from "vitest";
import { GameRoom } from "../../src/game/net/host";

describe("GameRoom", () => {
  it("fills empty seats with AI and hides guest hands", () => {
    const room = new GameRoom("rift", "duel");
    expect(room.join("host", "房主")).toBe(0);
    room.start(8);
    expect(room.state?.players).toHaveLength(2);
    expect(room.state?.players[1]!.controller).toBe("ai");
    room.state!.players[1]!.hand = [{ id: "secret", kind: "heal", suit: "heart", rank: 9 }];
    expect(room.view("host").players[1]!.hand[0]!.kind).toBe("strike");
  });

  it("lists empty lobby seats as AI until a player joins", () => {
    const room = new GameRoom("rift", "team");
    room.join("host", "房主");
    expect(room.lobbyView().seats).toEqual([
      { seat: 0, name: "房主", kind: "human" },
      { seat: 1, name: "AI", kind: "ai" },
      { seat: 2, name: "AI", kind: "ai" },
      { seat: 3, name: "AI", kind: "ai" },
    ]);
    room.join("guest", "客机");
    expect(room.lobbyView().seats[1]).toEqual({ seat: 1, name: "客机", kind: "human" });
  });

  it("frees a seat before the match starts", () => {
    const room = new GameRoom("rift", "duel");
    room.join("host", "房主");
    room.join("guest", "客机");
    expect(room.leave("guest")).toBe(true);
    expect(room.lobbyView().seats[1]!.kind).toBe("ai");
    expect(room.join("next", "后来")).toBe(1);
  });
});
