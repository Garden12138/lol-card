export function mulberry32(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextSeed(state: number): { value: number; state: number } {
  const stateNext = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return { value: mulberry32(stateNext), state: stateNext };
}

export function shuffleInPlace<T>(items: T[], rngState: number): number {
  let state = rngState;
  for (let i = items.length - 1; i > 0; i -= 1) {
    const rolled = nextSeed(state);
    state = rolled.state;
    const j = Math.floor(rolled.value * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return state;
}
