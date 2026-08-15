import { IDENTITY_NAMES, WINNER_NAMES } from "../data/copy";
import { getChampionById } from "../../data/champions";
import type { GameState } from "../engine/types";

export function ResultScreen({ state, onReplay }: { state: GameState; onReplay: () => void }) {
  return (
    <section className="rift-result" aria-labelledby="result-heading">
      <h1 id="result-heading">{state.winner ? `${WINNER_NAMES[state.winner]} 胜利` : "对局结束"}</h1>
      <ul>
        {state.players.map((seat) => {
          const name = getChampionById(seat.championId)?.name ?? seat.championId;
          const extra =
            state.config.mode === "identity"
              ? ` · ${IDENTITY_NAMES[seat.identity]}`
              : state.config.mode === "team"
                ? ` · ${seat.id % 2 === 0 ? "蓝方" : "红方"}`
                : "";
          return (
            <li key={seat.id}>
              座位 {seat.id} · {name}
              {extra}
              {seat.alive ? "（存活）" : "（阵亡）"}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={onReplay}>
        再来一局
      </button>
    </section>
  );
}
