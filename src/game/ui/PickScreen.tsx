import { getGameChampion } from "../data/champions";
import { getChampionById, getSkinByNum } from "../../data/champions";
import type { GameState, PlayerId } from "../engine/types";
import type { Action } from "../engine/types";

export function PickScreen({
  state,
  onPick,
}: {
  state: GameState;
  onPick: (action: Action) => void;
}) {
  const actor = state.prompt.actor;
  const human = actor === 0;
  const seat = state.players[0]!;
  return (
    <section className="rift-pick" aria-labelledby="pick-heading">
      <h1 id="pick-heading">峡谷身份战 · 选将</h1>
      <p>{human ? "轮到你选择英雄。男爵先选，每人二选一。" : "其他召唤师正在选将…"}</p>
      {seat.identity === "baron" && <p className="rift-pick__role">你的公开身份：男爵</p>}
      <div className="rift-pick__grid">
        {(human ? seat.candidates : []).map((championId) => {
          const champion = getChampionById(championId);
          const skin = champion ? getSkinByNum(champion, 0) : undefined;
          const def = getGameChampion(championId);
          return (
            <button
              key={championId}
              type="button"
              className="rift-pick__card"
              onClick={() => onPick({ type: "pickChampion", player: 0 as PlayerId, championId })}
            >
              {skin && <img src={skin.loadingUrl} alt="" />}
              <strong>{champion?.title ?? championId}</strong>
              <span>
                {def?.skillName}：{def?.skillText}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
