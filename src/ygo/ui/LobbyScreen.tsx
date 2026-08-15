import { DECKS } from "../data/decks";
import { YGO_LEAD, YGO_SUBTITLE, YGO_TITLE } from "../data/copy";

export function LobbyScreen({
  deckId,
  onDeck,
  onStart,
  onExit,
}: {
  deckId: string;
  onDeck: (id: string) => void;
  onStart: () => void;
  onExit: () => void;
}) {
  return (
    <div className="ygo-lobby">
      <header className="ygo-header">
        <div>
          <strong>{YGO_TITLE}</strong>
          <small>{YGO_SUBTITLE}</small>
        </div>
        <button type="button" onClick={onExit}>
          返回鉴赏馆
        </button>
      </header>
      <p className="ygo-lead">{YGO_LEAD}</p>
      <div className="ygo-decks">
        {DECKS.map((deck) => (
          <button
            key={deck.id}
            type="button"
            className={deckId === deck.id ? "is-on" : ""}
            onClick={() => onDeck(deck.id)}
          >
            <strong>{deck.name}</strong>
            <span>{deck.blurb}</span>
          </button>
        ))}
      </div>
      <button type="button" className="ygo-start" onClick={onStart}>
        开始决斗
      </button>
    </div>
  );
}
