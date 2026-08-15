import type { CardKind } from "../engine/types";
import { CARD_NAMES, SUIT_SYMBOL } from "../data/copy";
import type { GameCard } from "../engine/types";

export function SpellCardFace({ card, compact = false }: { card: GameCard; compact?: boolean }) {
  return (
    <div className={`spell-face spell-face--${card.kind} ${compact ? "spell-face--compact" : ""}`}>
      <span className="spell-face__suit">
        {SUIT_SYMBOL[card.suit]} {card.rank}
      </span>
      <strong>{CARD_NAMES[card.kind as CardKind]}</strong>
    </div>
  );
}
