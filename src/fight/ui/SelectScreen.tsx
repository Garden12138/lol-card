import { getChampionById } from "../../data/champions";
import { CONTROL_HELP, FIGHT_SUBTITLE, FIGHT_TITLE } from "../data/copy";
import { ROSTER, getFighterDef } from "../data/roster";
import type { AiDifficulty, FighterId, VersusKind } from "../engine/types";

export function SelectScreen({
  p1,
  p2,
  versus,
  difficulty,
  onP1,
  onP2,
  onVersus,
  onDifficulty,
  onStart,
  onExit,
}: {
  p1: FighterId;
  p2: FighterId;
  versus: VersusKind;
  difficulty: AiDifficulty;
  onP1: (id: FighterId) => void;
  onP2: (id: FighterId) => void;
  onVersus: (kind: VersusKind) => void;
  onDifficulty: (level: AiDifficulty) => void;
  onStart: () => void;
  onExit: () => void;
}) {
  return (
    <div className="fight-select">
      <header className="fight-header">
        <div>
          <strong>{FIGHT_TITLE}</strong>
          <small>{FIGHT_SUBTITLE}</small>
        </div>
        <button type="button" onClick={onExit}>
          返回鉴赏馆
        </button>
      </header>
      <p className="fight-lead">选将后进入街霸向四键对打。立绘来自 Data Dragon loading 图。</p>
      <div className="fight-versus-toggle">
        <button type="button" className={versus === "ai" ? "is-on" : ""} onClick={() => onVersus("ai")}>
          打电脑
        </button>
        <button type="button" className={versus === "local" ? "is-on" : ""} onClick={() => onVersus("local")}>
          本地双人
        </button>
        {versus === "ai" &&
          (["easy", "normal", "hard"] as const).map((level) => (
            <button
              key={level}
              type="button"
              className={difficulty === level ? "is-on" : ""}
              onClick={() => onDifficulty(level)}
            >
              {level === "easy" ? "易" : level === "normal" ? "中" : "难"}
            </button>
          ))}
      </div>
      <div className="fight-picks">
        <RosterColumn label="P1" selected={p1} onSelect={onP1} />
        <div className="fight-vs-mark">VS</div>
        <RosterColumn label={versus === "ai" ? "CPU" : "P2"} selected={p2} onSelect={onP2} />
      </div>
      <ul className="fight-help">
        {CONTROL_HELP.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <button type="button" className="fight-start" onClick={onStart}>
        开始对战
      </button>
    </div>
  );
}

function RosterColumn({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: FighterId;
  onSelect: (id: FighterId) => void;
}) {
  return (
    <div className="fight-roster">
      <h2>{label}</h2>
      <div className="fight-roster__grid">
        {ROSTER.map((id) => {
          const def = getFighterDef(id);
          const champ = getChampionById(id);
          return (
            <button
              key={id}
              type="button"
              className={selected === id ? "is-on" : ""}
              onClick={() => onSelect(id)}
            >
              {champ && <img src={champ.iconUrl} alt="" />}
              <span>{def.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
