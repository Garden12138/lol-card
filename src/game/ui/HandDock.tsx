import { CARD_NAMES, SUIT_SYMBOL } from "../data/copy";
import { legalActions } from "../engine/legal";
import type { GameCard, GameState } from "../engine/types";
import { SpellCardFace } from "./SpellCardFace";

export function HandDock({
  state,
  onPlay,
}: {
  state: GameState;
  onPlay: (card: GameCard) => void;
}) {
  const seat = state.players[0]!;
  const legalIds = new Set(
    legalActions(state)
      .filter((action) => action.type === "playCard" && action.player === 0)
      .map((action) => (action.type === "playCard" ? action.cardId : "")),
  );
  const respondIds = new Set(state.prompt.actor === 0 ? state.prompt.legalCardIds : []);
  return (
    <div className="rift-hand" aria-label="手牌">
      {seat.hand.map((card) => {
        const enabled = legalIds.has(card.id) || respondIds.has(card.id);
        return (
          <button
            key={card.id}
            type="button"
            className={`rift-hand__card ${enabled ? "is-legal" : ""}`}
            disabled={!enabled}
            onClick={() => onPlay(card)}
            aria-label={`${CARD_NAMES[card.kind]} ${SUIT_SYMBOL[card.suit]}`}
          >
            <SpellCardFace card={card} compact />
          </button>
        );
      })}
    </div>
  );
}
