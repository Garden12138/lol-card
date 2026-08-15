import type { GameMode } from "../engine/types";

export function LobbyScreen({
  onSolo,
  onHost,
  onJoin,
  lanHint,
}: {
  onSolo: (mode: GameMode) => void;
  onHost: (mode: GameMode) => void;
  onJoin: (host: string) => void;
  lanHint?: string;
}) {
  return (
    <section className="rift-lobby" aria-labelledby="lobby-heading">
      <h1 id="lobby-heading">峡谷身份战</h1>
      <p>单机或局域网开房。空位由 AI 补齐。</p>
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
        <button type="button" onClick={() => onHost("identity")}>
          开房：身份场
        </button>
        <button type="button" onClick={() => onHost("duel")}>
          开房：1v1
        </button>
        <button type="button" onClick={() => onHost("team")}>
          开房：2v2
        </button>
      </div>
      <form
        className="rift-lobby__join"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onJoin(String(data.get("host") || "127.0.0.1:8788"));
        }}
      >
        <label>
          加入主机
          <input name="host" defaultValue="127.0.0.1:8788" aria-label="主机地址" />
        </label>
        <button type="submit">加入</button>
      </form>
      {lanHint && <p className="rift-disclaimer">{lanHint}</p>}
    </section>
  );
}
