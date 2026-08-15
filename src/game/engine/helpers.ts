import type { GameState, PlayerId, PlayerState } from "./types";

export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

export function player(state: GameState, id: PlayerId): PlayerState {
  return state.players[id]!;
}

export function nextAlive(state: GameState, from: PlayerId): PlayerId {
  for (let step = 1; step <= 4; step += 1) {
    const id = ((from + step) % 4) as PlayerId;
    if (player(state, id).alive) return id;
  }
  return from;
}

export function alivePlayers(state: GameState): PlayerState[] {
  return state.players.filter((item) => item.alive);
}

export function log(state: GameState, message: string): void {
  state.log.push(message);
}
