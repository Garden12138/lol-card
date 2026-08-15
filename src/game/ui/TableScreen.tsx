import type { Action, GameCard, GameState, PlayerId } from "../engine/types";
import { GameLog } from "./GameLog";
import { HandDock } from "./HandDock";
import { PromptBar } from "./PromptBar";
import { Seat } from "./Seat";

export function TableScreen({
  state,
  mySeat,
  selectedTarget,
  onPlayCard,
  onAction,
  onSelectSeat,
}: {
  state: GameState;
  mySeat: PlayerId;
  selectedTarget: PlayerId | null;
  onPlayCard: (card: GameCard) => void;
  onAction: (action: Action) => void;
  onSelectSeat: (id: PlayerId) => void;
}) {
  const duel = state.config.mode === "duel";
  const n = state.players.length;
  const relative = (offset: number) => (mySeat + offset + n) % n;
  return (
    <section className="rift-table" aria-label="对局桌面">
      <Seat
        state={state}
        id={duel ? relative(1) : relative(2)}
        area="top"
        selected={selectedTarget === (duel ? relative(1) : relative(2))}
        onSelect={onSelectSeat}
      />
      {!duel && (
        <Seat
          state={state}
          id={relative(1)}
          area="left"
          selected={selectedTarget === relative(1)}
          onSelect={onSelectSeat}
        />
      )}
      <div className="rift-table__center">
        <PromptBar state={state} mySeat={mySeat} onAction={onAction} />
        <GameLog state={state} />
      </div>
      {!duel && (
        <Seat
          state={state}
          id={relative(3)}
          area="right"
          selected={selectedTarget === relative(3)}
          onSelect={onSelectSeat}
        />
      )}
      <div className="rift-table__self">
        <Seat
          state={state}
          id={mySeat}
          area="bottom"
          selected={selectedTarget === mySeat}
          onSelect={onSelectSeat}
        />
        <HandDock state={state} mySeat={mySeat} onPlay={onPlayCard} />
      </div>
    </section>
  );
}
