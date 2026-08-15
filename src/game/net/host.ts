import { chooseAiAction } from "../ai/chooseAction";
import { createMatch } from "../engine/createMatch";
import { legalActions, reduce } from "../engine/reduce";
import { viewFor } from "../engine/view";
import type { Action, Controller, GameMode, GameState, MatchConfig, PlayerId } from "../engine/types";

export interface RoomClient {
  id: string;
  name: string;
  seat: PlayerId;
}

export class GameRoom {
  readonly id: string;
  readonly mode: GameMode;
  clients: RoomClient[] = [];
  state: GameState | null = null;
  started = false;

  constructor(id: string, mode: GameMode) {
    this.id = id;
    this.mode = mode;
  }

  seatCount(): 2 | 4 {
    return this.mode === "duel" ? 2 : 4;
  }

  join(id: string, name: string): PlayerId {
    const existing = this.clients.find((item) => item.id === id);
    if (existing) return existing.seat;
    if (this.started) throw new Error("对局已开始");
    const seat = this.clients.length;
    if (seat >= this.seatCount()) throw new Error("房间已满");
    this.clients.push({ id, name, seat });
    return seat;
  }

  config(): MatchConfig {
    const n = this.seatCount();
    const controllers: Controller[] = Array.from({ length: n }, (_, index) =>
      this.clients.some((client) => client.seat === index) ? "human" : "ai",
    );
    return { mode: this.mode, seed: Date.now() >>> 0, seatCount: n, controllers };
  }

  start(seed?: number): GameState {
    const config = this.config();
    if (seed !== undefined) config.seed = seed;
    this.state = createMatch(config);
    this.started = true;
    return this.state;
  }

  apply(clientId: string, action: Action): GameState {
    if (!this.state) throw new Error("对局未开始");
    const client = this.clients.find((item) => item.id === clientId);
    if (!client || action.player !== client.seat) throw new Error("不能代替其他座位操作");
    const legal = legalActions(this.state).some((item) => JSON.stringify(item) === JSON.stringify(action));
    if (!legal) throw new Error("非法操作");
    this.state = reduce(this.state, action);
    return this.state;
  }

  tickAi(): GameState | null {
    if (!this.state || this.state.phase === "gameOver") return null;
    const actor = this.state.prompt.actor;
    const seat = this.state.players[actor];
    if (!seat || seat.controller !== "ai") return null;
    this.state = reduce(this.state, chooseAiAction(this.state));
    return this.state;
  }

  view(clientId: string): GameState {
    if (!this.state) throw new Error("对局未开始");
    const client = this.clients.find((item) => item.id === clientId);
    if (!client) throw new Error("未入座");
    return viewFor(this.state, client.seat);
  }
}
