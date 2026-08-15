import type { Action, GameMode, GameState, PlayerId } from "../engine/types";
import type { LobbySeat } from "./host";

export interface LobbyPayload {
  type: "lobby";
  room: string;
  mode: GameMode;
  seatCount: 2 | 4;
  lanHost: string;
  seats: LobbySeat[];
}

export type NetMessage =
  | { type: "join"; name: string; room?: string; mode?: GameMode; host?: boolean }
  | { type: "start"; seed?: number }
  | { type: "action"; action: Action }
  | {
      type: "hello";
      playerId: PlayerId;
      room: string;
      mode: GameMode;
      seatCount: 2 | 4;
      lanHost: string;
      seats: LobbySeat[];
    }
  | { type: "state"; state: GameState }
  | LobbyPayload
  | { type: "error"; message: string };

export function createGameSocket(
  url: string,
  handlers: {
    onHello?: (playerId: PlayerId, lobby: Omit<LobbyPayload, "type">) => void;
    onState?: (state: GameState) => void;
    onLobby?: (lobby: LobbyPayload) => void;
    onError?: (message: string) => void;
  },
): WebSocket {
  const socket = new WebSocket(url);
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as NetMessage;
    if (message.type === "hello") {
      handlers.onHello?.(message.playerId, {
        room: message.room,
        mode: message.mode,
        seatCount: message.seatCount,
        lanHost: message.lanHost,
        seats: message.seats,
      });
    }
    if (message.type === "state") handlers.onState?.(message.state);
    if (message.type === "lobby") handlers.onLobby?.(message);
    if (message.type === "error") handlers.onError?.(message.message);
  });
  return socket;
}

export function sendNet(socket: WebSocket, message: NetMessage): void {
  socket.send(JSON.stringify(message));
}
