import { useState } from "react";
import type { ChampionCard, SkinEdition } from "../types/cards";

interface CardMiniProps {
  champion: ChampionCard;
  skin: SkinEdition;
  flipped?: boolean;
  compact?: boolean;
  priority?: boolean;
}

const tagLabels: Record<string, string> = {
  Fighter: "战士",
  Mage: "法师",
  Assassin: "刺客",
  Tank: "坦克",
  Marksman: "射手",
  Support: "辅助",
};

export function CardMini({ champion, skin, flipped = false, compact = false, priority = false }: CardMiniProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={`card-mini ${compact ? "card-mini--compact" : ""} ${flipped ? "is-flipped" : ""}`}>
      <div className="card-mini__inner">
        <article className="card-mini__face card-mini__front" aria-label={`${champion.title} · ${skin.name}`}>
          {!imageFailed ? (
            <img
              src={skin.loadingUrl}
              alt={`${champion.title} ${skin.name}卡面`}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="card-mini__fallback" role="img" aria-label={`${champion.title}卡面暂不可用`}>
              <span>{champion.title.slice(0, 2)}</span>
            </div>
          )}
          <div className="card-mini__shine" aria-hidden="true" />
          <div className="card-mini__topline">
            <span>{champion.id.toUpperCase()}</span>
            <span>{String(skin.num).padStart(3, "0")}</span>
          </div>
          <div className="card-mini__caption">
            <span className="card-mini__eyebrow">{skin.isBase ? champion.name : skin.name}</span>
            <strong>{champion.title}</strong>
            {!skin.isBase && <small>{skin.name}</small>}
          </div>
        </article>

        <article className="card-mini__face card-mini__back" aria-label={`${champion.title}卡片背面`}>
          <div className="card-mini__back-orbit" aria-hidden="true" />
          <p className="card-mini__serial">ARCHIVE / {champion.key}</p>
          <div>
            <span className="card-mini__eyebrow">{champion.name}</span>
            <h3>{champion.title}</h3>
            <p className="card-mini__back-title">{champion.id}</p>
          </div>
          <div className="card-mini__tags">
            {champion.tags.map((tag) => (
              <span key={tag}>{tagLabels[tag] ?? tag}</span>
            ))}
          </div>
          <div className="card-mini__metrics">
            {[
              ["攻击", champion.info.attack],
              ["防御", champion.info.defense],
              ["法术", champion.info.magic],
              ["难度", champion.info.difficulty],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <i style={{ "--metric": `${Number(value) * 10}%` } as React.CSSProperties} />
              </div>
            ))}
          </div>
          <div className="card-mini__abilities" aria-label="技能">
            {[champion.passive, ...champion.spells].map((ability) => (
              <span key={ability.slot} title={ability.name}>
                {ability.slot}
              </span>
            ))}
          </div>
          <p className="card-mini__lore">{champion.lore}</p>
          <p className="card-mini__edition">{skin.name}</p>
        </article>
      </div>
    </div>
  );
}

export { tagLabels };
