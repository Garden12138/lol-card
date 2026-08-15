import { useState } from "react";
import type { GameMode } from "../engine/types";
import type { LobbyPayload } from "../net/client";
import type { LobbySeat } from "../net/host";

export function LobbyScreen({
  onSolo,
  onHost,
  onJoin,
  onStart,
  lanHint,
  lobby,
  mySeat,
  isHost,
}: {
  onSolo: (mode: GameMode) => void;
  onHost: (mode: GameMode, name: string) => void;
  onJoin: (host: string, name: string) => void;
  onStart?: () => void;
  lanHint?: string;
  lobby?: Omit<LobbyPayload, "type"> | null;
  mySeat?: number;
  isHost?: boolean;
}) {
  const [name, setName] = useState("召唤师");
  const address = lobby ? `ws://${lobby.lanHost}:8788` : "";

  return (
    <section className="rift-lobby" aria-labelledby="lobby-heading">
      <h1 id="lobby-heading">峡谷身份战</h1>
      <p>单机或局域网开房。空位由 AI 补齐。</p>
      <div className="rift-lobby__join">
        <label>
          召唤师名称
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="召唤师名称"
          />
        </label>
      </div>
      <form
        className="rift-lobby__join"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onJoin(String(data.get("host") || "127.0.0.1:8788"), name);
        }}
      >
        <label>
          加入主机
          <input name="host" defaultValue="127.0.0.1:8788" aria-label="主机地址" />
        </label>
        <button type="submit">加入</button>
      </form>
      <div className="rift-lobby__row">
        <button type="button" onClick={() => onSolo("identity")}>
          单机身份场
        </button>
        <button type="button" onClick={() => onSolo("duel")}>
          单机 1v1
        </button>
        <button type="button" onClick={() => onSolo("team")}>
          单机 2v2
        </button>
      </div>
      <div className="rift-lobby__row">
        <button type="button" onClick={() => onHost("identity", name)}>
          开房：身份场
        </button>
        <button type="button" onClick={() => onHost("duel", name)}>
          开房：1v1
        </button>
        <button type="button" onClick={() => onHost("team", name)}>
          开房：2v2
        </button>
      </div>
      {lobby && (
        <div className="rift-lobby__room">
          <p>
            房间 {lobby.room} · {modeLabel(lobby.mode)}
          </p>
          <p className="rift-lobby__address">
            连接地址 <code>{address}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(address);
              }}
            >
              复制
            </button>
          </p>
          <ul className="rift-lobby__seats">
            {lobby.seats.map((seat) => (
              <li key={seat.seat}>
                座位 {seat.seat}
                {mySeat === seat.seat ? "（你）" : ""}：{seatLabel(seat)}
              </li>
            ))}
          </ul>
          {isHost && onStart && (
            <button type="button" onClick={onStart}>
              开始对局
            </button>
          )}
          {!isHost && <p>等待房主开始。空位将由 AI 补齐。</p>}
        </div>
      )}
      {lanHint && <p className="rift-disclaimer">{lanHint}</p>}
    </section>
  );
}

function modeLabel(mode: GameMode): string {
  if (mode === "duel") return "1v1";
  if (mode === "team") return "2v2";
  return "身份场";
}

function seatLabel(seat: LobbySeat): string {
  return seat.kind === "ai" ? "AI" : seat.name;
}
