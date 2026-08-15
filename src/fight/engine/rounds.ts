import { INTRO_FRAMES, KO_FRAMES, ROUND_FRAMES, WINS_NEEDED } from "./types";
import { resetRound } from "./createFight";
import type { FightState } from "./types";

export function tickRounds(state: FightState): void {
  if (state.phase === "intro") {
    state.phaseFrame += 1;
    if (state.phaseFrame >= INTRO_FRAMES) {
      state.phase = "fight";
      state.phaseFrame = 0;
    }
    return;
  }

  if (state.phase === "fight") {
    state.timer = Math.max(0, state.timer - 1);
    const [a, b] = state.fighters;
    if (a.health <= 0 || b.health <= 0) {
      state.phase = "ko";
      state.phaseFrame = 0;
      if (a.health <= 0) a.pose = "ko";
      if (b.health <= 0) b.pose = "ko";
      if (a.health > 0) a.pose = "win";
      if (b.health > 0) b.pose = "win";
      return;
    }
    if (state.timer <= 0) {
      state.phase = "timeout";
      state.phaseFrame = 0;
    }
    return;
  }

  if (state.phase === "ko" || state.phase === "timeout") {
    state.phaseFrame += 1;
    if (state.phaseFrame < KO_FRAMES) return;
    const [a, b] = state.fighters;
    let winner: 0 | 1 | null = null;
    if (state.phase === "timeout") {
      if (a.health !== b.health) winner = a.health > b.health ? 0 : 1;
    } else if (a.health <= 0 && b.health > 0) winner = 1;
    else if (b.health <= 0 && a.health > 0) winner = 0;

    if (winner !== null) state.wins[winner] += 1;
    if (state.wins[0] >= WINS_NEEDED || state.wins[1] >= WINS_NEEDED) {
      state.phase = "matchOver";
      state.phaseFrame = 0;
      return;
    }
    state.round += 1;
    const next = resetRound(state);
    Object.assign(state, next);
  }
}

export { ROUND_FRAMES };
