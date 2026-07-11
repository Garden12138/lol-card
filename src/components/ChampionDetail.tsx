import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ChampionCard, SkinEdition } from "../types/cards";
import { tagLabels } from "./CardMini";

interface ChampionDetailProps {
  champion: ChampionCard;
  skin: SkinEdition;
}

const statLabels: Array<[keyof ChampionCard["stats"], string]> = [
  ["hp", "生命"],
  ["mp", "能量"],
  ["armor", "护甲"],
  ["spellblock", "魔抗"],
  ["attackdamage", "攻击"],
  ["attackrange", "射程"],
];

export function ChampionDetail({ champion, skin }: ChampionDetailProps) {
  const [openAbility, setOpenAbility] = useState<string>(champion.passive.slot);

  return (
    <aside className="champion-detail" aria-label={`${champion.title}资料`}>
      <div className="champion-detail__heading">
        <div>
          <p>{champion.id}</p>
          <h2>{champion.title}</h2>
          <span>{champion.name}</span>
        </div>
        <span className="edition-chip">{skin.name}</span>
      </div>

      <div className="champion-detail__tags">
        {champion.tags.map((tag) => (
          <span key={tag}>{tagLabels[tag] ?? tag}</span>
        ))}
      </div>

      <p className="champion-detail__lore">{champion.lore}</p>

      <dl className="stat-grid">
        {statLabels.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{Math.round(champion.stats[key])}</dd>
          </div>
        ))}
      </dl>

      <div className="ability-list">
        {[champion.passive, ...champion.spells].map((ability) => {
          const isOpen = openAbility === ability.slot;
          return (
            <article key={ability.slot} className={isOpen ? "is-open" : ""}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenAbility(isOpen ? "" : ability.slot)}
              >
                <span className="ability-list__icon">
                  {ability.iconUrl ? <img src={ability.iconUrl} alt="" loading="lazy" /> : ability.slot}
                  <b>{ability.slot}</b>
                </span>
                <span>
                  <small>{ability.slot === "P" ? "被动技能" : `${ability.slot} 技能`}</small>
                  <strong>{ability.name}</strong>
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {isOpen && <p>{ability.description}</p>}
            </article>
          );
        })}
      </div>
    </aside>
  );
}
