import { networkInterfaces } from "node:os";
import type { Plugin } from "vite";
import type { WebSocket } from "ws";

function lanAddress(): string {
  const nets = networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const item of list ?? []) {
      if (item.family === "IPv4" && !item.internal) return item.address;
    }
  }
  return "127.0.0.1";
}

export async function startLanWsServer(): Promise<void> {
  const [{ WebSocketServer }, { GameRoom }] = await Promise.all([
    import("ws"),
    import("../src/game/net/host"),
  ]);
  const rooms = new Map<string, InstanceType<typeof GameRoom>>();
  const sockets = new Map<string, WebSocket>();
  const lanHost = lanAddress();
  const wss = new WebSocketServer({ port: 8788 });
  console.log(`[峡谷身份战] 局域网主机 ws://${lanHost}:8788`);

  const lobbyPayload = (room: InstanceType<typeof GameRoom>) => ({
    type: "lobby" as const,
    lanHost,
    ...room.lobbyView(),
  });

  const pushLobby = (room: InstanceType<typeof GameRoom>) => {
    const payload = JSON.stringify(lobbyPayload(room));
    for (const member of room.clients) {
      const socket = sockets.get(member.id);
      if (socket?.readyState === 1) socket.send(payload);
    }
  };

  const pushState = (room: InstanceType<typeof GameRoom>) => {
    for (const member of room.clients) {
      const socket = sockets.get(member.id);
      if (socket?.readyState !== 1 || !room.state) continue;
      socket.send(JSON.stringify({ type: "state", state: room.view(member.id) }));
    }
  };

  const runAi = (room: InstanceType<typeof GameRoom>) => {
    let guard = 0;
    while (room.tickAi() && guard < 48) guard += 1;
    pushState(room);
  };

  wss.on("connection", (socket) => {
    const clientId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sockets.set(clientId, socket);
    let roomId = "";
    const send = (message: object) => socket.send(JSON.stringify(message));

    socket.on("close", () => {
      sockets.delete(clientId);
      const room = rooms.get(roomId);
      if (room?.leave(clientId)) pushLobby(room);
    });
    socket.on("message", (raw) => {
      const message = JSON.parse(String(raw)) as {
        type: string;
        name?: string;
        room?: string;
        mode?: "identity" | "duel" | "team";
        host?: boolean;
        seed?: number;
        action?: import("../src/game/engine/types").Action;
      };
      try {
        if (message.type === "join") {
          roomId = message.room || "rift";
          let room = rooms.get(roomId);
          if (message.host || !room) {
            room = new GameRoom(roomId, message.mode ?? "identity");
            rooms.set(roomId, room);
          }
          const seat = room.join(clientId, message.name || "召唤师");
          send({ type: "hello", playerId: seat, lanHost, ...room.lobbyView() });
          pushLobby(room);
          return;
        }
        const room = rooms.get(roomId);
        if (!room) throw new Error("房间不存在");
        if (message.type === "start") {
          room.start(message.seed);
          pushState(room);
          runAi(room);
          return;
        }
        if (message.type === "action" && "action" in message && message.action) {
          room.apply(clientId, message.action);
          pushState(room);
          runAi(room);
        }
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "联机错误" });
      }
    });
  });
}

export function riftLanPlugin(): Plugin {
  return {
    name: "rift-lan",
    async configureServer() {
      if (process.env.RIFT_LAN !== "1") return;
      await startLanWsServer();
    },
  };
}
