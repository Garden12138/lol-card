import { describe, expect, it } from "vitest";
import {
  CARD_RELIEF_FRAGMENT_SHADER,
  resolveReliefStrength,
  resolveReliefViewShift,
} from "../src/lib/cardRelief";

describe("卡内 2.5D 景深", () => {
  it("高置信度原画获得更清晰但受限的视差和法线强度", () => {
    const low = resolveReliefStrength(0, false);
    const high = resolveReliefStrength(1, false);

    expect(high.parallax).toBeGreaterThan(low.parallax);
    expect(high.parallax).toBeLessThanOrEqual(.05);
    expect(high.normal).toBeGreaterThan(low.normal);
    expect(low.parallax).toBe(0);
    expect(low.normal).toBeLessThanOrEqual(2);
  });

  it("减少动态效果时关闭人物与背景的相对移动", () => {
    expect(resolveReliefStrength(.9, true)).toEqual({ parallax: 0, normal: 5 });
    expect(resolveReliefViewShift({ x: .7, y: -.4, z: .4 }, true)).toEqual({ x: 0, y: 0 });
  });

  it("视角位移随倾斜方向变化并限制在安全范围", () => {
    const centered = resolveReliefViewShift({ x: 0, y: 0, z: 1 }, false);
    const tilted = resolveReliefViewShift({ x: .4, y: -.2, z: .5 }, false);
    const extreme = resolveReliefViewShift({ x: 8, y: -8, z: .05 }, false);

    expect(centered).toEqual({ x: 0, y: 0 });
    expect(tilted.x).toBeGreaterThan(0);
    expect(tilted.y).toBeLessThan(0);
    expect(extreme).toEqual({ x: 1.1, y: -1.1 });
  });

  it("着色器独立采样原画和深度，并进行两次视差修正", () => {
    expect(CARD_RELIEF_FRAGMENT_SHADER).toContain("uniform sampler2D uArtwork");
    expect(CARD_RELIEF_FRAGMENT_SHADER).toContain("uniform sampler2D uDepth");
    expect(CARD_RELIEF_FRAGMENT_SHADER).toContain("firstDepth");
    expect(CARD_RELIEF_FRAGMENT_SHADER).toContain("refinedDepth");
  });
});
