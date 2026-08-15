import { CARD_NAMES, IDENTITY_NAMES } from "../data/copy";
import { getGameChampion } from "../data/champions";
import { equipmentList } from "../engine/distance";
import type { GameState, PlayerId } from "../engine/types";
import { getChampionById, getSkinByNum } from "../../data/champions";

export function Seat({
  state,
  id,
  area,
  selected,
  onSelect,
}: {
  state: GameState;
  id: PlayerId;
  area: "bottom" | "top" | "left" | "right";
  selected: boolean;
  onSelect: (id: PlayerId) => void;
}) {
  const seat = state.players[id]!;
  const champion = getChampionById(seat.championId);
  const skin = champion ? getSkinByNum(champion, 0) : undefined;
  const def = getGameChampion(seat.championId);
  const showIdentity = seat.identity === "baron" || !seat.alive || state.phase === "gameOver";
  return (
    <button
      type="button"
      className={`rift-seat rift-seat--${area} ${selected ? "is-selected" : ""} ${seat.alive ? "" : "is-dead"}`}
      onClick={() => onSelect(id)}
      aria-label={`座位 ${id} ${seat.championId || "未选将"}`}
    >
      {skin ? (
        <img src={skin.loadingUrl} alt="" className="rift-seat__art" />
      ) : (
        <div className="rift-seat__art rift-seat__art--empty" />
      )}
      <div className="rift-seat__meta">
        <strong>{champion?.title ?? (seat.candidates[0] ? "选将中" : `座位 ${id}`)}</strong>
        <span>
          体力 {seat.hp}/{seat.maxHp} · 手牌 {seat.hand.length}
        </span>
        {showIdentity && <span className="rift-seat__role">{IDENTITY_NAMES[seat.identity]}</span>}
        {def && <span>{def.skillName}</span>}
        <span>
          {equipmentList(state, id)
            .map((card) => CARD_NAMES[card.kind])
            .join(" / ") || "无装备"}
        </span>
      </div>
    </button>
  );
}
