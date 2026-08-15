import { legalActions } from "../engine/legal";
import type { Action, GameCard, GameState, PlayerId } from "../engine/types";
import { GameLog } from "./GameLog";
import { HandDock } from "./HandDock";
import { PromptBar } from "./PromptBar";
import { Seat } from "./Seat";

export function TableScreen({
  state,
  mySeat,
  pendingCardId,
  onPlayCard,
  onAction,
  onSelectSeat,
}: {
  state: GameState;
  mySeat: PlayerId;
  pendingCardId: string | null;
  onPlayCard: (card: GameCard) => void;
  onAction: (action: Action) => void;
  onSelectSeat: (id: PlayerId) => void;
}) {
  const duel = state.config.mode === "duel";
  const n = state.players.length;
  const relative = (offset: number) => (mySeat + offset + n) % n;
  const pendingTargets = new Set(
    pendingCardId
      ? legalActions(state)
          .filter((action) => action.type === "playCard" && action.cardId === pendingCardId)
          .map((action) => (action.type === "playCard" ? action.targetId : undefined))
          .filter((id): id is PlayerId => id !== undefined)
      : [],
  );
  const renderSeat = (id: PlayerId, area: "bottom" | "top" | "left" | "right") => (
    <Seat
      state={state}
      id={id}
      mySeat={mySeat}
      area={area}
      selected={pendingTargets.has(id)}
      onSelect={onSelectSeat}
    />
  );
  return (
    <section className={`rift-table${duel ? " rift-table--duel" : ""}`} aria-label="对局桌面">
      {renderSeat(duel ? relative(1) : relative(2), "top")}
      {!duel && renderSeat(relative(1), "left")}
      <div className="rift-table__center">
        <PromptBar
          state={state}
          mySeat={mySeat}
          pendingCardId={pendingCardId}
          onAction={onAction}
        />
        <GameLog state={state} />
      </div>
      {!duel && renderSeat(relative(3), "right")}
      <div className="rift-table__self">
        {renderSeat(mySeat, "bottom")}
        <HandDock state={state} mySeat={mySeat} onPlay={onPlayCard} />
      </div>
    </section>
  );
}
