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
});
