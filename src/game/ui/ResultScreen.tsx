import { IDENTITY_NAMES, WINNER_NAMES } from "../data/copy";
import type { GameState } from "../engine/types";

export function ResultScreen({ state, onReplay }: { state: GameState; onReplay: () => void }) {
  return (
    <section className="rift-result" aria-labelledby="result-heading">
      <h1 id="result-heading">{state.winner ? `${WINNER_NAMES[state.winner]} 胜利` : "对局结束"}</h1>
      <ul>
        {state.players.map((seat) => (
          <li key={seat.id}>
            座位 {seat.id} · {seat.championId} · {IDENTITY_NAMES[seat.identity]}
            {seat.alive ? "（存活）" : "（阵亡）"}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onReplay}>
        再来一局
      </button>
    </section>
  );
}
