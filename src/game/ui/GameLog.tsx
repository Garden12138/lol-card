import type { GameState } from "../engine/types";

export function GameLog({ state }: { state: GameState }) {
  return (
    <ol className="rift-log" aria-label="对局日志">
      {state.log.slice(-12).map((line, index) => (
        <li key={`${index}-${line}`}>{line}</li>
      ))}
    </ol>
  );
}
