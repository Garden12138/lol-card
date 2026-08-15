import { describe, expect, it, vi } from "vitest";
import { playSfx, setSfxMuted } from "../../src/game/audio/sfx";

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
});
