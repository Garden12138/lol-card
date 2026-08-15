import { describe, expect, it, vi } from "vitest";
import { playSfx, setSfxMuted, sfxFromLog } from "../../src/game/audio/sfx";

describe("sfx", () => {
  it("does not create an oscillator while muted", () => {
    setSfxMuted(true);
    const createOscillator = vi.fn();
    const ctx = {
      createOscillator,
      createGain: vi.fn(),
      destination: {},
      currentTime: 0,
    } as unknown as AudioContext;
    playSfx("ui", ctx);
    expect(createOscillator).not.toHaveBeenCalled();
    setSfxMuted(false);
  });

  it("maps strike logs without the word 伤害", () => {
    expect(sfxFromLog("盖伦 使用了普攻")).toBe("strike");
    expect(sfxFromLog("摸了 2 张牌")).toBe("deal");
  });
});
