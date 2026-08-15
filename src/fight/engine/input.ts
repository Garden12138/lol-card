import { BUFFER_FRAMES, EMPTY_INPUT, type InputBits } from "./types";

export function cloneInput(input: InputBits): InputBits {
  return { ...input };
}

export function edgePressed(prev: InputBits, next: InputBits, key: keyof InputBits): boolean {
  return next[key] && !prev[key];
}

export function anyPunch(input: InputBits): boolean {
  return input.lp || input.hp;
}

export function anyKick(input: InputBits): boolean {
  return input.lk || input.hk;
}

export function numpadDir(input: InputBits, facing: 1 | -1): number {
  const forward = facing === 1 ? input.right : input.left;
  const back = facing === 1 ? input.left : input.right;
  const x = forward ? 1 : back ? -1 : 0;
  const y = input.up ? 1 : input.down ? -1 : 0;
  if (x === 0 && y === 0) return 5;
  if (x === -1 && y === -1) return 1;
  if (x === 0 && y === -1) return 2;
  if (x === 1 && y === -1) return 3;
  if (x === -1 && y === 0) return 4;
  if (x === 1 && y === 0) return 6;
  if (x === -1 && y === 1) return 7;
  if (x === 0 && y === 1) return 8;
  return 9;
}

export function pushBuffer(buffer: number[], dir: number): number[] {
  const next = buffer.length >= BUFFER_FRAMES ? buffer.slice(buffer.length - BUFFER_FRAMES + 1) : buffer.slice();
  next.push(dir);
  return next;
}

function containsSeq(buffer: number[], seq: number[]): boolean {
  let index = 0;
  for (const dir of buffer) {
    if (dir === seq[index]) index += 1;
    if (index === seq.length) return true;
  }
  return false;
}

export function detectMotion(buffer: number[]): "236236" | "623" | "236" | "214" | null {
  if (containsSeq(buffer, [2, 3, 6, 2, 3, 6])) return "236236";
  if (containsSeq(buffer, [6, 2, 3])) return "623";
  if (containsSeq(buffer, [2, 3, 6])) return "236";
  if (containsSeq(buffer, [2, 1, 4])) return "214";
  return null;
}

export function holdingBack(input: InputBits, facing: 1 | -1): boolean {
  return facing === 1 ? input.left : input.right;
}

export function mergePressed(a: InputBits, b: InputBits): InputBits {
  return {
    left: a.left || b.left,
    right: a.right || b.right,
    up: a.up || b.up,
    down: a.down || b.down,
    lp: a.lp || b.lp,
    lk: a.lk || b.lk,
    hp: a.hp || b.hp,
    hk: a.hk || b.hk,
  };
}

export function idleInput(): InputBits {
  return cloneInput(EMPTY_INPUT);
}
