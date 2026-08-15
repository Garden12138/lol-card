import type { Action, GameState, PlayerId } from "../engine/types";

export type NetMessage =
  | { type: "join"; name: string; room?: string; mode?: "identity" | "duel" | "team"; host?: boolean }
  | { type: "start"; seed?: number }
  | { type: "action"; action: Action }
  | { type: "hello"; playerId: PlayerId; room: string; mode: string }
  | { type: "state"; state: GameState }
  | { type: "lobby"; seats: Array<{ seat: PlayerId; name: string }> }
  | { type: "error"; message: string };

export function createGameSocket(
  url: string,
  handlers: {
    onHello?: (playerId: PlayerId) => void;
    onState?: (state: GameState) => void;
    onLobby?: (seats: Array<{ seat: PlayerId; name: string }>) => void;
    onError?: (message: string) => void;
  },
): WebSocket {
  const socket = new WebSocket(url);
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as NetMessage;
    if (message.type === "hello") handlers.onHello?.(message.playerId);
    if (message.type === "state") handlers.onState?.(message.state);
    if (message.type === "lobby") handlers.onLobby?.(message.seats);
    if (message.type === "error") handlers.onError?.(message.message);
  });
  return socket;
}

export function sendNet(socket: WebSocket, message: NetMessage): void {
  socket.send(JSON.stringify(message));
}
