import { describe, expect, it } from "vitest";
import { detectMotion, numpadDir, pushBuffer } from "../../src/fight/engine/input";
import { EMPTY_INPUT } from "../../src/fight/engine/types";

describe("格斗指令缓冲", () => {
  it("按面向把方向编成数字键位", () => {
    expect(numpadDir({ ...EMPTY_INPUT, down: true }, 1)).toBe(2);
    expect(numpadDir({ ...EMPTY_INPUT, down: true, right: true }, 1)).toBe(3);
    expect(numpadDir({ ...EMPTY_INPUT, right: true }, 1)).toBe(6);
    expect(numpadDir({ ...EMPTY_INPUT, left: true }, 1)).toBe(4);
    expect(numpadDir({ ...EMPTY_INPUT, right: true }, -1)).toBe(4);
  });

  it("识别 236、623、214 与超必 236236", () => {
    let buffer: number[] = [];
    for (const dir of [5, 2, 3, 6]) buffer = pushBuffer(buffer, dir);
    expect(detectMotion(buffer)).toBe("236");
    buffer = [];
    for (const dir of [6, 2, 3]) buffer = pushBuffer(buffer, dir);
    expect(detectMotion(buffer)).toBe("623");
    buffer = [];
    for (const dir of [2, 1, 4]) buffer = pushBuffer(buffer, dir);
    expect(detectMotion(buffer)).toBe("214");
    buffer = [];
    for (const dir of [2, 3, 6, 2, 3, 6]) buffer = pushBuffer(buffer, dir);
    expect(detectMotion(buffer)).toBe("236236");
  });
});
