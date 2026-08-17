import type { GameState, PlayerId, PlayerState } from "./types";

export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

export function player(state: GameState, id: PlayerId): PlayerState {
  return state.players[id]!;
}

export function seatCount(state: GameState): number {
  return state.players.length;
}

export function nextAlive(state: GameState, from: PlayerId): PlayerId {
  const n = seatCount(state);
  for (let step = 1; step <= n; step += 1) {
    const id = (from + step) % n;
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

export function teamOf(id: PlayerId): "blue" | "red" {
  return id % 2 === 0 ? "blue" : "red";
}

export function isEnemy(state: GameState, from: PlayerId, to: PlayerId): boolean {
  if (from === to) return false;
  if (!player(state, to).alive) return false;
  if (state.config.mode === "team") return teamOf(from) !== teamOf(to);
  return true;
}

export function isAlly(state: GameState, from: PlayerId, to: PlayerId): boolean {
  if (!player(state, to).alive) return false;
  if (from === to) return true;
  if (state.config.mode === "team") return teamOf(from) === teamOf(to);
  if (state.config.mode === "duel") return false;
  const a = player(state, from).identity;
  const b = player(state, to).identity;
  if (a === "shadow") return false;
  if (a === "invader") return b === "invader";
  return b === "baron" || b === "vanguard";
}

export function canOfferDyingHeal(state: GameState, actor: PlayerId, victim: PlayerId): boolean {
  if (!player(state, actor).alive) return false;
  if (state.config.mode === "duel") return actor === victim;
  if (state.config.mode === "team") return teamOf(actor) === teamOf(victim);
  return true;
}
