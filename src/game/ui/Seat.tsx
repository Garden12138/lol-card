import { CARD_NAMES, IDENTITY_NAMES } from "../data/copy";
import { getGameChampion } from "../data/champions";
import { equipmentList } from "../engine/distance";
import { teamOf } from "../engine/helpers";
import type { GameState, PlayerId } from "../engine/types";
import { getChampionById, getSkinByNum } from "../../data/champions";

export function Seat({
  state,
  id,
  mySeat,
  area,
  selected,
  onSelect,
}: {
  state: GameState;
  id: PlayerId;
  mySeat: PlayerId;
  area: "bottom" | "top" | "left" | "right";
  selected: boolean;
  onSelect: (id: PlayerId) => void;
}) {
  const seat = state.players[id]!;
  const champion = getChampionById(seat.championId);
  const skin = champion ? getSkinByNum(champion, 0) : undefined;
  const def = getGameChampion(seat.championId);
  const art = skin?.splashUrl || skin?.loadingUrl;
  const isTurn = state.prompt.actor === id && state.phase !== "gameOver";
  const showIdentity =
    state.config.mode === "identity" &&
    (seat.identity === "baron" || !seat.alive || state.phase === "gameOver");
  const team = state.config.mode === "team" ? teamOf(id) : null;
  const teammate = team !== null && id !== mySeat && teamOf(id) === teamOf(mySeat);
  return (
    <button
      type="button"
      className={`rift-seat rift-seat--${area}${selected ? " is-selected" : ""}${seat.alive ? "" : " is-dead"}${isTurn ? " is-turn" : ""}${team ? ` rift-seat--${team}` : ""}`}
      onClick={() => onSelect(id)}
      aria-label={`座位 ${id} ${champion?.name || seat.championId || "未选将"}`}
    >
      {art ? (
        <img src={art} alt="" className="rift-seat__art" />
      ) : (
        <div className="rift-seat__art rift-seat__art--empty" />
      )}
      <div className="rift-seat__meta">
        <strong>{champion?.name ?? (seat.candidates[0] ? "选将中" : `座位 ${id}`)}</strong>
        <span>
          体力 {seat.hp}/{seat.maxHp} · 手牌 {seat.hand.length}
        </span>
        {team && (
          <span className="rift-seat__role">
            {team === "blue" ? "蓝方" : "红方"}
            {teammate ? " · 队友" : id === mySeat ? " · 你" : ""}
          </span>
        )}
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
