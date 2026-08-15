import { useEffect, useRef, useState } from "react";
import { isSfxMuted, playSfx, setSfxMuted, sfxFromLog } from "../audio/sfx";
import { chooseAiAction } from "../ai/chooseAction";
import { GAME_TITLE } from "../data/copy";
import { createMatch } from "../engine/createMatch";
import { legalActions, reduce } from "../engine/reduce";
import type { Action, GameCard, GameMode, GameState, PlayerId } from "../engine/types";
import { createGameSocket, sendNet, type LobbyPayload } from "../net/client";
import { CastOverlay } from "./CastOverlay";
import { LobbyScreen } from "./LobbyScreen";
import { PickScreen } from "./PickScreen";
import { ResultScreen } from "./ResultScreen";
import { TableScreen } from "./TableScreen";

export function GameApp({
  onExit,
  initialState,
}: {
  onExit: () => void;
  initialState?: GameState;
}) {
  const [state, setState] = useState<GameState | null>(initialState ?? null);
  const [mySeat, setMySeat] = useState<PlayerId>(0);
  const [online, setOnline] = useState(false);
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<{ championId?: string; card?: GameCard } | null>(null);
  const [muted, setMuted] = useState(isSfxMuted);
  const [lanHint, setLanHint] = useState("");
  const [lobby, setLobby] = useState<Omit<LobbyPayload, "type"> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const winPlayed = useRef(false);
  const logLen = useRef(0);

  useEffect(() => {
    return () => socketRef.current?.close();
  }, []);

  useEffect(() => {
    if (!state) {
      winPlayed.current = false;
      return;
    }
    if (state.log.length > logLen.current) {
      for (const line of state.log.slice(logLen.current)) {
        const kind = sfxFromLog(line);
        if (kind) playSfx(kind);
      }
    }
    logLen.current = state.log.length;
    if (state.winner && !winPlayed.current) {
      const me = state.players[mySeat];
      const lost =
        (state.winner === "duel" && state.winnerSeat !== mySeat) ||
        (state.winner === "blue" && mySeat % 2 !== 0) ||
        (state.winner === "red" && mySeat % 2 === 0) ||
        (state.winner === "baronSide" && me?.identity !== "baron" && me?.identity !== "vanguard") ||
        (state.winner === "invaders" && me?.identity !== "invader") ||
        (state.winner === "shadow" && me?.identity !== "shadow");
      playSfx(lost ? "lose" : "win");
      winPlayed.current = true;
    }
  }, [state, mySeat]);

  useEffect(() => {
    if (!state || socketRef.current) return;
    if (state.phase === "gameOver") return;
    const actor = state.players[state.prompt.actor];
    if (actor?.controller !== "ai") return;
    const frame = window.requestAnimationFrame(() => {
      setState((current) => {
        if (!current || current.phase === "gameOver") return current;
        if (current.players[current.prompt.actor]?.controller !== "ai") return current;
        return reduce(current, chooseAiAction(current));
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state]);

  const connect = (url: string, host: boolean, mode: GameMode, name: string) => {
    setLanHint("");
    const socket = createGameSocket(url, {
      onHello: (playerId, next) => {
        setMySeat(playerId);
        setLobby(next);
      },
      onLobby: (next) => setLobby(next),
      onState: (next) => setState(next),
      onError: (message) => setLanHint(message),
    });
    socket.addEventListener("open", () => {
      setOnline(true);
      sendNet(socket, { type: "join", name: name.trim() || "召唤师", host, mode, room: "rift" });
    });
    socket.addEventListener("error", () => {
      setLanHint("无法连接主机。请先在开房电脑运行 npm run dev:lan。");
    });
    socketRef.current = socket;
  };

  const dispatch = (action: Action) => {
    playSfx("ui");
    setPendingCardId(null);
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      sendNet(socket, { type: "action", action });
      return;
    }
    setState((current) => (current ? reduce(current, action) : current));
  };

  const playCard = (card: GameCard) => {
    if (!state || state.prompt.actor !== mySeat) return;
    if (state.prompt.kind !== "playCard") {
      setOverlay({ card });
      dispatch({ type: "respond", player: mySeat, cardId: card.id });
      return;
    }
    const matches = legalActions(state).filter(
      (action) => action.type === "playCard" && action.cardId === card.id,
    );
    if (matches.length === 1) {
      setOverlay({ card });
      dispatch(matches[0]!);
      return;
    }
    if (matches.length > 1) setPendingCardId(card.id);
  };

  const selectSeat = (id: PlayerId) => {
    if (!state) return;
    setOverlay({ championId: state.players[id]!.championId || undefined });
    if (!pendingCardId) return;
    const match = legalActions(state).find(
      (action) =>
        action.type === "playCard" && action.cardId === pendingCardId && action.targetId === id,
    );
    if (match) dispatch(match);
  };

  const startSolo = (mode: GameMode) => {
    const seatCount = mode === "duel" ? 2 : 4;
    setMySeat(0);
    setState(
      createMatch({
        mode,
        seed: Date.now() >>> 0,
        seatCount,
        controllers: Array.from({ length: seatCount }, (_, index) => (index === 0 ? "human" : "ai")),
      }),
    );
  };

  return (
    <div className="rift-shell">
      <header className="rift-header">
        <strong>{GAME_TITLE}</strong>
        <div className="rift-header__tools">
          <button
            type="button"
            onClick={() => {
              const next = !muted;
              setSfxMuted(next);
              setMuted(next);
            }}
          >
            {muted ? "音效：关" : "音效：开"}
          </button>
          <button type="button" onClick={onExit}>
            返回鉴赏馆
          </button>
        </div>
      </header>
      {!state && (
        <LobbyScreen
          lanHint={lanHint}
          lobby={lobby}
          mySeat={mySeat}
          isHost={online && mySeat === 0}
          onStart={() => sendNet(socketRef.current!, { type: "start" })}
          onSolo={startSolo}
          onHost={(mode, name) => connect("ws://127.0.0.1:8788", true, mode, name)}
          onJoin={(host, name) =>
            connect(`ws://${host.replace(/^ws:\/\//, "")}`, false, "identity", name)
          }
        />
      )}
      {state?.phase === "pick" && <PickScreen state={state} mySeat={mySeat} onPick={dispatch} />}
      {state && state.phase !== "pick" && state.phase !== "gameOver" && (
        <TableScreen
          state={state}
          mySeat={mySeat}
          pendingCardId={pendingCardId}
          onPlayCard={playCard}
          onAction={dispatch}
          onSelectSeat={selectSeat}
        />
      )}
      {state?.phase === "gameOver" && (
        <ResultScreen
          state={state}
          onReplay={() => {
            socketRef.current?.close();
            socketRef.current = null;
            setOnline(false);
            setLobby(null);
            setLanHint("");
            setState(null);
          }}
        />
      )}
      {overlay && (
        <CastOverlay
          championId={overlay.championId}
          card={overlay.card}
          onClose={() => setOverlay(null)}
        />
      )}
      <p className="rift-disclaimer">
        峡谷身份战是非官方粉丝作品，规则受经典身份卡牌启发，未获得 Riot Games
        或任何卡牌厂商授权。局域网开房需使用 npm run dev:lan。
      </p>
    </div>
  );
}
