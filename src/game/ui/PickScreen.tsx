import { getChampionById, getSkinByNum } from "../../data/champions";
import { getGameChampion } from "../data/champions";
import type { Action, GameState, PlayerId } from "../engine/types";

export function PickScreen({
  state,
  mySeat,
  onPick,
}: {
  state: GameState;
  mySeat: PlayerId;
  onPick: (action: Action) => void;
}) {
  const actor = state.prompt.actor;
  const human = actor === mySeat;
  const seat = state.players[mySeat]!;
  const title =
    state.config.mode === "duel" ? "1v1 单挑" : state.config.mode === "team" ? "2v2 团队战" : "峡谷身份战";
  return (
    <section className="rift-pick" aria-labelledby="pick-heading">
      <h1 id="pick-heading">{title} · 选将</h1>
      <p>{human ? "轮到你选择英雄。每人三选一。" : "等待其他召唤师选将…"}</p>
      {state.config.mode === "identity" && seat.identity === "baron" && (
        <p className="rift-pick__role">你的公开身份：男爵</p>
      )}
      {state.config.mode === "team" && (
        <p className="rift-pick__role">你是{mySeat % 2 === 0 ? "蓝方" : "红方"}</p>
      )}
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
              onClick={() => onPick({ type: "pickChampion", player: mySeat, championId })}
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
