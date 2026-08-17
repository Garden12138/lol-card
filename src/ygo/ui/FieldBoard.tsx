import type { Action, CardInstance, DuelState, PlayerId } from "../engine/types";
import { occupiedMonsters, occupiedSpells } from "../engine/helpers";
import { CardView } from "./CardView";

export function FieldBoard({
  state,
  me,
  actions,
  onAct,
}: {
  state: DuelState;
  me: PlayerId;
  actions: Action[];
  onAct: (action: Action) => void;
}) {
  const foe = me === 0 ? 1 : 0;
  return (
    <div className="ygo-field">
      <Row state={state} cards={state.players[foe].spells} actions={actions} onAct={onAct} hidden />
      <Row state={state} cards={state.players[foe].monsters} actions={actions} onAct={onAct} />
      <Row state={state} cards={state.players[me].monsters} actions={actions} onAct={onAct} />
      <Row state={state} cards={state.players[me].spells} actions={actions} onAct={onAct} />
    </div>
  );
}

function Row({
  state,
  cards,
  actions,
  onAct,
  hidden,
}: {
  state: DuelState;
  cards: (CardInstance | null)[];
  actions: Action[];
  onAct: (action: Action) => void;
  hidden?: boolean;
}) {
  return (
    <div className="ygo-row">
      {cards.map((card, index) => (
        <div key={index} className="ygo-zone">
          {card ? (
            <CardView
              card={card}
              state={state}
              hidden={hidden && card.face === "down"}
              onClick={() => {
                const attack = actions.find((action) => action.type === "attack" && (action.attackerUid === card.uid || action.targetUid === card.uid));
                const activate = actions.find((action) => action.type === "activate" && action.uid === card.uid);
                const pos = actions.find((action) => action.type === "changePosition" && action.uid === card.uid);
                if (attack) onAct(attack);
                else if (activate) onAct(activate);
                else if (pos) onAct(pos);
              }}
            />
          ) : (
            <span className="ygo-zone__empty" />
          )}
        </div>
      ))}
    </div>
  );
}

export function PileCounts({
  state,
  id,
  actions,
  onAct,
}: {
  state: DuelState;
  id: PlayerId;
  actions?: Action[];
  onAct?: (action: Action) => void;
}) {
  const player = state.players[id];
  const extraAct =
    actions?.find((action) => action.type === "xyzSummon") ??
    actions?.find((action) => action.type === "synchroSummon");
  return (
    <p className="ygo-piles">
      卡组 {player.deck.length} ·{" "}
      {extraAct && onAct && id === 0 ? (
        <button type="button" className="ygo-extra" onClick={() => onAct(extraAct)}>
          额外 {player.extra.length}
        </button>
      ) : (
        <>额外 {player.extra.length}</>
      )}{" "}
      · 墓地 {player.gy.length} · 场地 {player.field ? "有" : "无"} · 怪兽 {occupiedMonsters(player).length} · 魔陷{" "}
      {occupiedSpells(player).length}
    </p>
  );
}
