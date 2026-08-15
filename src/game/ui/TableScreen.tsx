import type { GameCard, GameState, PlayerId } from "../engine/types";
import { GameLog } from "./GameLog";
import { HandDock } from "./HandDock";
import { PromptBar } from "./PromptBar";
import { Seat } from "./Seat";
import type { Action } from "../engine/types";

export function TableScreen({
  state,
  selectedTarget,
  onPlayCard,
  onAction,
  onSelectSeat,
}: {
  state: GameState;
  selectedTarget: PlayerId | null;
  onPlayCard: (card: GameCard) => void;
  onAction: (action: Action) => void;
  onSelectSeat: (id: PlayerId) => void;
}) {
  return (
    <section className="rift-table" aria-label="对局桌面">
      <Seat state={state} id={2} area="top" selected={selectedTarget === 2} onSelect={onSelectSeat} />
      <Seat state={state} id={1} area="left" selected={selectedTarget === 1} onSelect={onSelectSeat} />
      <div className="rift-table__center">
        <PromptBar state={state} onAction={onAction} />
        <GameLog state={state} />
      </div>
      <Seat state={state} id={3} area="right" selected={selectedTarget === 3} onSelect={onSelectSeat} />
      <div className="rift-table__self">
        <Seat state={state} id={0} area="bottom" selected={selectedTarget === 0} onSelect={onSelectSeat} />
        <HandDock state={state} onPlay={onPlayCard} />
      </div>
    </section>
  );
}
