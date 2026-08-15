import { getChampionById } from "../../data/champions";
import { getFighterDef } from "../data/roster";
import type { FighterId } from "../engine/types";

export function VersusScreen({ p1, p2 }: { p1: FighterId; p2: FighterId }) {
  const left = getFighterDef(p1);
  const right = getFighterDef(p2);
  const leftArt = getChampionById(p1)?.skins[0]?.splashUrl;
  const rightArt = getChampionById(p2)?.skins[0]?.splashUrl;
  return (
    <div className="fight-versus">
      <div className="fight-versus__side" style={{ backgroundImage: leftArt ? `url("${leftArt}")` : undefined }}>
        <strong>{left.name}</strong>
        <span>{left.title}</span>
      </div>
      <div className="fight-versus__mid">VS</div>
      <div className="fight-versus__side is-right" style={{ backgroundImage: rightArt ? `url("${rightArt}")` : undefined }}>
        <strong>{right.name}</strong>
        <span>{right.title}</span>
      </div>
    </div>
  );
}
