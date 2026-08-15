import { getFighterDef } from "../data/roster";
import type { FightState } from "../engine/types";

export function FightHud({ state, onPause }: { state: FightState; onPause: () => void }) {
  const [a, b] = state.fighters;
  const seconds = Math.ceil(state.timer / 60);
  return (
    <div className="fight-hud">
      <Bar side="left" name={getFighterDef(a.id).name} health={a.health} meter={a.meter} wins={state.wins[0]} />
      <div className="fight-hud__clock">
        <strong>{String(seconds).padStart(2, "0")}</strong>
        <span>
          {state.wins[0]} - {state.wins[1]}
        </span>
        <button type="button" onClick={onPause}>
          暂停
        </button>
      </div>
      <Bar side="right" name={getFighterDef(b.id).name} health={b.health} meter={b.meter} wins={state.wins[1]} />
    </div>
  );
}

function Bar({
  side,
  name,
  health,
  meter,
  wins,
}: {
  side: "left" | "right";
  name: string;
  health: number;
  meter: number;
  wins: number;
}) {
  return (
    <div className={`fight-hud__bar is-${side}`}>
      <div className="fight-hud__name">
        <span>{name}</span>
        <small>{"●".repeat(wins)}{"○".repeat(Math.max(0, 2 - wins))}</small>
      </div>
      <div className="fight-hud__hp">
        <i style={{ width: `${Math.max(0, health / 10)}%` }} />
      </div>
      <div className="fight-hud__meter">
        <i style={{ width: `${Math.min(100, meter / 3)}%` }} />
      </div>
    </div>
  );
}
